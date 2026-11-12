/**
 * Motor del editor de planos («Dibujar plano»): todo en metros reales (escala 1:1).
 *
 * Un plano es un conjunto de paredes dibujadas a mano (cada una con su inicio y su fin), más aberturas y nombres de ambientes.
 * De ahí se deduce solo lo que el diseñador 3D necesita: el contorno exterior (el borde de la casa), las paredes interiores,
 * los ambientes cerrados con su superficie y en qué pared exterior o interior cayó cada puerta o ventana.
 *
 * Es lógica pura (sin React ni Three): se prueba con vitest. El pasaje al diseño 3D vive en `store/planBridge.ts`.
 */
import { GEOMETRY, detectRooms, distance, inside, project, signedArea, validateContour, type Point, type Room, type Segment } from "./geometry";
import { OPENINGS_CATALOG, type OpeningType } from "./openingsCatalog";

export type PlanOpeningKind = "puerta" | "ventana" | "ventanaGrande" | "ventanal";
export type PlanWall = { id: string; a: Point; b: Point };
/** `at` = distancia en metros desde el inicio de la pared (`a`) hasta el centro de la abertura. */
export type PlanOpening = { id: string; kind: PlanOpeningKind; wall: string; at: number };
export type PlanLabel = { id: string; at: Point; text: string };
export type PlanDoc = { walls: PlanWall[]; openings: PlanOpening[]; labels: PlanLabel[] };

export const EMPTY_PLAN: PlanDoc = { walls: [], openings: [], labels: [] };
export const PLAN_OPENING_KINDS: PlanOpeningKind[] = ["puerta", "ventana", "ventanaGrande", "ventanal"];
export const PLAN_OPENING_NAMES: Record<PlanOpeningKind, string> = {
  puerta: "Puerta",
  ventana: "Ventana",
  ventanaGrande: "Ventana grande",
  ventanal: "Ventanal corredizo",
};
/** Nombres de ambientes que se ofrecen con un toque. */
export const ROOM_NAMES = ["Dormitorio", "Baño", "Cocina", "Living", "Comedor", "Lavadero", "Escritorio", "Pasillo", "Galería", "Depósito"];

export const PLAN = {
  /** Cuadrícula de dibujo: cada punto cae en múltiplos de 10 cm. */
  grid: 0.1,
  minWall: 0.2,
  maxWalls: 400,
  maxLabel: 32,
  cornerMargin: 0.25,
  openingGap: 0.15,
  /** Espesores solo para dibujar: la línea del plano es el eje de la pared. */
  exteriorLine: GEOMETRY.exteriorThickness,
  interiorLine: GEOMETRY.interiorThickness,
} as const;

const MM = 1000;
const nodeKey = (p: Point) => `${Math.round(p.x * MM)},${Math.round(p.z * MM)}`;
const edgeKey = (u: string, v: string) => (u < v ? `${u}|${v}` : `${v}|${u}`);
const same = (a: Point, b: Point, tol = 1e-3) => Math.abs(a.x - b.x) <= tol && Math.abs(a.z - b.z) <= tol;
const segDist = (p: Point, a: Point, b: Point) => distance(project(p, a, b).point, p);
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const snapTo = (n: number, step: number = PLAN.grid) => Math.round(n / step) * step;
const clean = (n: number) => Math.round(n * 1e6) / 1e6;
let counter = 0;
export const makePlanId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const wallLength = (w: Pick<PlanWall, "a" | "b">) => distance(w.a, w.b);
const unit = (a: Point, b: Point): Point => {
  const l = distance(a, b) || 1;
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
};
const rotateNormal = (d: Point): Point => ({ x: -d.z, z: d.x });

/* ───────────────────────── Grafo de paredes ───────────────────────── */

type Graph = {
  nodes: Map<string, Point>;
  adj: Map<string, Set<string>>;
  edges: Map<string, { u: string; v: string; sources: Set<string> }>;
};

/** Corte de dos paredes (cruce en X); el cruce en T y los tramos alineados se resuelven con los extremos. */
function crossing(a: Point, b: Point, c: Point, d: Point): { t: number; p: Point } | null {
  const dx = b.x - a.x, dz = b.z - a.z, ex = d.x - c.x, ez = d.z - c.z;
  const den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * ez - (c.z - a.z) * ex) / den;
  const u = ((c.x - a.x) * dz - (c.z - a.z) * dx) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { t, p: { x: a.x + t * dx, z: a.z + t * dz } };
}

