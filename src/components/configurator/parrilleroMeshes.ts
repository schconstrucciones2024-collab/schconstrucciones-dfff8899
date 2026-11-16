import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Box as DeckBox } from "@/config/deckCutout";
import type { PCyl, PPrism } from "@/config/parrilleroLayout";
import { boxesGeometry } from "./deckMeshes";

/**
 * Prisma: un polígono en (u, y) extruido a lo ancho de la profundidad. El polígono queda en el plano (z, y) del parrillero
 * (u corre por z) y se extruye hacia -x desde `x1` hasta `x0`. Los UV están en metros: el ladrillo mantiene su escala.
 */
export function prismGeometry(p: PPrism): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  p.pts.forEach(([u, y], i) => (i === 0 ? shape.moveTo(u, y) : shape.lineTo(u, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: p.x1 - p.x0, bevelEnabled: false, steps: 1 });
  // Giro de -90° sobre y: x de la forma → +z, y la extrusión (z) → -x. Después se lleva al rango [x0, x1].
  g.rotateY(-Math.PI / 2);
  g.translate(p.x1, 0, 0);
  // UV en metros según hacia dónde mira cada cara, igual que las cajas (`boxesGeometry`): así las hiladas de ladrillo quedan
  // horizontales y se continúan de un prisma a una caja vecina. (Los UV que trae ExtrudeGeometry giran 90° las paredes verticales.)
  const pos = g.getAttribute("position"),
    nor = g.getAttribute("normal"),
    uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i)),
      ny = nor.getY(i),
      nz = nor.getZ(i);
    if (nx > 0.5) uv.setXY(i, pos.getZ(i), pos.getY(i));
    else if (Math.abs(nz) > 0.9) uv.setXY(i, pos.getX(i), pos.getY(i));
    else if (Math.abs(ny) > 0.9) uv.setXY(i, pos.getX(i), pos.getZ(i));
    // Cara en pendiente (la campana): ancho en x y largo medido a lo largo de la pendiente.
    else uv.setXY(i, pos.getX(i), pos.getY(i) * -nz + pos.getZ(i) * ny);
  }
  return g;
}

export function cylinderGeometry(c: PCyl): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(c.r, c.r, c.h, 20, 1);
  if (c.axis === "x") g.rotateZ(Math.PI / 2);
  else if (c.axis === "z") g.rotateX(Math.PI / 2);
  g.translate(...c.pos);
  return g;
}

/** Cajas, prismas y cilindros unidos en una sola geometría (una pieza = un mesh = un material). */
export function partGeometry(parts: { boxes?: DeckBox[]; prisms?: PPrism[]; cyls?: PCyl[] }): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = [];
  const boxes = parts.boxes?.length ? boxesGeometry(parts.boxes) : null;
  if (boxes) geos.push(boxes);
  for (const p of parts.prisms ?? []) geos.push(prismGeometry(p));
  for (const c of parts.cyls ?? []) geos.push(cylinderGeometry(c));
  if (!geos.length) return null;
  if (geos.length === 1) return geos[0] as THREE.BufferGeometry;
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
  const merged = mergeGeometries(flat, false);
  for (const g of geos) g.dispose();
  for (const g of flat) g.dispose();
  return merged;
}
