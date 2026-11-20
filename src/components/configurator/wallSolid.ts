import * as THREE from "three";
import polygonClipping from "polygon-clipping";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OPENINGS_CATALOG, type OpeningType } from "@/config/openingsCatalog";
import { inside, miterPolygon, type Point, type Segment } from "@/config/geometry";

/**
 * Geometría del muro del visor 3D, separada del componente para poder probarla. Todo se mide en el sistema local del muro:
 * `x` a lo largo (desde el centro del muro), `z` a través del espesor y `y` hacia arriba.
 */

/**
 * Un espejado (`scale(1,1,-1)`) invierte el orden de los vértices: las caras exteriores quedaban como "traseras" y el pase de
 * normales de la oclusión ambiental las veía hacia adentro, oscureciendo la pared entera salvo los bordes (efecto "transparente").
 * Se reordena cada triángulo para que vuelvan a mirar hacia afuera.
 */
export function flipWinding(g: THREE.BufferGeometry) {
  const index = g.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
    index.needsUpdate = true;
    return;
  }
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute,
      n = a.itemSize,
      arr = a.array as Float32Array;
    for (let t = 0; t + 2 < a.count; t += 3)
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k,
          i2 = (t + 2) * n + k,
          v = arr[i1]!;
        arr[i1] = arr[i2]!;
        arr[i2] = v;
      }
    a.needsUpdate = true;
  }
}

/** Posición, giro y largo con que el visor coloca un muro (el centro del segmento y `rotation-y`). */
export function wallFrame(w: Segment) {
  return {
    center: { x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 },
    angle: -Math.atan2(w.b.z - w.a.z, w.b.x - w.a.x),
    length: Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z),
  };
}

/** Planta del muro (con las esquinas a inglete) en coordenadas locales del muro. */
export function wallLocalRing(w: Segment, walls: Segment[]): Point[] {
  const { center, angle } = wallFrame(w),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  return miterPolygon(w, walls).map((p) => {
    const dx = p.x - center.x,
      dz = p.z - center.z;
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  });
}

/**
 * Lado del muro (+1 o -1 en `z` local) que mira hacia el interior de la casa. El visor gira el muro con `rotation-y = angle`:
 * el +z local apunta, en planta, hacia (sin angle, cos angle).
 */
export function interiorSide(w: Segment, contour: Point[]): 1 | -1 {
  const { center, angle } = wallFrame(w),
    reach = w.thickness / 2 + 0.12,
    probe = { x: center.x + Math.sin(angle) * reach, z: center.z + Math.cos(angle) * reach };
  return inside(probe, contour, false) ? 1 : -1;
}

/**
 * Tramo de la cara interior del muro (de `lo` a `hi`, a lo largo del muro): en una esquina saliente es más corta que el eje
 * del muro y en una entrante, más larga. El revestimiento interior tiene que cubrir exactamente ese tramo.
 */
export function innerFaceSpan(ring: Point[], side: 1 | -1): { lo: number; hi: number } {
  const edge = side === 1 ? Math.max(...ring.map((p) => p.z)) : Math.min(...ring.map((p) => p.z)),
    xs = ring.filter((p) => Math.abs(p.z - edge) < 1e-6).map((p) => p.x);
  return { lo: Math.min(...xs), hi: Math.max(...xs) };
}

export type WallCut = { type: OpeningType; offset: number };

/**
 * Cuerpo macizo del muro: la planta (con inglete) extruida hasta `height`, partida en los vanos de las aberturas. Los
 * tramos sobre y bajo cada ventana o puerta se arman aparte. UV en metros (x a lo largo, y hacia arriba).
 */
export function buildWallSolid(ring: Point[], cuts: WallCut[], height: number): THREE.BufferGeometry | null {
  const xs = ring.map((p) => p.x),
    stops = [
      Math.min(...xs),
      Math.max(...xs),
      ...cuts.flatMap((o) => [o.offset - OPENINGS_CATALOG[o.type].width / 2, o.offset + OPENINGS_CATALOG[o.type].width / 2]),
    ].sort((a, b) => a - b),
    geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i],
      b = stops[i + 1];
    if (a === undefined || b === undefined || b - a < 1e-8) continue;
    const mid = (a + b) / 2,
      o = cuts.find((v) => Math.abs(v.offset - mid) < OPENINGS_CATALOG[v.type].width / 2),
      spec = o ? OPENINGS_CATALOG[o.type] : null,
      bands = spec
        ? [
            [0, spec.sill],
            [spec.sill + spec.height, height],
          ]
        : [[0, height]];
    const clipped = polygonClipping.intersection(
      [ring.map((p) => [p.x, p.z] as [number, number])],
      [
        [
          [a, -3],
          [b, -3],
          [b, 3],
          [a, 3],
        ],
      ],
    );
    for (const poly of clipped)
      for (const [low, high] of bands) {
        if (low === undefined || high === undefined || high - low < 1e-6) continue;
        const points = (poly[0] ?? []).slice(0, -1).map((v) => new THREE.Vector2(v[0], v[1])),
          g = new THREE.ExtrudeGeometry(new THREE.Shape(points), { depth: high - low, bevelEnabled: false });
        g.rotateX(-Math.PI / 2);
        g.scale(1, 1, -1);
        flipWinding(g);
        g.translate(0, low, 0);
        const pos = g.getAttribute("position"),
          uv = g.getAttribute("uv");
        for (let j = 0; j < uv.count; j++) uv.setXY(j, pos.getX(j), pos.getY(j));
        geos.push(g);
      }
  }
  const merged = geos.length ? mergeGeometries(geos) : null;
  geos.forEach((g) => g.dispose());
  return merged;
}

/**
 * Altura del cuerpo del muro exterior. En las plantas de abajo sube hasta la cara inferior de la losa de la planta siguiente
 * (`floorStep`): así el revestimiento sigue sin interrupción y no se ve la franja del canto de la losa entre plantas.
 */
export function exteriorSolidHeight(wallHeight: number, floor: number, floors: number, floorStep: number): number {
  return floor < floors - 1 && wallHeight < floorStep ? floorStep : wallHeight;
}

/**
 * Plantas que se dibujan. En las vistas con corte (Interior, Corte y Planta) se ve hasta la planta elegida: las de abajo siguen
 * ahí (con su escalera, sus muros y sus aberturas) y solo se miran (`inert`); las de arriba se ocultan para poder mirar adentro.
 * En Exterior se dibujan todas.
 */
export function floorsToDraw(cut: boolean, activeFloor: number, floors: number): { floor: number; inert: boolean }[] {
  const top = cut ? Math.min(Math.max(activeFloor, 0), floors - 1) : floors - 1;
  return Array.from({ length: top + 1 }, (_, floor) => ({ floor, inert: cut && floor < top }));
}