function buildGraph(walls: PlanWall[]): Graph {
  const nodes = new Map<string, Point>();
  const adj = new Map<string, Set<string>>();
  const edges: Graph["edges"] = new Map();
  const reg = (p: Point) => {
    const k = nodeKey(p);
    if (!nodes.has(k)) nodes.set(k, { x: p.x, z: p.z });
    return k;
  };
  const usable = walls.filter((w) => wallLength(w) > 1e-3);
  for (const w of usable) {
    const cuts: { t: number; p: Point }[] = [{ t: 0, p: w.a }, { t: 1, p: w.b }];
    for (const o of usable) {
      if (o === w) continue;
      const hit = crossing(w.a, w.b, o.a, o.b);
      if (hit) cuts.push(hit);
      for (const v of [o.a, o.b]) {
        const pr = project(v, w.a, w.b);
        if (distance(pr.point, v) < 2e-3) cuts.push({ t: pr.t, p: v });
      }
    }
    cuts.sort((x, y) => x.t - y.t);
    for (let i = 0; i < cuts.length - 1; i++) {
      const ka = reg(cuts[i]!.p), kb = reg(cuts[i + 1]!.p);
      if (ka === kb) continue;
      const ek = edgeKey(ka, kb);
      const e = edges.get(ek);
      if (e) e.sources.add(w.id);
      else edges.set(ek, { u: ka, v: kb, sources: new Set([w.id]) });
      (adj.get(ka) ?? adj.set(ka, new Set()).get(ka)!).add(kb);
      (adj.get(kb) ?? adj.set(kb, new Set()).get(kb)!).add(ka);
    }
  }
  return { nodes, adj, edges };
}

const angle = (a: Point, b: Point) => Math.atan2(b.z - a.z, b.x - a.x);

type Face = { ring: string[]; area: number; half: Set<string>; component: number };

/** Recorre cada cara del grafo plano (mismo criterio que `detectRooms`: las caras interiores salen con área positiva). */
function traceFaces(g: Graph): { faces: Face[]; component: Map<string, number> } {
  const sorted = new Map<string, string[]>();
  for (const [k, ns] of g.adj) {
    const a = g.nodes.get(k);
    if (!a || !ns.size) continue;
    sorted.set(k, [...ns].sort((u, v) => angle(a, g.nodes.get(u)!) - angle(a, g.nodes.get(v)!)));
  }
  const component = new Map<string, number>();
  let comps = 0;
  for (const start of sorted.keys()) {
    if (component.has(start)) continue;
    const stack = [start];
    component.set(start, comps);
    while (stack.length) {
      const k = stack.pop()!;
      for (const n of sorted.get(k) ?? []) if (!component.has(n)) { component.set(n, comps); stack.push(n); }
    }
    comps++;
  }
  const used = new Set<string>();
  const faces: Face[] = [];
  const total = [...sorted.values()].reduce((s, n) => s + n.length, 0);
  for (const [start, ns] of sorted) {
    for (const next of ns) {
      if (used.has(`${start}>${next}`)) continue;
      let u = start, v = next;
      const ring: string[] = [], half = new Set<string>();
      for (let n = 0; n <= total + 1; n++) {
        const token = `${u}>${v}`;
        if (used.has(token)) break;
        used.add(token);
        half.add(token);
        ring.push(u);
        const around = sorted.get(v);
        if (!around?.length) break;
        const w = around[(around.indexOf(u) - 1 + around.length) % around.length];
        if (!w) break;
        u = v;
        v = w;
        if (u === start && v === next) break;
      }
      faces.push({ ring, half, component: component.get(start) ?? 0, area: signedArea(ring.map((k) => g.nodes.get(k)!)) });
    }
  }
  return { faces, component };
}

/** La cara exterior de cada pieza conexa: la de área más negativa (en un árbol, la única). */
function outerFaces(faces: Face[]): Face[] {
  const best = new Map<number, Face>();
  for (const f of faces) {
    const cur = best.get(f.component);
    if (!cur || f.area < cur.area) best.set(f.component, f);
  }
  return [...best.values()];
}

function dropEdge(g: Graph, u: string, v: string) {
  g.edges.delete(edgeKey(u, v));
  g.adj.get(u)?.delete(v);
  g.adj.get(v)?.delete(u);
  if (!g.adj.get(u)?.size) g.adj.delete(u);
  if (!g.adj.get(v)?.size) g.adj.delete(v);
}

/* ───────────────────────── Análisis ───────────────────────── */

