/**
 * Puente entre el editor de planos y el diseñador 3D.
 *
 * - `planToConfig`: convierte lo dibujado (paredes, puertas, ventanas, nombres) en una casa del diseñador 3D, o explica qué falta.
 * - `configToPlan`: el camino inverso, para empezar el plano desde la casa que ya se armó en 3D.
 *
 * Vive aparte del store porque el store no puede importar módulos que lo importen a él.
 */
import { GEOMETRY, bounds, detectRooms, distance, inside, isOrthogonal, polygonArea, project, type Point, type Segment } from "@/config/geometry";
import { isLShape } from "@/config/layoutProposals";
import { type OpeningType } from "@/config/openingsCatalog";
import { analyzePlan, wallLength, type PlanAnalysis, type PlanDoc, type PlanLabel, type PlanOpening, type PlanOpeningKind, type PlanWall } from "@/config/planDraw";
import {
  WALL_HEIGHT,
  designWalls,
  entranceStair,
  resolveWall,
  roomLabelKey,
  stairConflict,
  validateOpening,
  type HouseConfig,
  type Opening,
  type WallId,
} from "@/store/useConfigurator";

export type PlanToConfig =
  | { ok: true; config: HouseConfig; warnings: string[]; analysis: PlanAnalysis }
  | { ok: false; errors: string[]; analysis: PlanAnalysis };

const clean = (n: number) => Math.round(n * 1e6) / 1e6;

/** Las puntas de los tabiques que apoyan en el borde quedan exactamente sobre él (el diseñador 3D es estricto con eso). */
function fitToContour(p: Point, contour: Point[]): Point {
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i]!, b = contour[(i + 1) % contour.length]!;
    const q = project(p, a, b).point, d = distance(q, p);
    if (d > 0 && d < 2e-3) return q;
  }
  return p;
}

/**
 * Pasa el plano a una casa del diseñador 3D. Conserva del diseño actual todo lo que el plano no define (sistema, terminación,
 * techo, fundación, logística, deck…). Una sola planta: las demás se agregan después y mantienen esta distribución.
 * Muebles y escaleras interiores no se dibujan en el plano; se agregan en 3D.
 */
export function planToConfig(doc: PlanDoc, base: HouseConfig): PlanToConfig {
  const analysis = analyzePlan(doc);
  const ring = analysis.contour;
  if (!ring || analysis.issues.length) return { ok: false, errors: analysis.issues.length ? analysis.issues : ["Todavía no hay una forma cerrada."], analysis };

  // La casa del diseñador 3D está centrada en el origen.
  const b = bounds(ring), cx = clean((b.minX + b.maxX) / 2), cz = clean((b.minZ + b.maxZ) / 2);
  const move = (p: Point): Point => ({ x: clean(p.x - cx), z: clean(p.z - cz) });
  const contour = ring.map(move);
  const walls: Segment[] = analysis.interior.map((s) => ({
    id: s.id,
    a: fitToContour(move(s.a), contour),
    b: fitToContour(move(s.b), contour),
    thickness: GEOMETRY.interiorThickness,
    height: WALL_HEIGHT,
  }));

  const area = polygonArea(contour);
  const rooms = detectRooms(contour, walls);
  const roomLabels: Record<string, string> = {};
  for (const l of doc.labels) {
    const at = move(l.at);
    const room = rooms.find((r) => inside(at, r.polygon, false) && !(r.holes ?? []).some((h) => inside(at, h)));
    if (room) roomLabels[room.id] = l.text;
  }

  const config: HouseConfig = {
    ...base,
    floors: 1,
    contour,
    m2: clean(area),
    footprint: contour.length === 4 ? "rectangular" : isLShape(contour) ? "L" : "escalonada",
    shape: b.depth > b.width ? "alargada" : "compacta",
    orthogonal: isOrthogonal(contour),
    walls: [walls],
    counters: [],
    fixtures: [],
    stairs: [],
    openings: [],
    roomLabels,
  };

  const warnings = [...analysis.warnings];
  let skipped = 0;
  for (const o of analysis.openings) {
    if (o.problem || !o.segment || !o.type) continue;
    const opening: Opening = { id: o.id, type: o.type, wall: o.segment as WallId, floor: 0, offset: clean(o.offset), manual: true };
    if (validateOpening({ ...config, openings: config.openings }, opening)) skipped++;
    else config.openings.push(opening);
  }
  if (skipped) warnings.push(skipped === 1 ? "Una abertura no entró en el diseñador 3D." : `${skipped} aberturas no entraron en el diseñador 3D.`);

  // Escalones de entrada frente a la primera puerta de entrada (o ventanal) del plano.
  const entry = config.openings.find((o) => o.type === "entrada" || o.type === "ventanal");
  if (entry && entry.wall.startsWith("edge-")) {
    const wide = entry.type === "ventanal";
    const stair = { ...entranceStair(), wall: entry.wall, offset: entry.offset, width: wide ? 2.4 : 1.4 };
    if (!stairConflict(config, stair)) config.stairs.push(stair);
  }
  return { ok: true, config, warnings, analysis };
}

const KIND_OF: Record<OpeningType, PlanOpeningKind> = {
  entrada: "puerta",
  interior: "puerta",
  ventana: "ventana",
  ventanaGrande: "ventanaGrande",
  ventanal: "ventanal",
  ventanaCocina: "ventana",
};

/** Dibuja en el plano la casa que ya está en el diseñador 3D (planta indicada). La esquina de arriba a la izquierda queda en 0,0. */
export function configToPlan(c: HouseConfig, floor = 0): PlanDoc {
  const b = bounds(c.contour);
  const shift = (p: Point): Point => ({ x: clean(p.x - b.minX), z: clean(p.z - b.minZ) });
  const segments = designWalls(c, floor);
  const idOf = (id: string) => (id.startsWith("edge-") ? `e${id.slice(5)}` : id);
  const walls: PlanWall[] = segments.map((s) => ({ id: idOf(s.id), a: shift(s.a), b: shift(s.b) }));
  const openings: PlanOpening[] = [];
  for (const o of c.openings) {
    if (o.floor !== floor) continue;
    const seg = resolveWall(c, o.wall, floor);
    if (!seg) continue;
    const plan = walls.find((w) => w.id === idOf(seg.id));
    if (plan) openings.push({ id: o.id, kind: KIND_OF[o.type], wall: plan.id, at: clean(Math.min(wallLength(plan), Math.max(0, wallLength(plan) / 2 + o.offset))) });
  }
  const labels: PlanLabel[] = [];
  for (const [i, room] of detectRooms(c.contour, c.walls[floor] ?? []).entries()) {
    const kinds = c.fixtures.filter((f) => f.floor === floor && inside(f, room.polygon)).map((f) => f.kind);
    const kitchen = c.counters.some((k) => k.floor === floor && k.kind === "cocina" && inside(k, room.polygon));
    const text =
      c.roomLabels[roomLabelKey(floor, room.id)] ??
      (kinds.includes("wc") || kinds.includes("ducha") ? "Baño" : kinds.includes("cama") ? "Dormitorio" : kitchen && !kinds.length ? "Cocina" : undefined);
    if (text) labels.push({ id: `l${i}`, at: shift(room.center), text });
  }
  return { walls, openings, labels };
}
