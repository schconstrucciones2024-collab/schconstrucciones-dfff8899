import { create } from "zustand";
import { applyPatches, enablePatches, produceWithPatches, type Patch } from "immer";
import { z } from "zod";
import LZString from "lz-string";
import {
  GEOMETRY,
  bounds,
  distance,
  polygonArea,
  project,
  inside,
  presetPolygon,
  scalePolygon,
  validateContour,
  segmentInside,
  wallOverlap,
  exteriorSegments,
  validateStair,
  stairGeometry,
  transformPoint,
  detectRooms,
  type Point,
  type Segment,
  type Counter,
  type Fixture,
  type FixtureKind,
  FIXTURE_SIZES,
  type Stair,
  type Footprint,
} from "@/config/geometry";
enablePatches();
import { clampArea, DEFAULT_LOGISTICS, type LogisticsSelection } from "@/lib/cotizador";
import type { FinishId } from "@/config/materials";
import type { FoundationId, RoofId } from "@/config/pricing";
import {
  DEFAULT_FINISH,
  DEFAULT_FOUNDATION,
  PLATEA_HEIGHT,
  TRADICIONAL_MAX_PITCH,
  coherentSystem,
  exteriorThickness,
  systemOf,
} from "@/config/systems";
import type { SystemId } from "@/lib/cotizador";
import { OPENINGS_CATALOG, type OpeningType } from "@/config/openingsCatalog";
import { COMPACTA_PROPOSAL, PLAN_CATALOG, isLShape, planLevels, recommendedPlan, type LayoutProposal, type RoomBox } from "@/config/layoutProposals";

export type WallId =
  "front" | "back" | "left" | "right" | "partition" | `edge-${number}` | `wall-${string}`;
export type ViewId = "exterior" | "interior" | "corte" | "recorrido" | "planta";
export type Opening = {
  id: string;
  type: OpeningType;
  wall: WallId;
  floor: number;
  offset: number;
  manual: boolean;
};
export type HouseConfig = {
  m2: number;
  floors: number;
  shape: "compacta" | "alargada";
  foundation: FoundationId;
  finish: FinishId;
  roofType: RoofId;
  roofPitch: number;
  openings: Opening[];
  logistics: LogisticsSelection;
  contour: Point[];
  footprint: Footprint;
  walls: Segment[][];
  counters: Counter[];
  fixtures: Fixture[];
  /** Requested room program; the layout may place fewer if the area is too small. */
  bedrooms: number;
  bathrooms: number;
  stairs: Stair[];
  roomLabels: Record<string, string>;
  ground: "arena" | "cesped";
  pileHeight: number;
  orthogonal: boolean;
  roofDirection: "x" | "z";
  overhang: number;
  position: Point;
  rotation: number;
};
export const WALL_HEIGHT = 2.65;
export const FLOOR_BASE = 0.85;
export const FLOOR_STEP = 2.85;
export function houseDimensions(
  c: Pick<HouseConfig, "m2" | "floors" | "shape"> & { contour?: Point[] },
) {
  if (c.contour?.length) {
    const b = bounds(c.contour);
    return { width: b.width, depth: b.depth, area: Number(polygonArea(c.contour).toFixed(6)) };
  }
  const area = c.m2 / c.floors,
    ratio = c.shape === "compacta" ? 1.4 : 2;
  return { width: Math.sqrt(area * ratio), depth: Math.sqrt(area / ratio), area };
}
/** Con platea la casa apoya casi al ras del terreno; con pilotes, a la altura elegida. */
export const foundationHeight = (c: Pick<HouseConfig, "foundation" | "pileHeight">) =>
  c.foundation === "platea" ? PLATEA_HEIGHT : c.pileHeight;
export const floorBase = (c: HouseConfig) => foundationHeight(c) + GEOMETRY.slabThickness;
export function designWalls(c: HouseConfig, floor: number): Segment[] {
  return [...exteriorSegments(c.contour, exteriorThickness(c.finish)), ...(c.walls[floor] ?? [])];
}
export function resolveWall(c: HouseConfig, id: WallId | string, floor = 0): Segment | undefined {
  const aliases: Record<string, string> = {
    front: "edge-2",
    back: "edge-0",
    left: "edge-3",
    right: "edge-1",
  };
  if (id === "partition") return c.walls[floor]?.[0];
  return designWalls(c, floor).find((w) => w.id === (aliases[id] ?? id));
}
export const canUseFloors = (m2: number, floors: number) => floors === 1 || m2 / floors >= 20;
export function wallLength(c: HouseConfig, wall: WallId, floor = 0) {
  const w = resolveWall(c, wall, floor);
  return w ? distance(w.a, w.b) : 0;
}
export function validateOpening(c: HouseConfig, o: Opening, ignoreId = o.id): string | null {
  const s = OPENINGS_CATALOG[o.type],
    length = wallLength(c, o.wall, o.floor);
  if (!resolveWall(c, o.wall, o.floor)) return "Este muro ya no está disponible.";
  if (s.sill + s.height > WALL_HEIGHT) return "La abertura supera la altura del muro.";
  if (o.floor < 0 || o.floor >= c.floors) return "Esta planta no está disponible.";
  if (s.walls === "interior" && o.wall !== "partition" && !o.wall.startsWith("wall-"))
    return "La puerta interior va en un muro interior.";
  if (s.walls === "exterior" && (o.wall === "partition" || o.wall.startsWith("wall-")))
    return "Esta abertura va en un muro exterior.";
  if (Math.abs(o.offset) + s.width / 2 > length / 2 - 0.25 + 0.001)
    return "Dejá al menos 25 cm de distancia a la esquina.";
  if (
    c.openings.some(
      (other) =>
        other.id !== ignoreId &&
        resolveWall(c, other.wall, other.floor)?.id === resolveWall(c, o.wall, o.floor)?.id &&
        other.floor === o.floor &&
        Math.abs(other.offset - o.offset) <
          (OPENINGS_CATALOG[other.type].width + s.width) / 2 + 0.15 - 0.001,
    )
  )
    return "Las aberturas no pueden superponerse.";
  return null;
}
export const snapOffset = (v: number) => Math.round(v * 10) / 10;
export function suggestedOpenings(c: HouseConfig): Opening[] {
  const result: Opening[] = [];
  for (let floor = 0; floor < c.floors; floor++)
    for (const [i, w] of exteriorSegments(c.contour).entries()) {
      if (i === 3) continue;
      const o: Opening = {
        id: `default-${floor}-${i}`,
        type: floor === 0 && i === 2 ? "ventanal" : "ventana",
        wall: w.id as WallId,
        floor,
        offset: 0,
        manual: false,
      };
      if (!validateOpening({ ...c, openings: result }, o)) {
        result.push(o);
      } else if (o.type === "ventanal") {
        // Very short front walls can't fit the sliding glass door: fall back to the plain entry door.
        const fallback: Opening = { ...o, type: "entrada" };
        if (!validateOpening({ ...c, openings: result }, fallback)) result.push(fallback);
      }
    }
  return result;
}
/** Hasta 500 m² entran casas grandes: el selector llega a 6 dormitorios y 4 baños. */
export const MAX_BEDROOMS = 6, MAX_BATHROOMS = 4;
const BATH_WIDTH = 1.8, BED_MIN_WIDTH = 2.6;
/** Splits each floor into a front social zone and a back strip of bathrooms and bedrooms. */
export function roomProgram(c: HouseConfig) {
  const b = bounds(c.contour),
    split = b.minZ + Math.min(Math.max(b.depth * 0.5, 2.7), Math.max(2.7, b.depth - 2.5)),
    // Multi-floor houses keep a stair bay at the back-right corner of every floor (U stair or compact spiral).
    bay = c.floors > 1 ? (b.width >= 9 ? 3.1 : 2.1) : 0,
    usable = b.width - bay,
    queue: ("bano" | "dormitorio")[] = [
      ...Array.from({ length: c.bathrooms }, () => "bano" as const),
      ...Array.from({ length: c.bedrooms }, () => "dormitorio" as const),
    ];
  const floors: { floor: number; rooms: { kind: "bano" | "dormitorio"; x0: number; x1: number }[] }[] = [];
  for (let floor = 0; floor < c.floors && queue.length; floor++) {
    const picked: ("bano" | "dormitorio")[] = [];
    let used = 0;
    while (queue.length) {
      const need = queue[0] === "bano" ? BATH_WIDTH : BED_MIN_WIDTH;
      if (used + need > usable + 1e-6) break;
      used += need;
      picked.push(queue.shift()!);
    }
    if (!picked.length) break;
    const beds = picked.filter((k) => k === "dormitorio").length,
      extra = usable - used;
    let x = b.minX;
    const rooms = picked.map((kind, i) => {
      const w =
        (kind === "bano" ? BATH_WIDTH : BED_MIN_WIDTH) +
        (beds ? (kind === "dormitorio" ? extra / beds : 0) : i === picked.length - 1 ? extra : 0);
      const r = { kind, x0: x, x1: x + w };
      x += w;
      return r;
    });
    floors.push({ floor, rooms });
  }
  return { split, minZ: b.minZ, floors, bounds: b, bay };
}
export function suggestedLayout(c: HouseConfig): HouseConfig {
  const walls: Segment[][] = Array.from({ length: c.floors }, () => []),
    b = bounds(c.contour),
    plan = roomProgram(c),
    counters: Counter[] = [],
    fixtures: Fixture[] = [],
    doors: Opening[] = [];
  const wall = (floor: number, id: string, a: Point, v: Point) => {
    if (!segmentInside(a, v, c.contour)) return false;
    walls[floor]?.push({ id, a, b: v, thickness: GEOMETRY.interiorThickness, height: WALL_HEIGHT });
    return true;
  };
  for (const { floor, rooms } of plan.floors) {
    const hid = `wall-room-${floor}-h`;
    const end = plan.bay > 0 ? (rooms.at(-1)?.x1 ?? b.maxX) : b.maxX, mid = (b.minX + end) / 2;
    if (!wall(floor, hid, { x: b.minX, z: plan.split }, { x: end, z: plan.split })) continue;
    if (end < b.maxX - 1e-6) wall(floor, `wall-room-${floor}-bay`, { x: end, z: b.minZ }, { x: end, z: plan.split });
    rooms.forEach((r, i) => {
      if (i > 0) wall(floor, `wall-room-${floor}-${i}`, { x: r.x0, z: b.minZ }, { x: r.x0, z: plan.split });
      const w = r.x1 - r.x0,
        t = GEOMETRY.interiorThickness / 2,
        back = b.minZ + GEOMETRY.exteriorThickness / 2;
      const doorX = r.kind === "bano" ? r.x0 + w * 0.58 : r.x1 - 0.75;
      doors.push({ id: `door-${floor}-${i}`, type: "interior", wall: hid as WallId, floor, offset: snapOffset(doorX - mid), manual: false });
      if (r.kind === "bano") {
        fixtures.push({ id: `fixture-wc-${floor}-${i}`, floor, kind: "wc", x: r.x0 + t + 0.4, z: back + 0.38, rotation: 0 });
        fixtures.push({ id: `fixture-ducha-${floor}-${i}`, floor, kind: "ducha", x: r.x1 - t - 0.47, z: back + 0.47, rotation: 0 });
        counters.push({ id: `counter-bano-${floor}-${i}`, floor, x: r.x0 + t + 0.27, z: plan.split - t - 0.6, rotation: Math.PI / 2, length: 0.9, depth: 0.5, height: 0.85, kind: "bano", material: "pino", shape: "lineal" });
      } else {
        fixtures.push({ id: `fixture-cama-${floor}-${i}`, floor, kind: "cama", x: r.x0 + Math.max(w / 2 - 0.35, 0.95), z: back + 0.05 + FIXTURE_SIZES.cama.depth / 2, rotation: 0 });
      }
    });
  }
  const kitchenLen = Math.min(2.2, b.width - 0.5);
  let kitchenX = Math.min(Math.max(b.minX + 1.3, b.minX + 0.3 + kitchenLen / 2), b.maxX - 0.3 - kitchenLen / 2);
  const openings = suggestedOpenings({ ...c, walls });
  // Kitchen window (120 x 40 cm) on the front wall; the counter is centered under it.
  const front = exteriorSegments(c.contour)[2];
  if (front) {
    const len = distance(front.a, front.b),
      halfWin = OPENINGS_CATALOG.ventanaCocina.width / 2,
      minOff = -len / 2 + 0.25 + halfWin,
      maxOff = Math.min(len / 2 - 0.25 - halfWin, len / 2 - 0.3 - kitchenLen / 2),
      toOffset = (x: number) => project({ x, z: b.maxZ }, front.a, front.b).t * len - len / 2,
      toX = (off: number) => front.a.x + ((off + len / 2) / len) * (front.b.x - front.a.x);
    for (let off = Math.min(snapOffset(toOffset(kitchenX)), maxOff); off >= Math.max(minOff, -maxOff) - 1e-6; off = snapOffset(off - 0.1)) {
      const o: Opening = { id: "ventana-cocina-0", type: "ventanaCocina", wall: front.id as WallId, floor: 0, offset: off, manual: false };
      if (!validateOpening({ ...c, walls, openings }, o)) {
        openings.push(o);
        kitchenX = toX(off);
        break;
      }
    }
  }
  counters.push({
    id: "counter-0",
    floor: 0,
    x: kitchenX,
    z: b.maxZ - 0.55,
    rotation: 0,
    length: kitchenLen,
    depth: 0.6,
    height: 0.9,
    kind: "cocina",
    material: "pino",
    shape: "lineal",
  });
  const base = { ...c, walls, counters, fixtures, stairs: [] as Stair[], roomLabels: {} };
  const stairs: Stair[] = [entranceStair()];
  for (let floor = 0; floor < c.floors - 1; floor++) {
    const st = findStairSpot({ ...base, stairs }, floor);
    if (st) stairs.push(st);
  }
  const next = { ...base, stairs };
  for (const d of doors) if (!validateOpening({ ...next, openings }, d)) openings.push(d);
  return { ...next, openings };
}
/** Exterior entry steps from the ground to the front door (edge-2, centered like the entrance, as wide as the ventanal). */
export function entranceStair(): Stair {
  return { id: "stair-entrada", floor: 0, x: 0, z: 0, rotation: 0, width: 2.4, type: "recta", reverse: false, closed: true, exterior: true, wall: "edge-2", offset: 0, rail: true };
}
type Box2 = { minX: number; maxX: number; minZ: number; maxZ: number };
const overlaps = (a: Box2, b: Box2, gap = 0) =>
  a.minX < b.maxX + gap && b.minX < a.maxX + gap && a.minZ < b.maxZ + gap && b.minZ < a.maxZ + gap;
