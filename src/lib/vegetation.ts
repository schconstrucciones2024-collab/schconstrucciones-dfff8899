import type { Point } from "@/config/geometry";

/**
 * Vegetación del entorno: reglas de colocación y movimiento como funciones puras.
 * La vegetación es ilustrativa: acompaña la escena y no forma parte del presupuesto ni de la obra.
 */
export type TreeKind = "pino" | "eucalipto" | "palmera" | "arbusto";
export type Tree = { id: string; kind: TreeKind; x: number; z: number; rot: number; scale: number };

export const TREE_KINDS: { id: TreeKind; name: string; height: number; radius: number }[] = [
  { id: "pino", name: "Pino", height: 7, radius: 1.6 },
  { id: "eucalipto", name: "Eucalipto", height: 9, radius: 1.8 },
  { id: "palmera", name: "Palmera", height: 5.5, radius: 1.3 },
  { id: "arbusto", name: "Arbusto", height: 1.3, radius: 0.7 },
];
export const treeInfo = (kind: TreeKind) => TREE_KINDS.find((k) => k.id === kind) ?? (TREE_KINDS[0] as (typeof TREE_KINDS)[number]);

/** El suelo del visor mide 80 m: se deja un borde para que no queden árboles en el filo. */
export const LOT_HALF = 36;
export const MAX_TREES = 40;

/** Lo mínimo que hace falta saber de la casa para ubicar vegetación. */
export type HouseFrame = { contour: Point[]; position: Point; rotation: number };

/** Pasa un punto del plano de la casa al mundo (la casa se rota con rotation-y = -rotation y se desplaza a `position`). */
export function toWorld(p: Point, frame: Pick<HouseFrame, "position" | "rotation">): Point {
  const c = Math.cos(frame.rotation), s = Math.sin(frame.rotation);
  return { x: frame.position.x + p.x * c - p.z * s, z: frame.position.z + p.x * s + p.z * c };
}
export const footprintWorld = (frame: HouseFrame): Point[] => frame.contour.map((p) => toWorld(p, frame));

function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return { x: a.x + dx * t, z: a.z + dz * t };
}
function insidePolygon(p: Point, ring: Point[]): boolean {
  let yes = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as Point, b = ring[(i + 1) % ring.length] as Point;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) yes = !yes;
  }
  return yes;
}
/** Distancia con signo al polígono: negativa adentro, positiva afuera. Devuelve también el punto más cercano del borde. */
export function signedDistance(p: Point, ring: Point[]): { d: number; nearest: Point } {
  let best = Infinity, nearest: Point = ring[0] ?? p;
  for (let i = 0; i < ring.length; i++) {
    const q = nearestOnSegment(p, ring[i] as Point, ring[(i + 1) % ring.length] as Point);
    const d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d < best) { best = d; nearest = q; }
  }
  return { d: insidePolygon(p, ring) ? -best : best, nearest };
}

/** Separación mínima entre el borde de la casa y el centro del tronco. */
export const houseClearance = (kind: TreeKind) => treeInfo(kind).radius * 0.6 + 0.8;
export const treeSpacing = (a: TreeKind, b: TreeKind) => (treeInfo(a).radius + treeInfo(b).radius) * 0.5;

export type PlaceCheck = { ok: true } | { ok: false; reason: "fuera-del-terreno" | "sobre-la-casa" | "muy-cerca-de-otro" | "limite" };
export const PLACE_MESSAGES: Record<Exclude<PlaceCheck, { ok: true }>["reason"], string> = {
  "fuera-del-terreno": "Ese punto queda fuera del terreno.",
  "sobre-la-casa": "Dejá un poco de distancia con la casa.",
  "muy-cerca-de-otro": "Ya hay vegetación muy cerca de ese punto.",
  limite: "Llegaste al máximo de árboles. Quitá alguno para agregar otro.",
};

