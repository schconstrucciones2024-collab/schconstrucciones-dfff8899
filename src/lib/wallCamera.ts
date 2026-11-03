/** Matemática de cámara del visor de paredes (pura, sin Three): vistas predefinidas, encuadre y zoom. */
import type { Vec3 } from "./wallGeometry";
import type { ViewId } from "./wallState";

/** Azimut (0 = mirando la cara exterior de frente; π/2 = desde la derecha; π = desde el interior) y elevación en radianes. */
export const VIEW_POSES: Record<ViewId, { az: number; el: number }> = {
  iso: { az: 0.7, el: 0.3 },
  frente: { az: 0, el: 0.05 },
  lateral: { az: Math.PI / 2, el: 0.05 },
  interior: { az: Math.PI, el: 0.05 },
  planta: { az: 0, el: 1.45 },
};

/** La cámara nunca baja del piso ni pasa por encima del cenit. */
export const EL_MIN = 0.03;
export const EL_MAX = Math.PI / 2 - 0.03;
export const clampElevation = (el: number) => Math.min(EL_MAX, Math.max(EL_MIN, el));

/** Distancia a la que una esfera de radio `radius` entra completa en el cuadro (en el lado más angosto). */
export function fitDistance(radius: number, fovDeg: number, aspect: number): number {
  const v = (fovDeg * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(0.2, aspect));
  return radius / Math.sin(Math.min(v, h) / 2);
}

/** Diferencia angular más corta de `from` a `to`, en (−π, π]. */
export function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function cameraPosition(target: Vec3, az: number, el: number, dist: number): Vec3 {
  const e = clampElevation(el);
  return [target[0] + dist * Math.sin(az) * Math.cos(e), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(az) * Math.cos(e)];
}

export const clampDistance = (d: number, min: number, max: number) => Math.min(max, Math.max(min, d));