/**
 * Full check for an interior stair: safe dimensions, inside the contour, upper walls clear of
 * the slab opening, and no wall, furniture or other stair crossing its footprint on either floor.
 */
export function stairConflict(c: HouseConfig, s: Stair): string | null {
  const basic = validateStair(s, c.contour, c.walls[s.floor + 1] ?? [], FLOOR_STEP);
  if (basic || s.exterior) return basic;
  const g = stairGeometry(s, FLOOR_STEP), fp = bounds(g.footprint), hole = bounds(g.hole);
  for (const w of c.walls[s.floor] ?? []) {
    const n = Math.max(2, Math.ceil(distance(w.a, w.b) / 0.05));
    for (let i = 0; i <= n; i++) {
      const p = { x: w.a.x + ((w.b.x - w.a.x) * i) / n, z: w.a.z + ((w.b.z - w.a.z) * i) / n };
      if (inside(p, g.footprint, false)) return "La escalera no puede atravesar una pared de esta planta.";
    }
  }
  const items = [
    ...c.fixtures.map((f) => ({ floor: f.floor, x: f.x, z: f.z, r: Math.max(FIXTURE_SIZES[f.kind].width, FIXTURE_SIZES[f.kind].depth) / 2 })),
    ...c.counters.map((f) => ({ floor: f.floor, x: f.x, z: f.z, r: Math.max(f.length, f.depth) / 2 })),
  ];
  for (const f of items) {
    const area = f.floor === s.floor ? fp : f.floor === s.floor + 1 ? hole : null;
    if (area && overlaps(area, { minX: f.x - f.r, maxX: f.x + f.r, minZ: f.z - f.r, maxZ: f.z + f.r }, -0.05))
      return f.floor === s.floor ? "La escalera choca con un mueble." : "Hay un mueble sobre el hueco de la escalera.";
  }
  for (const o of c.stairs)
    if (o.id !== s.id && !o.exterior && Math.abs(o.floor - s.floor) <= 1) {
      // A spiral may continue straight up through the same well on the next floor.
      if (o.floor !== s.floor && o.type === "caracol" && s.type === "caracol" && Math.abs(o.x - s.x) < 1e-3 && Math.abs(o.z - s.z) < 1e-3) continue;
      const og = stairGeometry(o, FLOOR_STEP);
      if (o.floor === s.floor && overlaps(fp, bounds(og.footprint), 0.05)) return "Las escaleras no pueden superponerse.";
      if (o.floor === s.floor + 1 && overlaps(hole, bounds(og.footprint), 0.05))
        return "La escalera superior pisa el hueco de la inferior.";
      if (o.floor === s.floor - 1 && overlaps(fp, bounds(og.hole), 0.05))
        return "La escalera pisa el hueco de la escalera inferior.";
    }
  return null;
}
/**
 * Profundidad libre (m) frente a los dos extremos de una escalera interior: la entrada, en su planta, y la salida, en la
 * superior. Se mide hasta la primera pared, mueble, otra escalera o el borde de la casa, en tres franjas a lo ancho de la
 * escalera, de modo que una escalera cuyo extremo da contra una pared (o que sube y desemboca de cara a un muro) da cerca de cero.
 */