export type PlanPiece = { a: Point; b: Point; kind: "exterior" | "interior" | "stray"; sources: string[] };
export type PlanSegment = { id: string; a: Point; b: Point; length: number; exterior: boolean; sources: string[] };
export type PlacedOpening = {
  id: string;
  kind: PlanOpeningKind;
  /** Tipo del catálogo del diseñador 3D, o `null` si no corresponde a esa pared. */
  type: OpeningType | null;
  /** `edge-N` (pared exterior) o `wall-pN` (interior); `null` si la pared no forma parte de la casa. */
  segment: string | null;
  /** Distancia al centro de la pared (convención del diseñador 3D). */
  offset: number;
  width: number;
  center: Point;
  dir: Point;
  /** Perpendicular que apunta hacia el interior de la casa (en paredes interiores, hacia la izquierda). */
  inward: Point;
  exterior: boolean;
  problem: string | null;
};
export type PlanRoom = { room: Room; label: PlanLabel | null };
export type PlanAnalysis = {
  /** Borde de la casa (sentido de las agujas del reloj en pantalla, como el diseñador 3D). `null` si todavía no hay una forma cerrada. */
  contour: Point[] | null;
  exterior: PlanSegment[];
  interior: PlanSegment[];
  pieces: PlanPiece[];
  rooms: PlanRoom[];
  openings: PlacedOpening[];
  /** Superficie del contorno en m². */
  area: number;
  /** Ids de paredes dibujadas que quedaron sueltas, fuera de la casa. */
  stray: string[];
  /** Lo que impide pasar el plano a 3D (vacío si se puede). */
  issues: string[];
  /** Avisos que no impiden pasarlo (aberturas que no entran, paredes sueltas…). */
  warnings: string[];
};

const nearZero = (n: number) => Math.abs(n) < 1e-9;

/** Quita los vértices de paso (180°) para que cada pared exterior sea una sola; deja intactos los picos. */
function simplifyRing(ring: Point[]): Point[] {
  let pts = ring;
  for (let changed = true; changed && pts.length > 3;) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]!, b = pts[i]!, c = pts[(i + 1) % pts.length]!;
      const ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z;
      const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
      if (nearZero(lu) || nearZero(lv)) continue;
      const cross = (ux * vz - uz * vx) / (lu * lv), dot = ux * vx + uz * vz;
      if (Math.abs(cross) < 2e-3 && dot > 0) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** Empieza por la esquina de más arriba a la izquierda: así `edge-2` es el frente (abajo), como en el diseñador 3D. */
function startAtTopLeft(ring: Point[]): Point[] {
  let best = 0;
  ring.forEach((p, i) => {
    const q = ring[best]!;
    if (p.z < q.z - 1e-6 || (Math.abs(p.z - q.z) <= 1e-6 && p.x < q.x)) best = i;
  });
  return [...ring.slice(best), ...ring.slice(0, best)];
}

function onSegment(p: Point, a: Point, b: Point, tol = 2e-3) {
  return segDist(p, a, b) < tol;
}

/** Une los tramos alineados que se tocan en un extremo: una pared larga cortada por un tabique sigue siendo una sola. */
function mergeCollinear(list: { a: Point; b: Point; sources: Set<string> }[]) {
  const items = list.map((s) => ({ a: s.a, b: s.b, sources: new Set(s.sources) }));
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const p = items[i]!, q = items[j]!;
        const du = unit(p.a, p.b), dv = unit(q.a, q.b);
        if (Math.abs(du.x * dv.z - du.z * dv.x) > 1e-6) continue;
        const ends: [Point, Point, Point, Point][] = [
          [p.a, p.b, q.a, q.b], [p.a, p.b, q.b, q.a], [p.b, p.a, q.a, q.b], [p.b, p.a, q.b, q.a],
        ];
        // [extremo libre de p, punto de unión en p, punto de unión en q, extremo libre de q]
        const hit = ends.find(([, jp, jq]) => same(jp, jq, 1e-6));
        if (!hit) continue;
        const [fp, , , fq] = hit;
        const dot = (fp.x - hit[1].x) * (fq.x - hit[1].x) + (fp.z - hit[1].z) * (fq.z - hit[1].z);
        if (dot >= 0) continue;
        items[i] = { a: fp, b: fq, sources: new Set([...p.sources, ...q.sources]) };
        items.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return items;
}

export function emptyAnalysis(): PlanAnalysis {
  return { contour: null, exterior: [], interior: [], pieces: [], rooms: [], openings: [], area: 0, stray: [], issues: [], warnings: [] };
}

export function openingWidth(kind: PlanOpeningKind, exterior: boolean): number {
  if (kind === "puerta") return OPENINGS_CATALOG[exterior ? "entrada" : "interior"].width;
  return OPENINGS_CATALOG[kind].width;
}

/** Tipo del catálogo 3D para una abertura del plano según la pared en la que cae. */
export function catalogType(kind: PlanOpeningKind, exterior: boolean): OpeningType | null {
  if (kind === "puerta") return exterior ? "entrada" : "interior";
  if (kind === "ventana") return "ventana";
  return exterior ? kind : null;
}