export function canPlaceTree(trees: Tree[], at: Point, kind: TreeKind, frame: HouseFrame, ignoreId?: string): PlaceCheck {
  if (!Number.isFinite(at.x) || !Number.isFinite(at.z) || Math.abs(at.x) > LOT_HALF || Math.abs(at.z) > LOT_HALF) return { ok: false, reason: "fuera-del-terreno" };
  if (!ignoreId && trees.length >= MAX_TREES) return { ok: false, reason: "limite" };
  if (frame.contour.length >= 3 && signedDistance(at, footprintWorld(frame)).d < houseClearance(kind)) return { ok: false, reason: "sobre-la-casa" };
  for (const t of trees) {
    if (t.id === ignoreId) continue;
    if (Math.hypot(t.x - at.x, t.z - at.z) < treeSpacing(t.kind, kind)) return { ok: false, reason: "muy-cerca-de-otro" };
  }
  return { ok: true };
}

/** Variación estable por árbol (misma id → misma rotación y tamaño). */
function seeded(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
let counter = 0;
export const nextTreeId = () => `arbol-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function makeTree(kind: TreeKind, at: Point, id = nextTreeId()): Tree {
  const r = seeded(id), q = seeded(id + "s");
  return { id, kind, x: at.x, z: at.z, rot: r * Math.PI * 2, scale: 0.85 + q * 0.3 };
}

export type Result = { trees: Tree[]; check: PlaceCheck; id?: string };

export function addTree(trees: Tree[], kind: TreeKind, at: Point, frame: HouseFrame, id?: string): Result {
  const check = canPlaceTree(trees, at, kind, frame);
  if (!check.ok) return { trees, check };
  const tree = makeTree(kind, at, id);
  return { trees: [...trees, tree], check, id: tree.id };
}
export function moveTree(trees: Tree[], id: string, at: Point, frame: HouseFrame): Result {
  const t = trees.find((v) => v.id === id);
  if (!t) return { trees, check: { ok: false, reason: "fuera-del-terreno" } };
  const check = canPlaceTree(trees, at, t.kind, frame, id);
  if (!check.ok) return { trees, check };
  return { trees: trees.map((v) => (v.id === id ? { ...v, x: at.x, z: at.z } : v)), check, id };
}
export const removeTree = (trees: Tree[], id: string): Tree[] => trees.filter((t) => t.id !== id);

/** Si la casa se movió, crece o gira y un árbol quedó pegado a la casa, lo aleja hasta la distancia mínima. */
export function keepClear(trees: Tree[], frame: HouseFrame): Tree[] {
  if (frame.contour.length < 3) return trees;
  const ring = footprintWorld(frame);
  let changed = false;
  const next = trees.map((t) => {
    const need = houseClearance(t.kind), { d, nearest } = signedDistance(t, ring);
    if (d >= need) return t;
    changed = true;
    let dx = t.x - nearest.x, dz = t.z - nearest.z;
    if (d < 0) { dx = -dx; dz = -dz; }
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) { dx = 1; dz = 0; } else { dx /= len; dz /= len; }
    const x = Math.max(-LOT_HALF, Math.min(LOT_HALF, nearest.x + dx * (need + 0.05)));
    const z = Math.max(-LOT_HALF, Math.min(LOT_HALF, nearest.z + dz * (need + 0.05)));
    return { ...t, x, z };
  });
  return changed ? next : trees;
}

/** Vegetación inicial: unos pocos ejemplares a distancia razonable de la casa. Se puede quitar toda. */
export function defaultTrees(frame: HouseFrame): Tree[] {
  const seeds: { kind: TreeKind; x: number; z: number }[] = [
    { kind: "pino", x: -10, z: -8 }, { kind: "eucalipto", x: 12, z: -10 }, { kind: "palmera", x: -9, z: 9 },
    { kind: "pino", x: 14, z: 7 }, { kind: "arbusto", x: 6, z: 11 },
  ];
  return keepClear(seeds.map((s, i) => makeTree(s.kind, s, `base-${i}`)), frame);
}