export function stairLanding(c: HouseConfig, s: Stair, cap = 1.6): { entry: number; exit: number } {
  if (s.exterior || s.type === "caracol") return { entry: cap, exit: cap };
  const g = stairGeometry(s, FLOOR_STEP),
    first = g.steps[0],
    last = g.steps[g.steps.length - 1];
  if (!first || !last) return { entry: cap, exit: cap };
  const exteriorHalf = exteriorThickness(c.finish) / 2,
    edge = (t: typeof first, sign: 1 | -1) => {
      const forward = { x: -Math.sin(t.rotation), z: Math.cos(t.rotation) },
        lateral = { x: Math.cos(t.rotation), z: Math.sin(t.rotation) },
        origin = { x: t.x + sign * forward.x * (g.tread / 2), z: t.z + sign * forward.z * (g.tread / 2) };
      return { origin, forward: { x: sign * forward.x, z: sign * forward.z }, lateral };
    };
  const clearAhead = (t: typeof first, sign: 1 | -1, floor: number) => {
    const e = edge(t, sign),
      walls = c.walls[floor] ?? [],
      boxes: Box2[] = [
        ...c.stairs.filter((o) => !o.exterior && o.id !== s.id && o.floor === floor).map((o) => bounds(stairGeometry(o, FLOOR_STEP).footprint)),
        ...c.stairs.filter((o) => !o.exterior && o.id !== s.id && o.floor === floor - 1).map((o) => bounds(stairGeometry(o, FLOOR_STEP).hole)),
        ...[...c.fixtures, ...c.counters]
          .filter((f) => f.floor === floor)
          .map((f) => {
            const r = "kind" in f && "length" in f ? Math.max((f as Counter).length, (f as Counter).depth) / 2 : Math.max(FIXTURE_SIZES[(f as Fixture).kind].width, FIXTURE_SIZES[(f as Fixture).kind].depth) / 2;
            return { minX: f.x - r, maxX: f.x + r, minZ: f.z - r, maxZ: f.z + r };
          }),
      ];
    let best = cap;
    for (const side of [-0.28, 0, 0.28]) {
      const base = transformPoint({ x: e.origin.x + e.lateral.x * side, z: e.origin.z + e.lateral.z * side }, s.x, s.z, s.rotation),
        dir = transformPoint(e.forward, 0, 0, s.rotation),
        dir0 = transformPoint({ x: 0, z: 0 }, 0, 0, s.rotation),
        step = { x: dir.x - dir0.x, z: dir.z - dir0.z };
      let d = 0.02;
      for (; d < best; d += 0.04) {
        const q = { x: base.x + step.x * d, z: base.z + step.z * d };
        const blocked =
          !inside(q, c.contour, false) ||
          edgesOf(c.contour).some(([a, b]) => distance(project(q, a, b).point, q) < exteriorHalf) ||
          walls.some((w) => distance(project(q, w.a, w.b).point, q) < w.thickness / 2) ||
          boxes.some((o) => q.x > o.minX && q.x < o.maxX && q.z > o.minZ && q.z < o.maxZ);
        if (blocked) break;
      }
      best = Math.min(best, d);
    }
    return best;
  };
  return { entry: clearAhead(first, -1, s.floor), exit: clearAhead(last, 1, s.floor + 1) };
}
const edgesOf = (ring: Point[]): [Point, Point][] => ring.map((p, i) => [p, ring[(i + 1) % ring.length] ?? p]);
/** Searches the floor for the closest-to-a-wall position where an interior stair fits without conflicts. */
export function findStairSpot(c: HouseConfig, floor: number, prefer?: Stair, id = `stair-${floor}`): Stair | null {
  if (floor < 0 || floor >= c.floors - 1) return null;
  const b = bounds(c.contour), door = exteriorSegments(c.contour)[2];
  const doorPoint = door ? { x: (door.a.x + door.b.x) / 2, z: (door.a.z + door.b.z) / 2 } : null;
  const make = (x: number, z: number, rotation: number, type: Stair["type"]): Stair => ({ id, floor, x, z, rotation, width: type === "caracol" ? 0.75 : 0.9, type, reverse: false, closed: false, exterior: false, rail: true });
  const free = (s: Stair) => {
    if (stairConflict(c, s)) return false;
    if (floor === 0 && doorPoint) {
      const fp = bounds(stairGeometry(s, FLOOR_STEP).footprint);
      if (overlaps(fp, { minX: doorPoint.x - 0.9, maxX: doorPoint.x + 0.9, minZ: doorPoint.z - 1.4, maxZ: doorPoint.z + 1.4 })) return false;
    }
    return true;
  };
  const below = c.stairs.find((v) => !v.exterior && v.floor === floor - 1 && v.type === "caracol");
  for (const p of [prefer, below]) if (p) {
    const same = { ...make(p.x, p.z, p.rotation, p.type), width: p.width };
    if (free(same)) return same;
  }
  const candidates: { s: Stair; score: number }[] = [];
  for (const type of ["U", "L", "recta", "caracol"] as const)
    for (const rotation of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])
      for (let x = b.minX; x <= b.maxX; x += 0.25)
        for (let z = b.minZ; z <= b.maxZ; z += 0.25) {
          const s = make(Number(x.toFixed(2)), Number(z.toFixed(2)), rotation, type),
            fp = bounds(stairGeometry(s, FLOOR_STEP).footprint);
          if (fp.minX < b.minX || fp.maxX > b.maxX || fp.minZ < b.minZ || fp.maxZ > b.maxZ) continue;
          const t = GEOMETRY.exteriorThickness / 2,
            gaps = [fp.minX - b.minX - t, b.maxX - t - fp.maxX, fp.minZ - b.minZ - t, b.maxZ - t - fp.maxZ].sort((p, q) => p - q);
          if ((gaps[0] ?? 0) < -1e-6) continue;
          candidates.push({ s, score: (gaps[0] ?? 0) + (gaps[1] ?? 0) * 0.5 + (type === "U" ? 0 : type === "L" ? 0.3 : type === "recta" ? 0.6 : 1.5) });
        }
  candidates.sort((p, q) => p.score - q.score);
  // Primero las que dejan un descanso libre de 1 m frente a la entrada y la salida (no sube de cara a una pared); si la casa
  // es tan chica que no hay, las de 0,85 m, y recién después cualquiera que entre.
  const fits = candidates.filter((v) => free(v.s)).map((v) => v.s);
  const prev = c.stairs.find((o) => !o.exterior && o.floor === floor - 1);
  for (const need of [1, 0.85]) {
    const found = fits.find((v) => {
      const l = stairLanding(c, v, need);
      if (l.entry < need - 1e-6 || l.exit < need - 1e-6) return false;
      // La escalera de abajo desemboca en esta planta: la nueva no puede quedar justo delante de su salida.
      return !prev || stairLanding({ ...c, stairs: [...c.stairs, v] }, prev, need).exit >= need - 1e-6;
    });
    if (found) return found;
  }
  return fits[0] ?? null;
}
/** Bedrooms/bathrooms that actually fit with the current area and floors. */
export function placedRooms(c: HouseConfig) {
  return {
    bedrooms: c.fixtures.filter((f) => f.kind === "cama").length,
    bathrooms: c.fixtures.filter((f) => f.kind === "wc").length,
  };
}
/** Name rooms by the furniture inside them; user labels win. */
/** Clave del nombre de un ambiente: en la planta baja es el id del ambiente; en las superiores lleva el número de planta. */
export const roomLabelKey = (floor: number, id: string) => (floor === 0 ? id : `${floor}:${id}`);
export function roomName(c: HouseConfig, floor: number, room: { id: string; polygon: Point[] }, index: number) {
  const label = c.roomLabels[roomLabelKey(floor, room.id)] ?? (floor === 0 ? undefined : c.roomLabels[room.id]);
  if (label) return label;
  const kinds = c.fixtures.filter((f) => f.floor === floor && inside(f, room.polygon)).map((f) => f.kind);
  if (kinds.includes("wc") || kinds.includes("ducha")) return "Baño";
  if (kinds.includes("cama")) return "Dormitorio";
  return floor === 0 && index === 0 ? "Cocina-living-comedor" : floor === 0 ? "Cocina-living-comedor" : "Estar";
}
/**
 * Builds a complete design from one explicit dimensioned proposal (the "Distribuciones"
 * gallery and the initial design). Shared wall runs are merged once, then every opening
 * is validated against the resulting walls. Lives here because the store builds its own
 * first design at load time and must never import a module that imports the store.
 */
