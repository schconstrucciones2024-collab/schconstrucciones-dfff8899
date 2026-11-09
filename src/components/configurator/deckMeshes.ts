import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sheetProfile, type DeckBox } from "@/config/deckLayout";

/** Cajas de madera unidas en una sola geometría, con los UV en metros para que la veta mantenga su escala. */
export function boxesGeometry(boxes: DeckBox[]): THREE.BufferGeometry | null {
  const geos = boxes.map((b) => {
    const g = new THREE.BoxGeometry(...b.size);
    g.translate(...b.pos);
    const p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      const top = Math.abs(n.getY(i)) > 0.5,
        side = Math.abs(n.getX(i)) > 0.5;
      uv.setXY(i, top ? p.getX(i) : side ? p.getZ(i) : p.getX(i), top ? p.getZ(i) : p.getY(i));
    }
    return g;
  });
  const merged = geos.length ? mergeGeometries(geos) : null;
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Un tramo de chapa de `pitches` ondas (10 cm cada una), centrado en x = 0 y extruido de `z0` a `z1`. */
function sheetChunk(pitches: number, z0: number, z1: number): THREE.BufferGeometry | null {
  const top = sheetProfile(pitches * PASO_CHAPA),
    first = top[0],
    espesor = 0.002;
  if (!first) return null;
  const shape = new THREE.Shape();
  shape.moveTo(first[0], first[1]);
  for (const [x, h] of top.slice(1)) shape.lineTo(x, h);
  for (const [x, h] of [...top].reverse()) shape.lineTo(x, h - espesor);
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, z0);
  return g;
}

const PASO_CHAPA = 0.1;
/** Cuántas ondas lleva cada tramo: un techo muy ancho se arma con varios, para no triangular un perfil enorme de una vez. */
const ONDAS_POR_TRAMO = 40;

/** Chapa trapezoidal (paso 10 cm, nervio 3 cm): el perfil se extruye a lo largo de la caída, entre `z0` y `z1`. */
export function sheetGeometry(width: number, z0: number, z1: number): THREE.BufferGeometry | null {
  const total = Math.max(1, Math.round(width / PASO_CHAPA)),
    parts: THREE.BufferGeometry[] = [];
  let done = 0;
  while (done < total) {
    const n = Math.min(ONDAS_POR_TRAMO, total - done),
      g = sheetChunk(n, z0, z1);
    if (g) {
      g.translate((done + n / 2 - total / 2) * PASO_CHAPA, 0, 0);
      parts.push(g);
    }
    done += n;
  }
  const merged = parts.length ? mergeGeometries(parts) : null;
  parts.forEach((g) => g.dispose());
  return merged;
}