export function analyzePlan(doc: PlanDoc): PlanAnalysis {
  const out = emptyAnalysis();
  if (!doc.walls.length) return out;
  const g = buildGraph(doc.walls);
  const everything = [...g.edges.values()].map((e) => ({ ...e, sources: [...e.sources] }));
  if (!everything.length) return out;

  // 1. Se sacan las paredes que sobresalen hacia afuera (las que la cara exterior recorre de ida y de vuelta).
  const core: Graph = {
    nodes: g.nodes,
    adj: new Map([...g.adj].map(([k, ns]) => [k, new Set(ns)])),
    edges: new Map([...g.edges].map(([k, e]) => [k, e])),
  };
  for (let guard = 0; guard < 30; guard++) {
    const { faces } = traceFaces(core);
    let removed = 0;
    for (const f of outerFaces(faces))
      for (const token of f.half) {
        const [u, v] = token.split(">") as [string, string];
        if (f.half.has(`${v}>${u}`) && core.edges.has(edgeKey(u, v))) {
          dropEdge(core, u, v);
          removed++;
        }
      }
    if (!removed) break;
  }

  // 2. La casa es la forma cerrada más grande.
  const { faces } = traceFaces(core);
  const outers = outerFaces(faces).filter((f) => f.ring.length >= 3 && f.area < -1e-6).sort((a, b) => a.area - b.area);
  const main = outers[0];
  if (!main) {
    out.pieces = everything.map((e) => ({ a: g.nodes.get(e.u)!, b: g.nodes.get(e.v)!, kind: "stray", sources: e.sources }));
    out.issues.push("Todavía no hay una forma cerrada: uní las paredes hasta cerrar al menos una habitación.");
    return out;
  }
  if (new Set(main.ring).size !== main.ring.length) {
    out.pieces = everything.map((e) => ({ a: g.nodes.get(e.u)!, b: g.nodes.get(e.v)!, kind: "stray", sources: e.sources }));
    out.issues.push("Dos ambientes se tocan solo en un punto o hay una pared que se cruza con el borde. Unilos con una pared completa para que la casa tenga un borde continuo.");
    return out;
  }
  const ring = startAtTopLeft(simplifyRing([...main.ring].reverse().map((k) => g.nodes.get(k)!)));
  out.contour = ring;
  out.area = Math.abs(signedArea(ring));
  const contourError = validateContour(ring, 1);
  if (contourError) out.issues.push(contourError);

  // 3. Cada tramo del dibujo: borde de la casa, pared interior o pared suelta.
  const edgesOf = ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! }));
  const exteriorBySegment = edgesOf.map((e, i) => ({ id: `edge-${i}`, a: e.a, b: e.b, length: distance(e.a, e.b), exterior: true, sources: [] as string[] }));
  const interiorPieces: { a: Point; b: Point; sources: Set<string> }[] = [];
  const strayIds = new Set<string>();
  for (const e of everything) {
    const a = g.nodes.get(e.u)!, b = g.nodes.get(e.v)!, mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const edgeIndex = edgesOf.findIndex((s) => onSegment(a, s.a, s.b) && onSegment(b, s.a, s.b) && onSegment(mid, s.a, s.b));
    if (edgeIndex >= 0) {
      exteriorBySegment[edgeIndex]!.sources.push(...e.sources);
      out.pieces.push({ a, b, kind: "exterior", sources: e.sources });
      continue;
    }
    const touches = (p: Point) => inside(p, ring, false) || edgesOf.some((s) => onSegment(p, s.a, s.b));
    if (inside(mid, ring, false) && touches(a) && touches(b)) {
      interiorPieces.push({ a, b, sources: new Set(e.sources) });
      out.pieces.push({ a, b, kind: "interior", sources: e.sources });
    } else {
      e.sources.forEach((s) => strayIds.add(s));
      out.pieces.push({ a, b, kind: "stray", sources: e.sources });
    }
  }
  out.exterior = exteriorBySegment.map((s) => ({ ...s, sources: [...new Set(s.sources)] }));
  out.interior = mergeCollinear(interiorPieces).map((s, i) => ({
    id: `wall-p${i}`, a: s.a, b: s.b, length: distance(s.a, s.b), exterior: false, sources: [...s.sources],
  }));
  out.stray = [...strayIds];
  if (out.stray.length)
    out.warnings.push(
      out.stray.length === 1
        ? "Hay una pared suelta fuera de la casa: no se pasa a 3D."
        : `Hay ${out.stray.length} paredes sueltas fuera de la casa: no se pasan a 3D.`,
    );

  // 4. Ambientes cerrados con su superficie y su nombre.
  const walls: Segment[] = out.interior.map((s) => ({ id: s.id, a: s.a, b: s.b, thickness: PLAN.interiorLine, height: GEOMETRY.wallHeight }));
  out.rooms = detectRooms(ring, walls).map((room) => ({
    room,
    label: doc.labels.find((l) => inside(l.at, room.polygon, false) && !(room.holes ?? []).some((h) => inside(l.at, h))) ?? null,
  }));

  // 5. Aberturas: en qué pared cayó cada una y si entra.
  const all = [...out.exterior, ...out.interior];
  const seen: { segment: string; offset: number; width: number }[] = [];
  for (const o of doc.openings) {
    const w = doc.walls.find((v) => v.id === o.wall);
    if (!w) continue;
    const len = wallLength(w), at = Math.min(len, Math.max(0, o.at));
    const dir = unit(w.a, w.b);
    const center = { x: w.a.x + dir.x * at, z: w.a.z + dir.z * at };
    const seg = all.find((s) => onSegment(center, s.a, s.b));
    if (!seg) {
      out.openings.push({ id: o.id, kind: o.kind, type: null, segment: null, offset: 0, width: openingWidth(o.kind, false), center, dir, inward: rotateNormal(dir), exterior: false, problem: "Esta abertura está en una pared que no forma parte de la casa." });
      continue;
    }
    const sdir = unit(seg.a, seg.b);
    const along = (center.x - seg.a.x) * sdir.x + (center.z - seg.a.z) * sdir.z;
    const offset = along - seg.length / 2;
    const type = catalogType(o.kind, seg.exterior);
    const width = type ? OPENINGS_CATALOG[type].width : openingWidth(o.kind, seg.exterior);
    let problem: string | null = null;
    if (!type) problem = "El ventanal y la ventana grande van en una pared exterior.";
    else if (Math.abs(offset) + width / 2 > seg.length / 2 - PLAN.cornerMargin + 0.001) problem = "Dejá al menos 25 cm hasta la esquina.";
    else if (seen.some((s) => s.segment === seg.id && Math.abs(s.offset - offset) < (s.width + width) / 2 + PLAN.openingGap - 0.001)) problem = "Se superpone con otra abertura.";
    if (!problem) seen.push({ segment: seg.id, offset, width });
    out.openings.push({ id: o.id, kind: o.kind, type, segment: seg.id, offset, width, center, dir: sdir, inward: rotateNormal(sdir), exterior: seg.exterior, problem });
  }
  const bad = out.openings.filter((o) => o.problem).length;
  if (bad) out.warnings.push(bad === 1 ? "Hay 1 abertura que no entra: no se pasa a 3D." : `Hay ${bad} aberturas que no entran: no se pasan a 3D.`);
  return out;
}