function buildClassicProposal(current: HouseConfig, proposal: LayoutProposal): HouseConfig {
  const { width, depth } = proposal;
  const p = (x: number, z: number): Point => ({ x: x - width / 2, z: z - depth / 2 });
  const contour = [p(0, 0), p(width, 0), p(width, depth), p(0, depth)];
  const segments: [Point, Point][] = [];
  for (const r of proposal.rooms) segments.push([p(r.x, r.z), p(r.x + r.w, r.z)], [p(r.x + r.w, r.z), p(r.x + r.w, r.z + r.d)], [p(r.x + r.w, r.z + r.d), p(r.x, r.z + r.d)], [p(r.x, r.z + r.d), p(r.x, r.z)]);
  for (const [a, b] of proposal.extra ?? []) segments.push([p(a.x, a.z), p(b.x, b.z)]);
  // Merge collinear room boundaries so shared walls are never doubled.
  const groups = new Map<string, { horizontal: boolean; constant: number; ranges: [number, number][] }>();
  for (const [a, b] of segments) {
    const horizontal = Math.abs(a.z - b.z) < 1e-6, constant = horizontal ? a.z : a.x;
    if ((horizontal && Math.abs(constant) === depth / 2) || (!horizontal && Math.abs(constant) === width / 2)) continue;
    const key = `${horizontal}-${constant.toFixed(6)}`, g = groups.get(key) ?? { horizontal, constant, ranges: [] };
    g.ranges.push([Math.min(horizontal ? a.x : a.z, horizontal ? b.x : b.z), Math.max(horizontal ? a.x : a.z, horizontal ? b.x : b.z)]);
    groups.set(key, g);
  }
  const walls: Segment[] = [];
  for (const g of groups.values()) {
    const merged: [number, number][] = [];
    for (const range of g.ranges.sort((a, b) => a[0] - b[0])) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], range[1]); else merged.push([...range]);
    }
    for (const [a, b] of merged) walls.push({ id: `wall-proposal-${walls.length}`, a: g.horizontal ? { x: a, z: g.constant } : { x: g.constant, z: a }, b: g.horizontal ? { x: b, z: g.constant } : { x: g.constant, z: b }, thickness: 0.1, height: 2.65 });
  }
  const c: HouseConfig = { ...current, contour, m2: polygonArea(contour), floors: 1, footprint: "rectangular", shape: depth > width ? "alargada" : "compacta", bedrooms: proposal.bedrooms, bathrooms: proposal.bathrooms, walls: [walls], fixtures: [], counters: [], stairs: [entranceStair()], openings: [], roomLabels: {} };
  for (const [i, r] of proposal.rooms.entries()) {
    if (r.kind === "bed") c.fixtures.push({ id: `fixture-proposal-bed-${i}`, kind: "cama", floor: 0, ...p(r.x + r.w / 2, r.z + 1.15), rotation: 0 });
    else {
      c.fixtures.push({ id: `fixture-proposal-wc-${i}`, kind: "wc", floor: 0, ...p(r.x + 0.5, r.z + 0.5), rotation: 0 }, { id: `fixture-proposal-shower-${i}`, kind: "ducha", floor: 0, ...p(r.x + r.w - 0.6, r.z + 0.6), rotation: 0 });
      c.counters.push({ id: `counter-proposal-bath-${i}`, kind: "bano", material: "pino", floor: 0, ...p(r.x + 0.35, r.z + r.d - 0.75), rotation: Math.PI / 2, length: 0.9, depth: 0.5, height: 0.85, shape: "lineal" });
    }
  }
  c.counters.push({ id: "counter-proposal-kitchen", kind: "cocina", material: "pino", floor: 0, ...p(width - 0.4, depth - 1.6), rotation: Math.PI / 2, length: 2.4, depth: 0.6, height: 0.9, shape: "lineal" });
  const addOpening = (point: Point, type: Opening["type"], interior: boolean) => {
    const wall = designWalls(c, 0).find(w => w.id.startsWith("wall-") === interior && distance(project(point, w.a, w.b).point, point) < 1e-6);
    if (!wall) return;
    const offset = project(point, wall.a, wall.b).t * distance(wall.a, wall.b) - distance(wall.a, wall.b) / 2;
    if (c.openings.some(o => o.wall === wall.id && Math.abs(o.offset - offset) < 0.05)) return;
    const o: Opening = { id: `opening-proposal-${c.openings.length}`, wall: wall.id as WallId, floor: 0, type, offset, manual: false };
    if (!validateOpening(c, o)) c.openings.push(o);
  };
  for (const r of proposal.rooms) {
    if (r.door) addOpening(p(r.door.x, r.door.z), "interior", true);
    if (r.z === 0) addOpening(p(r.x + r.w / 2, 0), "ventana", false);
    else if (r.x === 0) addOpening(p(0, r.z + r.d / 2), "ventana", false);
  }
  if (proposal.id === "longitudinal") addOpening(p(4.4, 5.3), "interior", true);
  addOpening(p(proposal.id === "longitudinal" ? 3.85 : width / 2, depth), "ventanal", false);
  addOpening(p(proposal.id === "longitudinal" ? 3.85 : width / 2, depth), "entrada", false);
  // Kitchen window (120 x 40 cm) on the kitchen wall, centered on the counter.
  addOpening(p(width, depth - 1.6), "ventanaCocina", false);
  for (const room of detectRooms(contour, walls)) {
    const box = proposal.rooms.find(r => inside(p(r.x + r.w / 2, r.z + r.d / 2), room.polygon));
    c.roomLabels[room.id] = box?.name ?? (proposal.id === "longitudinal" && room.center.x < 0.4 ? "Circulación" : "Cocina-living-comedor");
  }
  return c;
}
type Run = [number, number];
const runKey = (horizontal: boolean, constant: number) => `${horizontal ? "h" : "v"}${constant.toFixed(4)}`;
function axisRun(a: Point, b: Point) {
  const horizontal = Math.abs(a.z - b.z) < 1e-6;
  if (!horizontal && Math.abs(a.x - b.x) > 1e-6) return null;
  const constant = horizontal ? a.z : a.x,
    u = horizontal ? [a.x, b.x] : [a.z, b.z];
  return { horizontal, constant, key: runKey(horizontal, constant), run: [Math.min(u[0]!, u[1]!), Math.max(u[0]!, u[1]!)] as Run };
}
/**
 * Muros interiores de una planta a partir de los bordes de los ambientes y los tabiques sueltos: los tramos alineados se
 * unen en un solo muro (un muro compartido nunca se duplica) y se descarta lo que ya es muro exterior del contorno.
 */
function planWalls(floor: number, segments: [Point, Point][], contour: Point[]): Segment[] {
  const groups = new Map<string, { horizontal: boolean; constant: number; runs: Run[] }>();
  for (const [a, b] of segments) {
    const r = axisRun(a, b);
    if (!r) continue;
    const g = groups.get(r.key) ?? { horizontal: r.horizontal, constant: r.constant, runs: [] };
    g.runs.push(r.run);
    groups.set(r.key, g);
  }
  const cuts = new Map<string, Run[]>();
  contour.forEach((a, i) => {
    const r = axisRun(a, contour[(i + 1) % contour.length] ?? a);
    if (r) cuts.set(r.key, [...(cuts.get(r.key) ?? []), r.run]);
  });
  const out: Segment[] = [];
  for (const [key, g] of groups) {
    const merged: Run[] = [];
    for (const run of g.runs.sort((p, q) => p[0] - q[0])) {
      const last = merged.at(-1);
      if (last && run[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], run[1]);
      else merged.push([run[0], run[1]]);
    }
    let runs = merged;
    for (const cut of cuts.get(key) ?? [])
      runs = runs.flatMap(([a, b]): Run[] =>
        cut[1] <= a + 1e-6 || cut[0] >= b - 1e-6
          ? [[a, b]]
          : ([[a, Math.min(b, cut[0])], [Math.max(a, cut[1]), b]] as Run[]).filter((r) => r[1] - r[0] > 1e-6),
      );
    for (const [a, b] of runs)
      out.push({
        id: `wall-proposal-${floor}-${out.length}`,
        a: g.horizontal ? { x: a, z: g.constant } : { x: g.constant, z: a },
        b: g.horizontal ? { x: b, z: g.constant } : { x: g.constant, z: b },
        thickness: GEOMETRY.interiorThickness,
        height: WALL_HEIGHT,
      });
  }
  return out;
}
const STAIR_OPEN: Record<"N" | "E" | "S" | "W", number> = { N: 0, E: Math.PI / 2, S: Math.PI, W: (3 * Math.PI) / 2 };
const cm = (v: number) => Number(v.toFixed(4));
/**
 * Arma un diseño completo a partir de una propuesta con datos explícitos: contorno (rectangular o en L), una a tres
 * plantas, ambientes con sus puertas y artefactos, mesadas, aberturas y escaleras. Las aberturas se validan una por una
 * contra los muros resultantes, igual que en las propuestas originales.
 */
