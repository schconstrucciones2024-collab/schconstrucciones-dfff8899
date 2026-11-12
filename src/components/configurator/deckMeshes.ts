import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DeckSheet } from "@/config/deck";
import { sheetProfile, type DeckBox } from "@/config/deckLayout";

/** Una caja; con `bevel` se arma como una extrusión con los cantos y las esquinas biselados (45°). */
function boxGeometry(b: DeckBox): THREE.BufferGeometry {
  const [sx, sy, sz] = b.size,
    k = b.bevel ?? 0;
  if (k > 0 && Math.min(sx, sy, sz) > 2 * k + 1e-4) {
    const w = sx / 2 - k,
      h = sy / 2 - k,
      shape = new THREE.Shape();
    shape.moveTo(-w, -h);
    shape.lineTo(w, -h);
    shape.lineTo(w, h);
    shape.lineTo(-w, h);
    shape.closePath();
    const depth = sz - 2 * k,
      g = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: k,
        bevelSize: k,
        bevelOffset: 0,
        bevelSegments: 1,
        steps: 1,
      });
    // La extrusión va de z = -k a z = depth + k: se centra para que mida exactamente `size`.
    g.translate(0, 0, -depth / 2);
    return g;
  }
  return new THREE.BoxGeometry(sx, sy, sz);
}

/** Cajas de madera unidas en una sola geometría, con los UV en metros para que la veta mantenga su escala. */
export function boxesGeometry(boxes: DeckBox[]): THREE.BufferGeometry | null {
  const geos = boxes.map((b) => {
    const g = boxGeometry(b);
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
  // Las cajas biseladas no tienen índice y las comunes sí: para unirlas todas deben ser del mismo tipo.
  const mixed = geos.some((g) => g.index === null) && geos.some((g) => g.index !== null);
  const parts = mixed ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos;
  const merged = parts.length ? mergeGeometries(parts) : null;
  geos.forEach((g) => g.dispose());
  if (mixed) parts.forEach((g) => g.dispose());
  return merged;
}

/** Perfil de la chapa trapezoidal que se usa si no se indica otro (línea Esencial). */
const PERFIL_TRAPEZOIDAL: Pick<DeckSheet, "perfil" | "paso" | "nervio"> = {
  perfil: "trapezoidal",
  paso: 0.1,
  nervio: 0.03,
};

/** Un tramo de chapa de `pitches` ondas, centrado en x = 0 y extruido de `z0` a `z1`. */
function sheetChunk(
  pitches: number,
  z0: number,
  z1: number,
  chapa: Pick<DeckSheet, "perfil" | "paso" | "nervio">,
): THREE.BufferGeometry | null {
  const top = sheetProfile(pitches * chapa.paso, chapa.paso, chapa.nervio, chapa.perfil),
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

/** Cuántas ondas lleva cada tramo: un techo muy ancho se arma con varios, para no triangular un perfil enorme de una vez. */
const ONDAS_POR_TRAMO = 40;

/**
 * Chapa del techo (trapezoidal de paso 10 cm y nervio 3 cm, o acanalada de onda 7,6 cm): el perfil se extruye a lo largo de
 * la caída, entre `z0` y `z1`.
 */
export function sheetGeometry(
  width: number,
  z0: number,
  z1: number,
  chapa: Pick<DeckSheet, "perfil" | "paso" | "nervio"> = PERFIL_TRAPEZOIDAL,
): THREE.BufferGeometry | null {
  const total = Math.max(1, Math.round(width / chapa.paso)),
    parts: THREE.BufferGeometry[] = [];
  let done = 0;
  while (done < total) {
    const n = Math.min(ONDAS_POR_TRAMO, total - done),
      g = sheetChunk(n, z0, z1, chapa);
    if (g) {
      g.translate((done + n / 2 - total / 2) * chapa.paso, 0, 0);
      parts.push(g);
    }
    done += n;
  }
  const merged = parts.length ? mergeGeometries(parts) : null;
  parts.forEach((g) => g.dispose());
  return merged;
}