/**
 * Hacia dónde se escribe la medida de un tramo: en el borde de la casa, hacia afuera; en los demás, hacia arriba
 * (o a la derecha si es vertical), para que el texto no quede encima de la línea.
 */
export function pieceNormal(a: PlanAnalysis, piece: Pick<PlanPiece, "a" | "b" | "kind">): Point {
  const d = unit(piece.a, piece.b);
  let n = rotateNormal(d);
  if (piece.kind === "exterior" && a.contour) {
    const mid = { x: (piece.a.x + piece.b.x) / 2 + n.x * 0.05, z: (piece.a.z + piece.b.z) / 2 + n.z * 0.05 };
    return inside(mid, a.contour, false) ? { x: -n.x, z: -n.z } : n;
  }
  if (n.z > 1e-9 || (Math.abs(n.z) <= 1e-9 && n.x < 0)) n = { x: -n.x, z: -n.z };
  return n;
}

/* ───────────────────────── Edición ───────────────────────── */

const clampOpenings = (before: PlanDoc, walls: PlanWall[]): PlanOpening[] =>
  before.openings.flatMap((o) => {
    const old = before.walls.find((w) => w.id === o.wall), next = walls.find((w) => w.id === o.wall);
    if (!old || !next) return [];
    const oldLen = wallLength(old), newLen = wallLength(next);
    if (newLen < 1e-3) return [];
    const at = oldLen > 1e-6 ? (o.at * newLen) / oldLen : newLen / 2;
    return [{ ...o, at: clean(Math.min(newLen, Math.max(0, at))) }];
  });

const withWalls = (doc: PlanDoc, walls: PlanWall[]): PlanDoc => ({ ...doc, walls, openings: clampOpenings(doc, walls) });