export function buildPlan(current: HouseConfig, proposal: LayoutProposal): HouseConfig {
  const { width, depth } = proposal,
    q = (x: number, z: number): Point => ({ x: x - width / 2, z: z - depth / 2 }),
    outline = proposal.contour ?? [{ x: 0, z: 0 }, { x: width, z: 0 }, { x: width, z: depth }, { x: 0, z: depth }],
    contour = outline.map((v) => q(v.x, v.z)),
    levels = planLevels(proposal),
    floors = Math.min(3, levels.length),
    walls: Segment[][] = [],
    fixtures: Fixture[] = [],
    counters: Counter[] = [],
    openings: Opening[] = [],
    roomLabels: Record<string, string> = {};
  const c: HouseConfig = {
    ...current,
    contour,
    m2: Number((polygonArea(contour) * floors).toFixed(6)),
    floors,
    footprint: proposal.footprint ?? "rectangular",
    shape: depth > width ? "alargada" : "compacta",
    walls,
    fixtures,
    counters,
    openings,
    stairs: [],
    roomLabels,
  };
  const boxEdges = (r: RoomBox): [Point, Point][] => {
    const a = q(r.x, r.z), b = q(r.x + r.w, r.z), d = q(r.x + r.w, r.z + r.d), e = q(r.x, r.z + r.d);
    return [[a, b], [b, d], [d, e], [e, a]];
  };
  levels.slice(0, floors).forEach((level, f) => {
    walls.push(planWalls(f, [...level.rooms.flatMap(boxEdges), ...(level.extra ?? []).map(([a, b]): [Point, Point] => [q(a.x, a.z), q(b.x, b.z)])], contour));
    level.rooms.forEach((r, i) => {
      const flip = r.flip === true, zAt = (dz: number) => (flip ? r.z + r.d - dz : r.z + dz);
      if (r.kind === "bed")
        fixtures.push({ id: `fixture-proposal-${f}-bed-${i}`, kind: "cama", floor: f, ...q(r.bedX ?? r.x + r.w / 2, zAt(1.15)), rotation: flip ? Math.PI : 0 });
      if (r.kind === "bath") {
        fixtures.push(
          { id: `fixture-proposal-${f}-wc-${i}`, kind: "wc", floor: f, ...q(r.x + 0.5, zAt(0.5)), rotation: flip ? Math.PI : 0 },
          { id: `fixture-proposal-${f}-shower-${i}`, kind: "ducha", floor: f, ...q(r.x + r.w - 0.6, zAt(0.6)), rotation: 0 },
        );
        counters.push({ id: `counter-proposal-${f}-bath-${i}`, kind: "bano", material: "pino", floor: f, ...q(r.x + 0.35, flip ? r.z + 0.75 : r.z + r.d - 0.75), rotation: Math.PI / 2, length: 0.9, depth: 0.5, height: 0.85, shape: "lineal" });
      }
    });
    (level.counters ?? []).forEach((k, i) =>
      counters.push({ id: `counter-proposal-${f}-kitchen-${i}`, kind: "cocina", material: "pino", floor: f, ...q(k.x, k.z), rotation: k.rotation ?? 0, length: k.length, depth: 0.6, height: 0.9, shape: "lineal" }),
    );
  });
  const place = (floor: number, at: Point, type: OpeningType) => {
    const interior = OPENINGS_CATALOG[type].walls === "interior",
      w = designWalls(c, floor).find((v) => v.id.startsWith("wall-") === interior && distance(project(at, v.a, v.b).point, at) < 1e-6);
    if (!w) return false;
    const length = distance(w.a, w.b),
      offset = cm(project(at, w.a, w.b).t * length - length / 2);
    if (openings.some((o) => o.floor === floor && o.wall === w.id && Math.abs(o.offset - offset) < 0.05)) return false;
    const o: Opening = { id: `opening-proposal-${openings.length}`, wall: w.id as WallId, floor, type, offset, manual: false };
    if (validateOpening(c, o)) return false;
    openings.push(o);
    return true;
  };
  // Acceso principal sobre el frente, con la escalinata de entrada centrada en la puerta.
  const stairs: Stair[] = [];
  if (proposal.entrance) {
    const at = q(proposal.entrance.x, depth);
    place(0, at, proposal.entrance.type);
    const front = exteriorSegments(contour)[2];
    const e = entranceStair(),
      offset = front ? cm(project(at, front.a, front.b).t * distance(front.a, front.b) - distance(front.a, front.b) / 2) : 0;
    stairs.push({ ...e, width: proposal.entrance.type === "ventanal" ? 2.4 : 1.5, offset });
  } else stairs.push(entranceStair());
  // Aberturas puntuales, ventanas de los ambientes y puertas interiores.
  levels.slice(0, floors).forEach((level, f) => {
    for (const [type, x, z] of level.openings ?? []) place(f, q(x, z), type);
    for (const r of level.rooms) {
      if (r.noWindow || r.kind === "kitchen") continue;
      let windows = 0;
      outline.forEach((a, i) => {
        const b = outline[(i + 1) % outline.length] ?? a;
        if (windows && r.kind === "bath") return;
        const horizontal = Math.abs(a.z - b.z) < 1e-6;
        if (!horizontal && Math.abs(a.x - b.x) > 1e-6) return;
        const k = horizontal ? a.z : a.x,
          edge = horizontal ? [r.z, r.z + r.d] : [r.x, r.x + r.w],
          along = horizontal ? [r.x, r.x + r.w] : [r.z, r.z + r.d],
          span = horizontal ? [a.x, b.x] : [a.z, b.z];
        if (!edge.some((v) => Math.abs(v - k) < 1e-6)) return;
        const lo = Math.max(along[0]!, Math.min(span[0]!, span[1]!)),
          hi = Math.min(along[1]!, Math.max(span[0]!, span[1]!));
        if (hi - lo < 1.2) return;
        const mid = (lo + hi) / 2,
          type: OpeningType = r.kind === "bed" && hi - lo >= 3.4 ? "ventanaGrande" : "ventana";
        if (place(f, horizontal ? q(mid, k) : q(k, mid), type)) windows++;
      });
    }
    for (const r of level.rooms) for (const d of r.doors ?? (r.door ? [r.door] : [])) place(f, q(d.x, d.z), "interior");
  });
  // Escaleras interiores: el rectángulo que ocupan queda donde indica la propuesta.
  (proposal.stairs ?? []).forEach((s, i) => {
    const probe: Stair = { id: "", floor: s.floor, x: 0, z: 0, rotation: STAIR_OPEN[s.open], width: s.width ?? (s.type === "caracol" ? 0.75 : 0.9), type: s.type, reverse: false, closed: false, exterior: false, rail: true },
      fp = bounds(stairGeometry(probe, FLOOR_STEP).footprint),
      target = q(s.at.x, s.at.z);
    stairs.push({ ...probe, id: `stair-proposal-${s.floor}-${i}`, x: cm(target.x - fp.minX), z: cm(target.z - fp.minZ) });
  });
  c.stairs = stairs;
  // Nombres de los ambientes: el del ambiente cerrado que contiene, o el del sector abierto.
  levels.slice(0, floors).forEach((level, f) => {
    for (const room of detectRooms(contour, walls[f] ?? [])) {
      const holes = room.holes ?? [],
        here = (p: Point) => inside(p, room.polygon) && !holes.some((h) => inside(p, h, false)),
        box = level.rooms.filter((r) => here(q(r.x + r.w / 2, r.z + r.d / 2))).sort((p, r) => p.w * p.d - r.w * r.d)[0],
        tag = (level.labels ?? []).find((l) => here(q(l.at.x, l.at.z)));
      const name = box?.name ?? tag?.name ?? level.open ?? (f === 0 ? "Cocina-living-comedor" : "Estar");
      roomLabels[roomLabelKey(f, room.id)] = name;
    }
  });
  c.bedrooms = Math.min(MAX_BEDROOMS, Math.max(1, fixtures.filter((v) => v.kind === "cama").length));
  c.bathrooms = Math.min(MAX_BATHROOMS, Math.max(1, fixtures.filter((v) => v.kind === "wc").length));
  return c;
}
/** Arma el diseño de una propuesta: las originales con sus reglas, las nuevas con datos explícitos. */
export function buildLayoutProposal(current: HouseConfig, proposal: LayoutProposal): HouseConfig {
  return proposal.version === 2 ? buildPlan(current, proposal) : buildClassicProposal(current, proposal);
}
/** Distribución con la que arranca el diseño tradicional (y a la que vuelve al reiniciar). */
export const TRADICIONAL_STARTER_ID = "tr-compacta";
/**
 * The design the viewer opens with. Woodframe: the "Compacta abierta" distribution (6 × 8 m, 48 m²).
 * Tradicional: its own starter plan (platea, Esencial, techo de chapa bajo), so "Reiniciar" never throws the user back
 * into a woodframe house.
 */
