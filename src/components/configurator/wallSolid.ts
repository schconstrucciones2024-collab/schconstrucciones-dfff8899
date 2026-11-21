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

type V3 = [number, number, number];

/** Acumula triángulos con su normal y su UV; cada triángulo se ordena para que mire hacia donde se pide. */
function triangleSink() {
  const pos: number[] = [],
    nor: number[] = [],
    uv: number[] = [];
  return {
    tri(a: V3, b: V3, c: V3, n: V3, uvOf: (v: V3) => [number, number]) {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as V3,
        e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as V3,
        cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
        facing = cross[0]! * n[0] + cross[1]! * n[1] + cross[2]! * n[2];
      if (Math.abs(facing) < 1e-14) return;
      const order = facing < 0 ? [a, c, b] : [a, b, c];
      for (const v of order) {
        pos.push(v[0], v[1], v[2]);
        nor.push(n[0], n[1], n[2]);
        uv.push(...uvOf(v));
      }
    },
    quad(a: V3, b: V3, c: V3, d: V3, n: V3, uvOf: (v: V3) => [number, number]) {
      this.tri(a, b, c, n, uvOf);
      this.tri(a, c, d, n, uvOf);
    },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      return g;
    },
  };
}

const EPS = 1e-6;

/** Valores distintos (con tolerancia) ordenados de menor a mayor, solo los que cumplen `keep`. */
function uniqueSorted(values: number[], keep: (v: number) => boolean): number[] {
  const out: number[] = [];
  for (const v of [...values].filter(keep).sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1]! > EPS) out.push(v);
  return out;
}

/** Alturas (sobre el piso) donde empieza o termina algún hueco de cualquier abertura del catálogo. */
const CATALOG_LEVELS = Object.values(OPENINGS_CATALOG).flatMap((o) => [Math.max(0, o.sill), o.sill + o.height]);

/**
 * Cuerpo macizo del muro armado de una sola pieza, sin cortes intermedios: la cara exterior y la interior son UN polígono cada
 * una (con los huecos de las ventanas y las muescas de las puertas), y los vanos tienen sus jambas, dintel y antepecho.
 *
 * Antes el muro se partía en tramos verticales en cada ventana y cada tramo se extruía aparte. Entre tramos quedaban caras
 * internas pegadas al revestimiento, y en el visor (oclusión ambiental y sombras) asomaban como una raya fina de arriba abajo del
 * muro, también por encima y por debajo de las ventanas. Acá no hay ninguna cara interna.
 *
 * Sin cara inferior (queda siempre apoyada sobre la losa o sobre el muro de abajo). La cara superior es opcional: en las plantas de
 * abajo la tapa el muro de arriba y no se dibuja, para que no haya otra raya en la unión entre plantas.
 *
 * Devuelve `null` si la planta no es la de un muro común (dos caras largas paralelas) o si hay aberturas que se pisan o se salen
 * del tramo recto; en ese caso se usa el armado por tramos.
 */