/** Partes de a→b que todavía no tienen una pared encima (las paredes alineadas que ya existen se comparten). */
export function uncoveredParts(doc: PlanDoc, a: Point, b: Point): [number, number][] {
  const len = distance(a, b);
  if (len < 1e-6) return [];
  const covered: [number, number][] = [];
  for (const w of doc.walls) {
    if (segDist(w.a, a, b) > 2e-3 || segDist(w.b, a, b) > 2e-3) continue;
    const t0 = project(w.a, a, b).t * len, t1 = project(w.b, a, b).t * len;
    covered.push([Math.min(t0, t1), Math.max(t0, t1)]);
  }
  covered.sort((x, y) => x[0] - y[0]);
  const free: [number, number][] = [];
  let at = 0;
  for (const [s, e] of covered) {
    if (s > at + 1e-6) free.push([at, Math.min(s, len)]);
    at = Math.max(at, e);
  }
  if (at < len - 1e-6) free.push([at, len]);
  return free.filter(([s, e]) => e - s > 0.05);
}

/** Agrega la pared a→b sin duplicar lo que ya está dibujado encima. Devuelve el plano y los ids nuevos. */
export function addWall(doc: PlanDoc, a: Point, b: Point, newId: (p: string) => string = makePlanId): { doc: PlanDoc; ids: string[] } {
  if (distance(a, b) < PLAN.minWall || doc.walls.length >= PLAN.maxWalls) return { doc, ids: [] };
  const d = unit(a, b), len = distance(a, b);
  const walls = [...doc.walls];
  const ids: string[] = [];
  for (const [s, e] of uncoveredParts(doc, a, b)) {
    const pa = s < 1e-6 ? a : { x: a.x + d.x * s, z: a.z + d.z * s };
    const pb = e > len - 1e-6 ? b : { x: a.x + d.x * e, z: a.z + d.z * e };
    const id = newId("w");
    walls.push({ id, a: pa, b: pb });
    ids.push(id);
  }
  return ids.length ? { doc: { ...doc, walls }, ids } : { doc, ids };
}

/** Habitación rectangular: cuatro paredes (las que ya existían alineadas se comparten). */
export function addRectangle(doc: PlanDoc, p: Point, q: Point, newId: (p: string) => string = makePlanId): { doc: PlanDoc; ids: string[] } {
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), z0 = Math.min(p.z, q.z), z1 = Math.max(p.z, q.z);
  if (x1 - x0 < PLAN.minWall || z1 - z0 < PLAN.minWall) return { doc, ids: [] };
  const corners: Point[] = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  let cur = doc;
  const ids: string[] = [];
  corners.forEach((c, i) => {
    const r = addWall(cur, c, corners[(i + 1) % 4]!, newId);
    cur = r.doc;
    ids.push(...r.ids);
  });
  return { doc: cur, ids };
}

export function removeWall(doc: PlanDoc, id: string): PlanDoc {
  return { ...doc, walls: doc.walls.filter((w) => w.id !== id), openings: doc.openings.filter((o) => o.wall !== id) };
}

/** Mueve una esquina: todas las paredes que terminan ahí la siguen. */
export function moveVertex(doc: PlanDoc, from: Point, to: Point): PlanDoc {
  const walls = doc.walls.map((w) => ({ ...w, a: same(w.a, from) ? to : w.a, b: same(w.b, from) ? to : w.b }));
  return withWalls(doc, walls);
}

/**
 * Corre una pared de costado (perpendicular a sí misma). Las paredes que llegan a sus extremos se estiran o se acortan
 * deslizándose sobre su propia línea, y los tabiques que apoyan en ella la siguen: un rectángulo se agranda sin deformarse.
 */
export function moveWall(doc: PlanDoc, id: string, delta: Point): PlanDoc {
  const w = doc.walls.find((v) => v.id === id);
  if (!w) return doc;
  const d = unit(w.a, w.b), n = rotateNormal(d);
  const s = delta.x * n.x + delta.z * n.z;
  if (Math.abs(s) < 1e-9) return doc;
  const slide = (p: Point, other: PlanWall): Point => {
    const far = same(other.a, p) ? other.b : other.a;
    const e = unit(p, far), dn = e.x * n.x + e.z * n.z;
    return Math.abs(dn) > 0.05 ? { x: p.x + e.x * (s / dn), z: p.z + e.z * (s / dn) } : { x: p.x + n.x * s, z: p.z + n.z * s };
  };
  const moved: { from: Point; to: Point }[] = [];
  for (const end of [w.a, w.b]) {
    const neighbours = doc.walls.filter((v) => v.id !== id && (same(v.a, end) || same(v.b, end)));
    const driver = neighbours.find((v) => Math.abs(unit(v.a, v.b).x * d.z - unit(v.a, v.b).z * d.x) > 1e-3);
    moved.push({ from: end, to: driver ? slide(end, driver) : { x: end.x + n.x * s, z: end.z + n.z * s } });
  }
  const remap = (p: Point) => moved.find((m) => same(p, m.from))?.to ?? p;
  // Tabiques que apoyan en el cuerpo de la pared (no en sus extremos): su punta resbala hasta la nueva posición.
  const onBody = doc.walls.flatMap((v) => {
    if (v.id === id) return [];
    return ([v.a, v.b] as Point[]).flatMap((p, k) => {
      if (same(p, w.a) || same(p, w.b) || !onSegment(p, w.a, w.b)) return [];
      return [{ wall: v.id, end: k === 0 ? "a" : "b", at: slide(p, v) }];
    });
  });
  const walls = doc.walls.map((v) => {
    let a = remap(v.a), b = remap(v.b);
    for (const t of onBody) if (t.wall === v.id) { if (t.end === "a") a = t.at; else b = t.at; }
    return { ...v, a, b };
  });
  return withWalls(doc, walls);
}