export function initialConfig(system: SystemId = "woodframe"): HouseConfig {
  const area = COMPACTA_PROPOSAL.width * COMPACTA_PROPOSAL.depth;
  const contour = presetPolygon("rectangular", area);
  const tradicional = system === "tradicional";
  const c: HouseConfig = {
    m2: area,
    floors: 1,
    shape: "compacta",
    foundation: tradicional ? DEFAULT_FOUNDATION.tradicional : "madera",
    finish: tradicional ? DEFAULT_FINISH.tradicional : "rustica",
    roofType: "dos",
    roofPitch: tradicional ? TRADICIONAL_MAX_PITCH : 20,
    openings: [],
    logistics: { ...DEFAULT_LOGISTICS },
    contour,
    footprint: "rectangular",
    walls: [[]],
    counters: [],
    fixtures: [],
    bedrooms: 1,
    bathrooms: 1,
    stairs: [],
    roomLabels: {},
    ground: "arena",
    pileHeight: GEOMETRY.pileHeight,
    orthogonal: true,
    roofDirection: "x",
    overhang: 0.25,
    position: { x: 0, z: 0 },
    rotation: 0,
  };
  const starter = tradicional ? PLAN_CATALOG.find((p) => p.id === TRADICIONAL_STARTER_ID) : undefined;
  return buildLayoutProposal(c, starter ?? COMPACTA_PROPOSAL);
}
export function resizeConfig(current: HouseConfig, patch: Partial<HouseConfig>): HouseConfig {
  const next = { ...current, ...patch };
  next.floors = Math.min(3, Math.max(1, Math.floor(next.floors)));
  const target = patch.m2 === undefined ? current.m2 : clampArea(patch.m2);
  if (!canUseFloors(target, next.floors)) next.floors = Math.max(1, Math.floor(target / 20));
  const shapeChanged = patch.shape !== undefined && patch.shape !== current.shape;
  next.contour =
    patch.contour ??
    (shapeChanged
      ? presetPolygon("rectangular", target / next.floors, next.shape === "alargada")
      : scalePolygon(current.contour, target / next.floors));
  next.m2 = Number((polygonArea(next.contour) * next.floors).toFixed(6));
  next.roofPitch = Math.min(40, Math.max(5, next.roofPitch));
  const scale = Math.sqrt(polygonArea(next.contour) / polygonArea(current.contour));
  const cb=bounds(current.contour),nb=bounds(next.contour);
  const transform=(p:Point)=>patch.contour ? {...p} : ({x:(nb.minX+nb.maxX)/2+(p.x-(cb.minX+cb.maxX)/2)*scale,z:(nb.minZ+nb.maxZ)/2+(p.z-(cb.minZ+cb.maxZ)/2)*scale});
  next.walls = Array.from({ length: next.floors }, (_, floor) =>
    (current.walls[floor] ?? []).map((w) => ({
      ...w,
      a: transform(w.a),
      b: transform(w.b),
    })),
  );
  if (patch.walls) next.walls = patch.walls;
  next.counters = (patch.counters ?? current.counters)
    .filter((v) => v.floor < next.floors)
    .map((v) => ({
      ...v,
      ...(patch.counters?{x:v.x,z:v.z}:transform(v)),
    }));
  next.fixtures = (patch.fixtures ?? current.fixtures)
    .filter((v) => v.floor < next.floors)
    .map((v) => ({ ...v, ...(patch.fixtures ? { x: v.x, z: v.z } : transform(v)) }));
  next.stairs = (patch.stairs ?? current.stairs)
    .filter((v) => (v.exterior ? v.floor < next.floors : v.floor < next.floors - 1))
    .map((v) => ({
      ...v,
      ...(patch.stairs?{x:v.x,z:v.z}:transform(v)),
    }));
  next.openings = [];
  for (const o of patch.openings ?? current.openings) {
    if (o.floor >= next.floors) continue;
    const length = wallLength(next, o.wall, o.floor),
      limit = length / 2 - OPENINGS_CATALOG[o.type].width / 2 - 0.25;
    if (limit < 0) continue;
    const candidate = {
      ...o,
      offset: snapOffset(
        Math.max(
          -limit,
          Math.min(limit, (o.offset * length) / (wallLength(current, o.wall, o.floor) || length)),
        ),
      ),
    };
    if (!validateOpening(next, candidate)) next.openings.push(candidate);
  }
  // Keep every interior stair valid: relocate the ones the change broke, add one per new floor.
  const kept: Stair[] = [];
  for (const st of next.stairs) {
    if (st.exterior) { kept.push(st); continue; }
    const probe = { ...next, stairs: kept };
    if (!stairConflict(probe, st)) kept.push(st);
    else { const moved = findStairSpot(probe, st.floor, undefined, st.id); if (moved) kept.push(moved); }
  }
  for (let floor = current.floors - 1; floor < next.floors - 1; floor++)
    if (floor >= 0 && !kept.some((v) => !v.exterior && v.floor === floor)) {
      const st = findStairSpot({ ...next, stairs: kept }, floor, undefined, `stair-${floor}-${Date.now().toString(36)}`);
      if (st) kept.push(st);
    }
  next.stairs = kept;
  // If the current interior leaves no room for a stair, redistribute rooms across floors with a stair bay.
  if (next.floors > current.floors && Array.from({ length: next.floors - 1 }, (_, f) => f).some((f) => !kept.some((v) => !v.exterior && v.floor === f)))
    return suggestedLayout({ ...next, stairs: [], openings: [] });
  if (next.floors > current.floors)
    for (const o of suggestedOpenings(next))
      if (o.floor >= current.floors && !validateOpening(next, o)) next.openings.push(o);
  return next;
}
export type HistoryEntry = { forward: Patch[]; inverse: Patch[] };
/** La propuesta del catálogo más cercana a la superficie pedida (la marcada como recomendada, si hay varias de la misma forma). */
export function closestPlan(system: SystemId, floors: number, shape: "rectangular" | "L", m2: number): LayoutProposal | undefined {
  return recommendedPlan(system, floors, shape, m2);
}
/**
 * Distribución de catálogo que corresponde a "Distribución sugerida" cuando la casa tiene una forma proyectada:
 * la huella de la Compacta abierta (6 × 8 m, una planta) o un contorno en L. Con cualquier otra huella no hay propuesta
 * y se genera la distribución automática.
 */
export function startingPlan(c: HouseConfig): HouseConfig | undefined {
  const system = systemOf(c.finish);
  if (isLShape(c.contour)) {
    const plan = closestPlan(system, c.floors, "L", c.m2);
    return plan && buildLayoutProposal(c, plan);
  }
  const d = houseDimensions(c);
  if (c.floors === 1 && Math.abs(d.width - COMPACTA_PROPOSAL.width) < 1e-6 && Math.abs(d.depth - COMPACTA_PROPOSAL.depth) < 1e-6) {
    const plan = system === "tradicional" ? PLAN_CATALOG.find((p) => p.id === TRADICIONAL_STARTER_ID) : COMPACTA_PROPOSAL;
    return buildLayoutProposal(c, plan ?? COMPACTA_PROPOSAL);
  }
  return undefined;
}
export type ToolId ="select" | "contour" | "wall" | "opening" | "stair" | "counter" | "measure";