export function buildContinuousSolid(ring: Point[], cuts: WallCut[], height: number, withTop: boolean): THREE.BufferGeometry | null {
  const pts = ring.filter((p, i) => {
    const prev = ring[(i + ring.length - 1) % ring.length]!;
    return Math.hypot(p.x - prev.x, p.z - prev.z) > 1e-9;
  });
  if (pts.length < 3 || height <= EPS) return null;
  let area = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    area += p.x * q.z - q.x * p.z;
  });
  if (Math.abs(area) < 1e-9) return null;
  const ccw = area > 0;

  type Edge = { p: Point; q: Point; long: boolean };
  const edges: Edge[] = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return { p, q, long: Math.abs(q.z - p.z) < EPS && Math.abs(q.x - p.x) > EPS };
  });
  const longs = edges.filter((e) => e.long);
  if (longs.length !== 2 || Math.abs(longs[0]!.p.z - longs[1]!.p.z) < EPS) return null;
  const lo = Math.max(...longs.map((e) => Math.min(e.p.x, e.q.x))),
    hi = Math.min(...longs.map((e) => Math.max(e.p.x, e.q.x))),
    zA = Math.min(longs[0]!.p.z, longs[1]!.p.z),
    zB = Math.max(longs[0]!.p.z, longs[1]!.p.z);

  const ops = cuts
    .map((o) => {
      const spec = OPENINGS_CATALOG[o.type];
      return { x0: o.offset - spec.width / 2, x1: o.offset + spec.width / 2, y0: Math.max(0, spec.sill), y1: spec.sill + spec.height, door: spec.sill < EPS };
    })
    .sort((a, b) => a.x0 - b.x0);
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i]!;
    if (o.x0 < lo + EPS || o.x1 > hi - EPS || o.x1 - o.x0 < EPS || o.y1 > height - EPS || o.y1 - o.y0 < EPS) return null;
    const next = ops[i + 1];
    if (next && next.x0 < o.x1 + EPS) return null;
  }

  const sink = triangleSink();
  const uvXY = (v: V3): [number, number] => [v[0], v[1]],
    uvZY = (v: V3): [number, number] => [v[2], v[1]],
    uvXZ = (v: V3): [number, number] => [v[0], v[2]];

  // Niveles de altura donde se corta TODA la malla del muro: los de las aberturas de este muro y los de todas las del catálogo.
  // Así dos muros que se encuentran en una esquina tienen los mismos vértices a lo largo de la arista vertical y la malla no queda
  // con "juntas en T" (un vértice a mitad de una arista vecina), que a veces dejan un píxel suelto, como una rayita transparente.
  const levels = uniqueSorted([0, height, ...ops.flatMap((o) => [o.y0, o.y1]), ...CATALOG_LEVELS], (v) => v > -EPS && v < height + EPS).map((v) => Math.min(Math.max(v, 0), height));
  const inHole = (x: number, y: number) => ops.some((o) => x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1);

  // Caras largas (exterior e interior): una grilla completa (sin juntas en T) con los huecos de las aberturas sin rellenar.
  const faceXs: Record<string, number[]> = {};
  for (const e of longs) {
    const z = e.p.z,
      outward = (ccw ? -1 : 1) * Math.sign(e.q.x - e.p.x),
      fLo = Math.min(e.p.x, e.q.x),
      fHi = Math.max(e.p.x, e.q.x),
      xs = uniqueSorted([fLo, fHi, ...ops.flatMap((o) => [o.x0, o.x1])], (v) => v > fLo - EPS && v < fHi + EPS).map((v) => Math.min(Math.max(v, fLo), fHi));
    faceXs[String(z)] = xs;
    for (let i = 0; i + 1 < xs.length; i++)
      for (let j = 0; j + 1 < levels.length; j++) {
        const x0 = xs[i]!, x1 = xs[i + 1]!, y0 = levels[j]!, y1 = levels[j + 1]!;
        if (inHole((x0 + x1) / 2, (y0 + y1) / 2)) continue;
        sink.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, outward], uvXY);
      }
  }

  // Vanos: jambas, dintel y antepecho (la cara que mira hacia adentro del vano). Las jambas siguen los mismos niveles que la cara.
  for (const o of ops) {
    const ys = levels.filter((y) => y > o.y0 - EPS && y < o.y1 + EPS);
    for (let j = 0; j + 1 < ys.length; j++) {
      const y0 = ys[j]!, y1 = ys[j + 1]!;
      sink.quad([o.x0, y0, zA], [o.x0, y0, zB], [o.x0, y1, zB], [o.x0, y1, zA], [1, 0, 0], uvZY);
      sink.quad([o.x1, y0, zA], [o.x1, y0, zB], [o.x1, y1, zB], [o.x1, y1, zA], [-1, 0, 0], uvZY);
    }
    sink.quad([o.x0, o.y1, zA], [o.x1, o.y1, zA], [o.x1, o.y1, zB], [o.x0, o.y1, zB], [0, -1, 0], uvXZ);
    if (!o.door) sink.quad([o.x0, o.y0, zA], [o.x1, o.y0, zA], [o.x1, o.y0, zB], [o.x0, o.y0, zB], [0, 1, 0], uvXZ);
  }

  // Extremos (a inglete): con los mismos niveles que las caras largas.
  for (const e of edges) {
    if (e.long) continue;
    const dx = e.q.x - e.p.x,
      dz = e.q.z - e.p.z,
      l = Math.hypot(dx, dz),
      n: V3 = ccw ? [dz / l, 0, -dx / l] : [-dz / l, 0, dx / l],
      uvEnd = (v: V3): [number, number] => [Math.abs(dx) > EPS ? v[0] : v[2], v[1]];
    for (let j = 0; j + 1 < levels.length; j++) {
      const y0 = levels[j]!, y1 = levels[j + 1]!;
      sink.quad([e.p.x, y0, e.p.z], [e.q.x, y0, e.q.z], [e.q.x, y1, e.q.z], [e.p.x, y1, e.p.z], n, uvEnd);
    }
  }

  // Cara superior: una cinta entre los bordes superiores de las dos caras largas, con los mismos vértices que ellas.
  if (withTop) {
    const rows = longs.map((e) => ({ z: e.p.z, xs: faceXs[String(e.p.z)] ?? [] }));
    const [ra, rb] = rows as [{ z: number; xs: number[] }, { z: number; xs: number[] }];
    let i = 0,
      j = 0;
    while (i + 1 < ra.xs.length || j + 1 < rb.xs.length) {
      const moveA = j + 1 >= rb.xs.length || (i + 1 < ra.xs.length && ra.xs[i + 1]! <= rb.xs[j + 1]! + EPS),
        a: V3 = [ra.xs[i]!, height, ra.z],
        b: V3 = [rb.xs[j]!, height, rb.z];
      if (moveA) sink.tri(a, b, [ra.xs[i + 1]!, height, ra.z], [0, 1, 0], uvXZ), i++;
      else sink.tri(a, b, [rb.xs[j + 1]!, height, rb.z], [0, 1, 0], uvXZ), j++;
    }
  }
  return sink.geometry();
}

/**
 * Armado de respaldo: la planta (con inglete) extruida hasta `height`, partida en los vanos de las aberturas; los tramos sobre y
 * bajo cada ventana o puerta se arman aparte. Se usa solo cuando el muro no es de los comunes (ver `buildContinuousSolid`).
 */
export function buildSlabSolid(ring: Point[], cuts: WallCut[], height: number): THREE.BufferGeometry | null {
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

export type SolidOptions = {
  /** Si se dibuja la cara superior del muro (por defecto sí). En una planta con otra encima no hace falta: la tapa el muro de arriba. */
  top?: boolean;
};

/**
 * Cuerpo macizo del muro (planta con inglete extruida hasta `height`, con los vanos de las aberturas). UV en metros (x a lo largo,
 * y hacia arriba). Ver `buildContinuousSolid`.
 */
export function buildWallSolid(ring: Point[], cuts: WallCut[], height: number, options: SolidOptions = {}): THREE.BufferGeometry | null {
  return buildContinuousSolid(ring, cuts, height, options.top !== false) ?? buildSlabSolid(ring, cuts, height);
}

/** Cuánto se prolonga hacia arriba el muro de una planta con otra encima: se solapa unos milímetros con el de arriba y no queda rendija. */
export const JOINT_OVERLAP = 0.004;

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