/**
 * Cambia el largo de una pared. Si en su extremo final llega una pared perpendicular, se corre esa pared (el ambiente se
 * agranda sin deformarse); si no, se mueve la esquina.
 */
export function setWallLength(doc: PlanDoc, id: string, length: number): PlanDoc {
  const w = doc.walls.find((v) => v.id === id);
  if (!w || !Number.isFinite(length) || length < PLAN.minWall) return doc;
  const d = unit(w.a, w.b), delta = length - wallLength(w);
  if (Math.abs(delta) < 1e-9) return doc;
  const at = doc.walls.filter((v) => v.id !== id && (same(v.a, w.b) || same(v.b, w.b)));
  const only = at.length === 1 ? at[0]! : undefined;
  if (only) {
    const e = unit(only.a, only.b);
    if (Math.abs(e.x * d.x + e.z * d.z) < 0.02) return moveWall(doc, only.id, { x: d.x * delta, z: d.z * delta });
  }
  return moveVertex(doc, w.b, { x: clean(w.a.x + d.x * length), z: clean(w.a.z + d.z * length) });
}

/* ── Aberturas y nombres ── */

export function addOpening(doc: PlanDoc, kind: PlanOpeningKind, wall: string, at: number, newId: (p: string) => string = makePlanId): { doc: PlanDoc; id: string | null } {
  const w = doc.walls.find((v) => v.id === wall);
  if (!w) return { doc, id: null };
  const id = newId("o");
  return { doc: { ...doc, openings: [...doc.openings, { id, kind, wall, at: clean(Math.min(wallLength(w), Math.max(0, at))) }] }, id };
}

export function editOpening(doc: PlanDoc, id: string, patch: Partial<Pick<PlanOpening, "kind" | "at" | "wall">>): PlanDoc {
  return { ...doc, openings: doc.openings.map((o) => {
    if (o.id !== id) return o;
    const next = { ...o, ...patch };
    const w = doc.walls.find((v) => v.id === next.wall);
    return w ? { ...next, at: clean(Math.min(wallLength(w), Math.max(0, next.at))) } : o;
  }) };
}

export const removeOpening = (doc: PlanDoc, id: string): PlanDoc => ({ ...doc, openings: doc.openings.filter((o) => o.id !== id) });

export function setLabel(doc: PlanDoc, at: Point, text: string, newId: (p: string) => string = makePlanId): PlanDoc {
  const trimmed = text.trim().slice(0, PLAN.maxLabel);
  const near = doc.labels.find((l) => distance(l.at, at) < 0.05);
  const labels = doc.labels.filter((l) => l !== near);
  return { ...doc, labels: trimmed ? [...labels, { id: near?.id ?? newId("l"), at, text: trimmed }] : labels };
}

/* ── Lo que toca el dedo ── */

export function nodesOf(doc: PlanDoc): Point[] {
  const seen = new Map<string, Point>();
  for (const w of doc.walls) for (const p of [w.a, w.b]) if (!seen.has(nodeKey(p))) seen.set(nodeKey(p), p);
  return [...seen.values()];
}

/** La pared dibujada más cercana al punto (dentro de `tol` metros) y a qué distancia de su inicio cae. */
export function hitWall(doc: PlanDoc, p: Point, tol: number): { wall: PlanWall; at: number; dist: number } | null {
  let best: { wall: PlanWall; at: number; dist: number } | null = null;
  for (const w of doc.walls) {
    const pr = project(p, w.a, w.b), dist = distance(pr.point, p);
    if (dist <= tol && (!best || dist < best.dist)) best = { wall: w, at: pr.t * wallLength(w), dist };
  }
  return best;
}

export type SnapGuide = { x?: number; z?: number };
export type SnapResult = { point: Point; kind: "vertex" | "wall" | "grid"; guide: SnapGuide };