type ConfiguratorStore = {
  config: HouseConfig;
  past: HistoryEntry[];
  future: HistoryEntry[];
  tool: ToolId;
  editing: boolean;
  view: ViewId;
  activeFloor: number;
  selectedId: string | null;
  placing: OpeningType | null;
  error: string | null;
  underHouse: boolean;
  setTool: (v: ToolId) => void;
  setEditing: (v: boolean) => void;
  replaceDesign: (c: HouseConfig) => void;
  layout: (blank: boolean) => void;
  /** Forma de la casa: rectangular compacta o alargada, o en L (con su propia distribución). */
  applyShape: (shape: "compacta" | "alargada" | "L") => void;
  setContour: (p: Point[]) => boolean;
  addWall: (a: Point, b: Point) => void;
  editWall: (id: string, patch: Partial<Segment>) => void;
  splitWall: (id: string) => void;
  addCounter: () => void;
  editCounter: (id: string, patch: Partial<Counter>) => void;
  addFixture: (kind: FixtureKind) => void;
  editFixture: (id: string, patch: Partial<Fixture>) => void;
  setRooms: (patch: { bedrooms?: number; bathrooms?: number }) => void;
  addStair: (exterior?: boolean) => void;
  editStair: (id: string, patch: Partial<Stair>) => boolean;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  update: (patch: Partial<HouseConfig>) => void;
  undo: () => void;
  redo: () => void;
  setView: (v: ViewId) => void;
  setFloor: (v: number) => void;
  select: (id: string | null) => void;
  setPlacing: (type: OpeningType | null) => void;
  setError: (v: string | null) => void;
  toggleUnder: () => void;
  addOpening: (o: Omit<Opening, "id" | "manual">) => boolean;
  editOpening: (id: string, patch: Partial<Opening>) => boolean;
  deleteOpening: (id: string) => void;
  duplicateOpening: (id: string) => void;
  reset: () => void;
};
export const useConfigurator = create<ConfiguratorStore>((set, get) => {
  const commit = (config: HouseConfig) => {
    if(config.walls.some(ws=>ws.some(w=>!segmentInside(w.a,w.b,config.contour)))){set({error:"El contorno dejaría una pared interior fuera de la casa. Movela o eliminala primero."});return false;}
    const invalid = config.stairs.map(v=>stairConflict(config,v)).find(Boolean);
    if(invalid){set({error:invalid});return false;}
    if(config.roofType==='dos'&&!config.contour.every((p,i)=>{const q=config.contour[(i+1)%config.contour.length];return q&&(Math.abs(p.x-q.x)<1e-6||Math.abs(p.z-q.z)<1e-6);}))config={...config,roofType:'una'};
    const [next, forward, inverse] = produceWithPatches(get().config, () => config);
    if (!forward.length) return true;
    set((s) => ({
      config: next,
      past: [...s.past, { forward, inverse }],
      future: [],
      error: null,
      activeFloor: Math.min(s.activeFloor, config.floors - 1),
    }));
    return true;
  };
  return {
    config: initialConfig(),
    past: [],
    future: [],
    view: "exterior",
    activeFloor: 0,
    selectedId: null,
    placing: null,
    error: null,
    underHouse: false,
    tool: "select",
    editing: false,
    setTool: (tool) => set({ tool, selectedId: null, placing: null }),
    setEditing: (editing) => set({ editing }),
    replaceDesign: (config) => {
      commit(config);
      set({ selectedId: null, activeFloor: 0 });
    },
    layout: (blank) => {
      const c = get().config;
      commit(
        blank
          ? {
              ...c,
              walls: Array.from({ length: c.floors }, () => []),
              counters: [],
              fixtures: [],
              stairs: [],
              openings: [],
              roomLabels: {},
            }
          : startingPlan(c) ?? suggestedLayout(c),
      );
    },
    update: (requested) => {
      const current = get().config;
      // La base y el techo tienen que corresponder a la terminación (por ejemplo, la Clásica lleva losa plana):
      // se adaptan solos cuando se cambia de terminación o de sistema.
      // Todo diseño tradicional arranca con platea y con un techo de chapa bajo; si el cambio ya trae su propia base o
      // pendiente, esa es la que vale.
      const toTradicional =
        requested.finish !== undefined &&
        systemOf(requested.finish) === "tradicional" &&
        systemOf(current.finish) !== "tradicional";
      const asked: Partial<HouseConfig> = toTradicional
        ? {
            ...(requested.foundation === undefined ? { foundation: DEFAULT_FOUNDATION.tradicional } : {}),
            ...(requested.roofPitch === undefined && current.roofPitch > TRADICIONAL_MAX_PITCH
              ? { roofPitch: TRADICIONAL_MAX_PITCH }
              : {}),
            ...requested,
          }
        : requested;
      const merged = { ...current, ...asked },
        fitted = coherentSystem(merged);
      const patch: Partial<HouseConfig> = {
        ...asked,
        ...(fitted.foundation !== merged.foundation ? { foundation: fitted.foundation } : {}),
        ...(fitted.roofType !== merged.roofType ? { roofType: fitted.roofType } : {}),
      };
      // Changing only the floor count keeps the ground-floor footprint and layout, adding/removing upper floors.
      const floorsOnly = patch.floors !== undefined && Object.keys(patch).length === 1;
      const footprint = polygonArea(current.contour);
      let next = floorsOnly
        ? resizeConfig(current, { floors: patch.floors!, m2: Math.min(GEOMETRY.maxArea, footprint * Math.min(3, Math.max(1, Math.floor(patch.floors!)))) })
        : resizeConfig(current, patch);
      const placed = placedRooms(next);
      if ((!floorsOnly && patch.floors !== undefined && next.floors !== current.floors) || ((patch.m2 !== undefined || patch.shape !== undefined) && !floorsOnly && (placed.bedrooms < next.bedrooms || placed.bathrooms < next.bathrooms)))
        next = suggestedLayout(next);
      const error = validateContour(next.contour, next.floors);
      if (error) {
        set({ error });
        return;
      }
      commit(next);
    },
    setContour: (contour) => {
      const c = get().config,
        error = validateContour(contour, c.floors);
      if (error) {
        set({ error });
        return false;
      }
      return commit(resizeConfig(c, { contour }));
    },
    addWall: (a, b) => {
      const c = get().config,
        f = get().activeFloor;
      if (distance(a, b) < 0.2 || !segmentInside(a, b, c.contour)) {
        set({ error: "La pared debe quedar dentro de la casa." });
        return;
      }
      const walls = c.walls.map((ws) => [...ws]);
      if(wallOverlap({id:'new',a,b,thickness:GEOMETRY.interiorThickness,height:WALL_HEIGHT},designWalls(c,f))){set({error:"Las paredes no pueden superponerse."});return;}
      walls[f]?.push({
        id: `wall-${crypto.randomUUID()}`,
        a,
        b,
        thickness: GEOMETRY.interiorThickness,
        height: WALL_HEIGHT,
      });
      commit({ ...c, walls });
    },
    editWall: (id, patch) => {
      const c = get().config,
        w = c.walls.flat().find((w) => w.id === id);
      if (!w || (w.locked && patch.locked !== false)) return;
      const candidate = { ...w, ...patch };
      const floor=c.walls.findIndex(ws=>ws.some(v=>v.id===id));
      if(wallOverlap(candidate,designWalls(c,floor))){set({error:"Las paredes no pueden superponerse."});return;}
      if (
        !segmentInside(candidate.a, candidate.b, c.contour) ||
        distance(candidate.a, candidate.b) < 0.2
      ) {
        set({ error: "La pared debe quedar dentro de la casa." });
        return;
      }
      const walls = c.walls.map((ws) => ws.map((v) => (v.id === id ? candidate : v)));
      const next=resizeConfig(c,{walls});
      if(commit(next)&&next.openings.length<c.openings.length)set({error:"Una abertura ya no cabe en este muro. Podés recuperarla con deshacer."});
    },
    splitWall: id => {
      const c=get().config,w=c.walls.flat().find(w=>w.id===id);if(!w||w.locked)return;
      const length=distance(w.a,w.b),mid={x:(w.a.x+w.b.x)/2,z:(w.a.z+w.b.z)/2},newId=`wall-${crypto.randomUUID()}`;
      if(c.openings.some(o=>o.wall===id&&Math.abs(o.offset)<OPENINGS_CATALOG[o.type].width/2+0.25)){set({error:"El corte atraviesa una abertura. Movela antes de cortar."});return;}
      commit({...c,walls:c.walls.map(ws=>ws.flatMap(v=>v.id===id?[{...v,b:mid},{...v,id:newId,a:mid}]:[v])),openings:c.openings.map(o=>o.wall!==id?o:{...o,wall:o.offset<0?id as WallId:newId as WallId,offset:o.offset+(o.offset<0?length/4:-length/4)})});
    },
    addCounter: () => {
      const c = get().config;
      const room = detectRooms(c.contour, c.walls[get().activeFloor] ?? [])[0];
      const p = room?.center ?? { x: 0, z: 0 };
      const v: Counter = {
        id: `counter-${crypto.randomUUID()}`,
        floor: get().activeFloor,
        ...p,
        rotation: 0,
        length: 1.8,
        depth: 0.6,
        height: 0.9,
        kind: "cocina",
        material: "pino",
        shape: "lineal",
      };
      commit({ ...c, counters: [...c.counters, v] });
      set({ selectedId: v.id });
    },
    addFixture: (kind) => {
      const c = get().config,
        floor = get().activeFloor,
        room = detectRooms(c.contour, c.walls[floor] ?? [])[0],
        p = room?.center ?? { x: 0, z: 0 },
        v: Fixture = { id: `fixture-${kind}-${crypto.randomUUID()}`, floor, kind, x: p.x, z: p.z, rotation: 0 };
      commit({ ...c, fixtures: [...c.fixtures, v] });
      set({ selectedId: v.id });
    },
    editFixture: (id, patch) => {
      const c = get().config;
      commit({
        ...c,
        fixtures: c.fixtures.map((v) => (v.id === id && (!v.locked || patch.locked === false) ? { ...v, ...patch } : v)),
      });
    },
    setRooms: (patch) => {
      const c = get().config,
        bedrooms = Math.min(MAX_BEDROOMS, Math.max(1, Math.round(patch.bedrooms ?? c.bedrooms))),
        bathrooms = Math.min(MAX_BATHROOMS, Math.max(1, Math.round(patch.bathrooms ?? c.bathrooms)));
      commit(suggestedLayout({ ...c, bedrooms, bathrooms }));
      set({ selectedId: null });
    },
    editCounter: (id, patch) => {
      const c = get().config;
      commit({
        ...c,
        counters: c.counters.map((v) => (v.id === id && (!v.locked || patch.locked === false) ? { ...v, ...patch } : v)),
      });
    },
    addStair: (exterior = false) => {
      const c = get().config,
        f = Math.min(get().activeFloor, c.floors - 2);
      if (!exterior && f < 0) {
        set({ error: "Agregá una segunda planta para colocar una escalera interior." });
        return;
      }
      const id = `stair-${crypto.randomUUID()}`;
      let v: Stair | null;
      if (exterior) {
        const floor = get().activeFloor,
          used = new Set(c.stairs.filter((s) => s.exterior && s.floor === floor).map((s) => s.wall ?? "edge-2")),
          edges = exteriorSegments(c.contour),
          order = ["edge-2", ...edges.map((e) => e.id).filter((e) => e !== "edge-2")],
          wall = order.find((w) => !used.has(w));
        v = wall ? { ...entranceStair(), id, floor, wall, width: floor === 0 && wall === "edge-2" ? 2.4 : 1 } : null;
        if (!v) { set({ error: "Ya hay una escalera exterior en cada pared de esta planta." }); return; }
      } else {
        v = findStairSpot(c, f, undefined, id);
        if (!v) { set({ error: "No hay lugar libre para la escalera: liberá espacio moviendo paredes o muebles." }); return; }
      }
      commit({ ...c, stairs: [...c.stairs, v] });
      set({ selectedId: v.id });
    },
    editStair: (id, patch) => {
      const c = get().config,
        v = c.stairs.find((v) => v.id === id);
      if (!v || (v.locked && patch.locked !== false)) return false;
      const candidate = { ...v, ...patch },
        error = stairConflict(c, candidate);
      if (error) {
        set({ error });
        return false;
      }
      return commit({ ...c, stairs: c.stairs.map((v) => (v.id === id ? candidate : v)) });
    },
    deleteObject: (id) => {
      const c = get().config;
      commit({
        ...c,
        walls: c.walls.map((ws) => ws.filter((v) => v.id !== id)),
        counters: c.counters.filter((v) => v.id !== id),
        fixtures: c.fixtures.filter((v) => v.id !== id),
        stairs: c.stairs.filter((v) => v.id !== id),
        openings: c.openings.filter((v) => v.id !== id && v.wall !== id),
      });
      set({ selectedId: null });
    },
    duplicateObject: (id) => {
      const c = get().config,
        co = c.counters.find((v) => v.id === id),
        st = c.stairs.find((v) => v.id === id),
        fx = c.fixtures.find((v) => v.id === id);
      if (fx) {
        const v = { ...fx, id: `fixture-${fx.kind}-${crypto.randomUUID()}`, x: fx.x + 0.4, z: fx.z + 0.4 };
        commit({ ...c, fixtures: [...c.fixtures, v] });
        set({ selectedId: v.id });
      } else if (co) {
        const v = { ...co, id: `counter-${crypto.randomUUID()}`, x: co.x + 0.3, z: co.z + 0.3 };
        commit({ ...c, counters: [...c.counters, v] });
        set({ selectedId: v.id });
      } else if (st) {
        const v = { ...st, id: `stair-${crypto.randomUUID()}`, x: st.x + 1 };
        if (!stairConflict(c, v))
          commit({ ...c, stairs: [...c.stairs, v] });
      } else get().duplicateOpening(id);
    },
    undo: () =>
      set((s) => {
        const e = s.past.at(-1);
        if (!e) return {};
        const config = applyPatches(s.config, e.inverse);
        return {
          config,
          past: s.past.slice(0, -1),
          future: [e, ...s.future],
          selectedId: null,
          error: null,
          activeFloor: Math.min(s.activeFloor, config.floors - 1),
        };
      }),
    redo: () =>
      set((s) => {
        const e = s.future[0];
        if (!e) return {};
        const config = applyPatches(s.config, e.forward);
        return {
          config,
          future: s.future.slice(1),
          past: [...s.past, e],
          selectedId: null,
          error: null,
          activeFloor: Math.min(s.activeFloor, config.floors - 1),
        };
      }),
    setView: (view) => set({ view, placing: null, selectedId: null }),
    setFloor: (activeFloor) => set({ activeFloor, selectedId: null }),
    select: (selectedId) => set({ selectedId, placing: null, error: null }),
    setPlacing: (placing) =>
      set({ placing, tool: placing ? "opening" : "select", selectedId: null, error: null }),
    setError: (error) => set({ error }),
    toggleUnder: () => set((s) => ({ underHouse: !s.underHouse })),
    addOpening: (o) => {
      const candidate: Opening = {
        ...o,
        id: crypto.randomUUID(),
        offset: snapOffset(o.offset),
        manual: true,
      };
      const error = validateOpening(get().config, candidate);
      if (error) {
        set({ error });
        return false;
      }
      commit({ ...get().config, openings: [...get().config.openings, candidate] });
      set({ selectedId: candidate.id, placing: null });
      return true;
    },
    editOpening: (id, patch) => {
      const c = get().config,
        old = c.openings.find((o) => o.id === id);
      if (!old) return false;
      const candidate = {
        ...old,
        ...patch,
        id,
        offset: snapOffset(patch.offset ?? old.offset),
        manual: true,
      };
      const error = validateOpening(c, candidate, id);
      if (error) {
        set({ error });
        return false;
      }
      commit({ ...c, openings: c.openings.map((o) => (o.id === id ? candidate : o)) });
      return true;
    },
    deleteOpening: (id) => {
      commit({ ...get().config, openings: get().config.openings.filter((o) => o.id !== id) });
      set({ selectedId: null });
    },
    duplicateOpening: (id) => {
      const c = get().config,
        original = c.openings.find((o) => o.id === id);
      if (!original) return;
      const limit = wallLength(c, original.wall) / 2;
      for (let offset = -limit; offset <= limit; offset += 0.1) {
        const o = { ...original, id: "", offset: snapOffset(offset) };
        if (!validateOpening(c, o, "")) {
          get().addOpening(o);
          return;
        }
      }
      set({ error: "No queda lugar en este muro para duplicar la abertura." });
    },
    applyShape: (shape) => {
      const c = get().config,
        system = systemOf(c.finish),
        done = () => set({ selectedId: null, activeFloor: 0 });
      if (shape === "L") {
        if (isLShape(c.contour)) return;
        // Cada sistema y cantidad de plantas tiene su propia distribución en L, proyectada para ese contorno.
        const plan = closestPlan(system, c.floors, "L", c.m2);
        if (!plan) {
          set({ error: "Todavía no hay una distribución en L para esta cantidad de plantas." });
          return;
        }
        if (commit(buildLayoutProposal(c, plan))) done();
        return;
      }
      if (!isLShape(c.contour) && c.shape === shape) return;
      // Cambiar la proporción del rectángulo (o salir de la L) arma la distribución de nuevo para esa huella: los tabiques
      // de la anterior no calzarían en el contorno nuevo. Se puede deshacer.
      const contour = presetPolygon("rectangular", c.m2 / c.floors, shape === "alargada");
      const rect: HouseConfig = {
        ...c,
        shape,
        footprint: "rectangular",
        contour,
        m2: Number((polygonArea(contour) * c.floors).toFixed(6)),
        walls: Array.from({ length: c.floors }, () => []),
        fixtures: [],
        counters: [],
        stairs: [],
        openings: [],
        roomLabels: {},
      };
      if (commit(suggestedLayout(rect))) done();
    },
    // Reiniciar vuelve al diseño de arranque del sistema que se está usando: un tradicional no salta a woodframe.
    reset: () => {
      commit(initialConfig(systemOf(get().config.finish)));
      set({ view: "exterior", activeFloor: 0, selectedId: null, placing: null });
    },
  };
});

