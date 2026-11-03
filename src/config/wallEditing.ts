import { distance, type Point } from './geometry';

/** Exact metric endpoint; drawing can snap, numeric lengths never do. */
export function endpointAtLength(a: Point, b: Point, length: number): Point {
  const current = distance(a, b);
  if (!Number.isFinite(length) || length <= 0 || current < 1e-8) return { ...b };
  return { x: a.x + (b.x - a.x) * length / current, z: a.z + (b.z - a.z) * length / current };
}

/** Keep corners square by moving the connected supporting line, not just one vertex. */
export function moveCorner(contour: Point[], index: number, next: Point, orthogonal: boolean): Point[] {
  const p = contour[index];
  if (!p) return contour;
  return contour.map((v, i) => {
    if (i === index) return { ...next };
    if (!orthogonal) return { ...v };
    return { x: Math.abs(v.x - p.x) < 1e-7 ? next.x : v.x, z: Math.abs(v.z - p.z) < 1e-7 ? next.z : v.z };
  });
}

export function resizeExterior(contour: Point[], index: number, length: number, orthogonal: boolean): Point[] {
  const a = contour[index], end = (index + 1) % contour.length, b = contour[end];
  if (!a || !b) return contour;
  return moveCorner(contour, end, endpointAtLength(a, b, length), orthogonal);
}

/** Preserve wall junctions which touch a moved exterior vertex/supporting line. */
export function followContour(p: Point, old: Point[], next: Point[]): Point {
  const exact = old.findIndex(v => distance(v, p) < 1e-7);
  if (exact >= 0 && next[exact]) return { ...next[exact] };
  let x = p.x, z = p.z;
  old.forEach((v, i) => {
    const n = next[i];
    if (!n) return;
    if (Math.abs(v.x - p.x) < 1e-7 && Math.abs(n.x - v.x) > 1e-7) x = n.x;
    if (Math.abs(v.z - p.z) < 1e-7 && Math.abs(n.z - v.z) > 1e-7) z = n.z;
  });
  return { x, z };
}

/** Drawing points are orthogonal and snapped; exact numeric input is separate. */
export function pencilPoint(p: Point, start?: Point, orthogonal = true): Point {
  const q = { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 };
  if (!start || !orthogonal) return q;
  return Math.abs(q.x - start.x) >= Math.abs(q.z - start.z) ? { x: q.x, z: start.z } : { x: start.x, z: q.z };
}