/**
 * Imán del lápiz. Orden: esquina existente → pared existente → alineación con otras esquinas → cuadrícula de 10 cm.
 * Con `from` y `ortho`, el trazo queda recto (horizontal o vertical) respecto del punto anterior.
 */
export function snapPoint(doc: PlanDoc, p: Point, opts: { tol: number; from?: Point | undefined; ortho?: boolean; grid?: number }): SnapResult {
  const grid = opts.grid ?? PLAN.grid, { tol, from } = opts;
  const guide: SnapGuide = {};
  const nodes = nodesOf(doc);
  const vertex = nodes.filter((n) => distance(n, p) <= tol).sort((a, b) => distance(a, p) - distance(b, p))[0];
  if (vertex) return { point: { ...vertex }, kind: "vertex", guide };
  let q: Point = { x: snapTo(p.x, grid), z: snapTo(p.z, grid) };
  let lockedX = false, lockedZ = false;
  if (from && opts.ortho) {
    if (Math.abs(p.x - from.x) >= Math.abs(p.z - from.z)) { q = { x: q.x, z: from.z }; lockedZ = true; }
    else { q = { x: from.x, z: q.z }; lockedX = true; }
  }
  // Pared existente: sobre la línea recta, donde el trazo la cruza; libre, la proyección.
  if (from && opts.ortho) {
    let best: { p: Point; d: number } | null = null;
    for (const w of doc.walls) {
      const hit = crossing(from, { x: lockedZ ? from.x + (p.x >= from.x ? 1 : -1) * 1000 : from.x, z: lockedX ? from.z + (p.z >= from.z ? 1 : -1) * 1000 : from.z }, w.a, w.b);
      if (hit && distance(hit.p, p) <= tol && (!best || distance(hit.p, p) < best.d)) best = { p: hit.p, d: distance(hit.p, p) };
    }
    if (best) return { point: best.p, kind: "wall", guide };
  } else {
    const hit = hitWall(doc, p, tol);
    if (hit) return { point: project(p, hit.wall.a, hit.wall.b).point, kind: "wall", guide };
  }
  if (!lockedX) {
    const n = nodes.find((v) => Math.abs(v.x - p.x) <= tol);
    if (n) { q = { x: n.x, z: q.z }; guide.x = n.x; }
  }
  if (!lockedZ) {
    const n = nodes.find((v) => Math.abs(v.z - p.z) <= tol);
    if (n) { q = { x: q.x, z: n.z }; guide.z = n.z; }
  }
  return { point: { x: clean(q.x), z: clean(q.z) }, kind: "grid", guide };
}

/* ── Guardado ── */

export const serializePlan = (doc: PlanDoc) => JSON.stringify(doc);

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e4;
const pt = (v: unknown): v is Point => !!v && typeof v === "object" && num((v as Point).x) && num((v as Point).z);

/** Lee un plano guardado; si algo no cierra, devuelve `null` en vez de romper el editor. */
export function parsePlan(text: string | null | undefined): PlanDoc | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Partial<PlanDoc>;
    if (!raw || !Array.isArray(raw.walls)) return null;
    const ids = new Set<string>();
    const walls: PlanWall[] = [];
    for (const w of raw.walls.slice(0, PLAN.maxWalls)) {
      if (!w || typeof w.id !== "string" || ids.has(w.id) || !pt(w.a) || !pt(w.b)) continue;
      ids.add(w.id);
      walls.push({ id: w.id, a: { x: w.a.x, z: w.a.z }, b: { x: w.b.x, z: w.b.z } });
    }
    const openings = (Array.isArray(raw.openings) ? raw.openings : []).flatMap((o): PlanOpening[] =>
      o && typeof o.id === "string" && PLAN_OPENING_KINDS.includes(o.kind) && ids.has(o.wall) && num(o.at) ? [{ id: o.id, kind: o.kind, wall: o.wall, at: Math.max(0, o.at) }] : [],
    );
    const labels = (Array.isArray(raw.labels) ? raw.labels : []).flatMap((l): PlanLabel[] =>
      l && typeof l.id === "string" && typeof l.text === "string" && pt(l.at) && l.text.trim() ? [{ id: l.id, at: { x: l.at.x, z: l.at.z }, text: l.text.trim().slice(0, PLAN.maxLabel) }] : [],
    );
    return { walls, openings, labels };
  } catch {
    return null;
  }
}

/** Texto de largo en metros con coma decimal («4,50 m»). */
export const meters = (n: number) => `${n.toFixed(2).replace(".", ",")} m`;
export const squareMeters = (n: number) => `${n.toFixed(2).replace(".", ",")} m²`;