const pointSchema = z.object({ x: z.number().finite(), z: z.number().finite() });
const designSchema = z
  .object({
    m2: z.number().min(GEOMETRY.minArea).max(GEOMETRY.maxArea),
    floors: z.number().int().min(1).max(3),
    contour: z.array(pointSchema).min(3).max(100),
    walls: z
      .array(
        z
          .array(
            z
              .object({
                id: z.string(),
                a: pointSchema,
                b: pointSchema,
                thickness: z.number().min(0.05).max(0.5),
                height: z.number().min(1).max(4),
              })
              .passthrough(),
          )
          .max(300),
      )
      .max(3),
    counters: z
      .array(
        z
          .object({
            id: z.string(),
            floor: z.number().int().min(0).max(2),
            x: z.number().finite(),
            z: z.number().finite(),
            rotation: z.number().finite(),
            length: z.number().min(0.3).max(10),
            depth: z.number().min(0.2).max(3),
            height: z.number().min(0.3).max(2),
            kind: z.enum(["cocina", "bano"]),
            material: z.enum(["pino", "drywall"]),
            shape: z.enum(["lineal", "L"]),
          })
          .passthrough(),
      )
      .max(300),
    fixtures: z
      .array(
        z
          .object({
            id: z.string(),
            floor: z.number().int().min(0).max(2),
            x: z.number().finite(),
            z: z.number().finite(),
            rotation: z.number().finite(),
            kind: z.enum(["wc", "ducha", "cama"]),
          })
          .passthrough(),
      )
      .max(100),
    bedrooms: z.number().int().min(1).max(MAX_BEDROOMS),
    bathrooms: z.number().int().min(1).max(MAX_BATHROOMS),
    stairs: z
      .array(
        z
          .object({
            id: z.string(),
            floor: z.number().int().min(0).max(2),
            x: z.number().finite(),
            z: z.number().finite(),
            rotation: z.number().finite(),
            width: z.number().min(0.6).max(2.4),
            type: z.enum(["recta", "L", "U", "caracol"]),
            reverse: z.boolean(),
            closed: z.boolean(),
            exterior: z.boolean(),
            rail: z.boolean(),
            wall: z.string().optional(),
            offset: z.number().finite().optional(),
          })
          .passthrough(),
      )
      .max(30),
    finish: z.enum(["rustica", "moderna", "allwood", "esencial", "clasica"]),
    foundation: z.enum(["hormigon", "madera", "platea"]),
    roofType: z.enum(["una", "dos", "plano"]),
    ground: z.enum(["arena", "cesped"]),
    pileHeight: z.number().min(0.25).max(2),
    orthogonal: z.boolean(),
    roofDirection: z.enum(["x", "z"]),
    overhang: z.number().min(0).max(0.8),
    position: pointSchema,
    rotation: z.number().finite(),
    openings: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(["entrada", "interior", "ventana", "ventanal", "ventanaGrande", "ventanaCocina"]),
          wall: z.string(),
          floor: z.number().int().min(0).max(2),
          offset: z.number().finite(),
          manual: z.boolean(),
        }),
      )
      .max(300),
  })
  .passthrough();
export function encodeDesign(c: HouseConfig) {
  return LZString.compressToEncodedURIComponent(JSON.stringify({ version: 2, config: c }));
}
export function decodeDesign(text: string): HouseConfig | null {
  try {
    if (text.length > 100000) return null;
    const raw = LZString.decompressFromEncodedURIComponent(text);
    if (!raw || raw.length > 1000000) return null;
    const data = JSON.parse(raw);
    const source = data.config ?? data;
    const candidate = { ...initialConfig(), ...(source.fixtures ? {} : { fixtures: [] }), ...source };
    if (!["una", "dos", "plano"].includes(candidate.roofType)) candidate.roofType = "dos";
    const parsed = designSchema.safeParse(candidate);
    if (!parsed.success) return null;
    const c = coherentSystem(parsed.data as HouseConfig);
    if (
      validateContour(c.contour, c.floors) ||
      Math.abs(polygonArea(c.contour) * c.floors - c.m2) > 0.0001
    )
      return null;
    if(c.walls.length!==c.floors||c.walls.some(ws=>ws.some(w=>!segmentInside(w.a,w.b,c.contour)||wallOverlap(w,ws)))||c.stairs.some(s=>!s.exterior&&s.floor>=c.floors-1||validateStair(s,c.contour,c.walls[s.floor+1]??[],FLOOR_STEP))||c.openings.some(o=>validateOpening(c,o)))return null;
    return c;
  } catch {
    return null;
  }
}
export function designUrl(c: HouseConfig, origin: string) {
  return `${origin.split("#")[0]?.split("?")[0]}?design=${encodeDesign(c)}#disenar`;
}
export const DESIGN_STORAGE_KEY = "sch-design-v2";
