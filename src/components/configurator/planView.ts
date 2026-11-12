/**
 * Encuadre del editor de planos: qué parte del plano se ve y a qué escala (píxeles por metro real).
 * Lógica pura, sin DOM, para probarla con vitest.
 */
import type { Point } from "@/config/geometry";

export type PlanView = { cx: number; cz: number; ppm: number };
export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Px = { x: number; y: number };

export const MIN_PPM = 6;
export const MAX_PPM = 420;
/** Zona que se muestra con el plano vacío: 14 × 10 m, lo justo para una casa chica. */
const EMPTY_BOX: Box = { minX: -1, maxX: 13, minZ: -1, maxZ: 9 };

export const clampPpm = (ppm: number) => Math.min(MAX_PPM, Math.max(MIN_PPM, ppm));

export function boxOf(points: Point[]): Box | null {
  if (!points.length) return null;
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

/** Encuadra todo el plano en la pantalla, con margen para las medidas. */
export function fitView(box: Box | null, width: number, height: number, pad = 56): PlanView {
  const b = box ?? EMPTY_BOX;
  const w = Math.max(b.maxX - b.minX, 3), d = Math.max(b.maxZ - b.minZ, 3);
  const ppm = clampPpm(Math.min(Math.max(width - pad * 2, 80) / w, Math.max(height - pad * 2, 80) / d));
  return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, ppm };
}

/** De píxeles de la pantalla (relativos al lienzo) a metros del plano. */
export const toWorld = (v: PlanView, width: number, height: number, p: Px): Point => ({
  x: v.cx + (p.x - width / 2) / v.ppm,
  z: v.cz + (p.y - height / 2) / v.ppm,
});

export const toScreen = (v: PlanView, width: number, height: number, p: Point): Px => ({
  x: (p.x - v.cx) * v.ppm + width / 2,
  y: (p.z - v.cz) * v.ppm + height / 2,
});

/** Acerca o aleja manteniendo quieto el punto de plano que está bajo `anchor` (el dedo o el mouse). */
export function zoomAt(v: PlanView, width: number, height: number, factor: number, anchor: Px): PlanView {
  const ppm = clampPpm(v.ppm * factor);
  const world = toWorld(v, width, height, anchor);
  return { ppm, cx: world.x - (anchor.x - width / 2) / ppm, cz: world.z - (anchor.y - height / 2) / ppm };
}

/** Mueve el encuadre lo que se arrastró en pantalla (en píxeles). */
export const panBy = (v: PlanView, dx: number, dy: number): PlanView => ({ ...v, cx: v.cx - dx / v.ppm, cz: v.cz - dy / v.ppm });

export const viewBox = (v: PlanView, width: number, height: number) =>
  `${v.cx - width / 2 / v.ppm} ${v.cz - height / 2 / v.ppm} ${width / v.ppm} ${height / v.ppm}`;

/** Largo de la regla de escala: el primer valor «redondo» que ocupa al menos `minPx` píxeles. */
export function scaleBarMeters(ppm: number, minPx = 64): number {
  for (const m of [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]) if (m * ppm >= minPx) return m;
  return 100;
}
