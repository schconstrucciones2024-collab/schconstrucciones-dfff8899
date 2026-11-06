import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  bounds,
  distance,
  inside,
  isOrthogonal,
  offsetContour,
  planeHeight,
  project,
  roofFaces,
  signedArea,
  type Point,
  type RoofFace,
} from "./geometry";
import type { FinishId } from "./materials";

/**
 * Envolvente de la construcción tradicional: lo que hace que la casa se lea como una obra de mampostería y no como una
 * cabaña. Zócalo de hormigón, cintas entre plantas, y arriba, o bien una losa plana con antepecho, remate, membrana y bajada
 * pluvial (Clásica), o bien un techo de chapa bajo y prolijo con frontones de mampostería, cenefa, canaleta y bajada (Esencial).
 *
 * Son funciones puras (sin React) que devuelven geometrías three.js ya fusionadas por tipo de pieza; el componente
 * `TraditionalEnvelope` les pone el material. Todas las alturas son absolutas (el terreno está en y = 0).
 */
export type PartStyle = "concrete" | "plaster" | "roof" | "metal" | "pipe";
export type EnvelopePart = { id: string; style: PartStyle; geometry: THREE.BufferGeometry };

export type EnvelopeInput = {
  contour: Point[];
  finish: FinishId;
  /** Espesor del muro exterior (m). */
  thickness: number;
  floors: number;
  /** Altura donde termina la base (tope de la platea o de los pilotes). */
  groundTop: number;
  /** Nivel del piso terminado de la planta baja. */
  floorBase: number;
  floorStep: number;
  wallHeight: number;
  /** Espesor de la losa de entrepiso. */
  slabThickness: number;
  roofType: "una" | "dos" | "plano";
  roofPitch: number;
  roofDirection: "x" | "z";
  /** Alero medido desde la cara exterior del muro (m). */
  overhang: number;
};

/** Medidas de los detalles (m). */
export const ENVELOPE = {
  plinthProjection: 0.03,
  plinthHeight: 0.3,
  beltProjection: 0.02,
  slab: 0.18,
  slabProjection: 0.05,
  parapetHeight: 0.5,
  parapetThickness: 0.15,
  copingProjection: 0.03,
  copingHeight: 0.04,
  fasciaHeight: 0.16,
  fasciaThickness: 0.025,
  gutterHeight: 0.1,
  gutterDepth: 0.1,
  pipeRadius: 0.04,
  /** El techo de chapa apoya sobre el muro: se levanta unos centímetros para que no se hunda en su borde. */
  lift: 0.03,
};

const STYLES: Record<string, PartStyle> = {
  zocalo: "concrete",
  cintas: "plaster",
  losa: "plaster",
  antepecho: "plaster",
  remate: "concrete",
  frontones: "plaster",
  membrana: "roof",
  chapa: "roof",
  cenefa: "metal",
  canaleta: "metal",
  bajadas: "pipe",
};

type Add = (id: string, g: THREE.BufferGeometry) => void;

/** UV en metros (la textura repite cada tantos metros): planta para lo horizontal, largo del muro × altura para lo vertical. */
function setUV(g: THREE.BufferGeometry) {
  const p = g.getAttribute("position"),
    n = g.getAttribute("normal"),
    uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, -p.getX(i) * n.getZ(i) + p.getZ(i) * n.getX(i), p.getY(i));
  }
  uv.needsUpdate = true;
}

const toShapePoints = (pts: Point[]) => pts.map((p) => new THREE.Vector2(p.x, -p.z));

/** Anillo (o prisma macizo si `inner` es null) que sigue el contorno de la casa, de la altura y0 a y1. Los desplazamientos son
 * desde el eje del muro: positivo hacia afuera, negativo hacia adentro. */
function prism(
  contour: Point[],
  outer: number,
  inner: number | null,
  y0: number,
  y1: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape(toShapePoints(offsetContour(contour, outer)));
  if (inner !== null)
    shape.holes.push(new THREE.Path(toShapePoints(offsetContour(contour, inner))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  setUV(g);
  return g;
}

/** Superficie plana horizontal con la forma del contorno desplazado. */
function deck(contour: Point[], offset: number, y: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(new THREE.Shape(toShapePoints(offsetContour(contour, offset))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  setUV(g);
  return g;
}

/** Tabla fina que acompaña el borde a→b, con su canto superior a las alturas ya/yb y `height` de alto; sale hacia `out`. */
function board(
  a: Point,
  b: Point,
  ya: number,
  yb: number,
  height: number,
  thick: number,
  out: Point,
): THREE.BufferGeometry {
  const len = distance(a, b),
    dx = (b.x - a.x) / len,
    dz = (b.z - a.z) / len;
  const shape = new THREE.Shape([
    new THREE.Vector2(0, ya),
    new THREE.Vector2(len, yb),
    new THREE.Vector2(len, yb - height),
    new THREE.Vector2(0, ya - height),
  ]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  if (out.x * -dz + out.z * dx <= 0) g.translate(0, 0, -thick);
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(dx, 0, dz),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-dz, 0, dx),
  );
  m.setPosition(a.x, 0, a.z);
  g.applyMatrix4(m);
  setUV(g);
  return g;
}

/** Caño entre dos puntos. */
function pipe(p0: THREE.Vector3, p1: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const dir = p1.clone().sub(p0),
    len = dir.length();
  const g = new THREE.CylinderGeometry(radius, radius, len, 10, 1, false);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
  );
  const mid = p0.clone().add(p1).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  setUV(g);
  return g;
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!list.length) return null;
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(flat);
  for (const g of list) g.dispose();
  for (const g of flat) g.dispose();
  return merged;
}

/** Losa plana con antepecho, remate de hormigón, membrana y bajada pluvial. */
function addFlatRoof(i: EnvelopeInput, top: number, add: Add) {
  const half = i.thickness / 2,
    E = ENVELOPE;
  const slabTop = top + E.slab,
    parapetInner = half - E.parapetThickness,
    parapetTop = slabTop + E.parapetHeight;
  add("losa", prism(i.contour, half + E.slabProjection, null, top, slabTop));
  add("antepecho", prism(i.contour, half, parapetInner, slabTop, parapetTop));
  add(
    "remate",
    prism(
      i.contour,
      half + E.copingProjection,
      parapetInner - E.copingProjection,
      parapetTop,
      parapetTop + E.copingHeight,
    ),
  );
  add("membrana", deck(i.contour, parapetInner, slabTop + 0.003));
  // Bajada pluvial en la esquina más alejada del origen (un vértice extremo siempre es una esquina saliente).
  let corner = 0;
  i.contour.forEach((p, k) => {
    const best = i.contour[corner];
    if (best && p.x + p.z > best.x + best.z) corner = k;
  });
  const at = offsetContour(i.contour, half + E.pipeRadius)[corner];
  if (at)
    add(
      "bajadas",
      pipe(
        new THREE.Vector3(at.x, 0.02, at.z),
        new THREE.Vector3(at.x, slabTop - 0.05, at.z),
        E.pipeRadius * 1.15,
      ),
    );
}

/** Techo de chapa de una caída o doble agua, con frontones de mampostería, cenefa, canaleta y bajada. */
function addPitchedRoof(i: EnvelopeInput, top: number, add: Add) {
  const E = ENVELOPE,
    half = i.thickness / 2,
    reach = half + i.overhang,
    slope = Math.tan((Math.max(0, i.roofPitch) * Math.PI) / 180),
    b = bounds(i.contour),
    n = i.contour.length;
  const dos = i.roofType === "dos" && isOrthogonal(i.contour);
  const plane0 =
    i.roofDirection === "x"
      ? { x: slope, z: 0, c: -b.minX * slope }
      : { x: 0, z: slope, c: -b.minZ * slope };
  const faces: RoofFace[] = dos
    ? roofFaces(i.contour, i.roofDirection, slope)
    : [{ rings: [i.contour], plane: plane0 }];
  const offset = offsetContour(i.contour, reach);
  const roof: RoofFace[] = dos
    ? roofFaces(i.contour, i.roofDirection, slope, reach)
    : [{ rings: [offset], plane: plane0 }];
  const H = (face: RoofFace, p: Point) => planeHeight(face.plane, p) + E.lift;

  // Faldones.
  const pts: number[] = [],
    uv: number[] = [];
  for (const face of roof) {
    const outer = face.rings[0];
    if (!outer) continue;
    const holes = face.rings.slice(1),
      flat = [...outer, ...holes.flat()];
    const tris = THREE.ShapeUtils.triangulateShape(
      outer.map((p) => new THREE.Vector2(p.x, p.z)),
      holes.map((r) => r.map((p) => new THREE.Vector2(p.x, p.z))),
    );
    for (const tri of tris)
      for (const k of tri) {
        const p = flat[k];
        if (!p) continue;
        pts.push(p.x, top + H(face, p), p.z);
        uv.push(p.x, p.z);
      }
  }
  if (pts.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    add("chapa", g);
  }

  // Frontones: el muro sigue hasta el techo, a ras de la cara exterior del muro (no del eje).
  const sign = signedArea(i.contour) > 0 ? 1 : -1,
    outerCorners = offsetContour(i.contour, half);
  const edgeOf = (p: Point, q: Point) => {
    for (let k = 0; k < n; k++) {
      const a = i.contour[k],
        c = i.contour[(k + 1) % n];
      if (
        a &&
        c &&
        distance(project(p, a, c).point, p) < 1e-6 &&
        distance(project(q, a, c).point, q) < 1e-6
      )
        return k;
    }
    return -1;
  };
  const shiftOut = (p: Point, k: number): Point => {
    for (let j = 0; j < n; j++) {
      const v = i.contour[j];
      if (v && distance(v, p) < 1e-6) return outerCorners[j] ?? p;
    }
    const a = i.contour[k],
      c = i.contour[(k + 1) % n];
    if (!a || !c) return p;
    const len = distance(a, c) || 1;
    return {
      x: p.x + ((sign * (c.z - a.z)) / len) * half,
      z: p.z - ((sign * (c.x - a.x)) / len) * half,
    };
  };
  const gab: number[] = [],
    gabUv: number[] = [];
  for (const face of faces)
    for (const ring of face.rings)
      ring.forEach((a0, idx) => {
        const c0 = ring[(idx + 1) % ring.length];
        if (!c0) return;
        const k = edgeOf(a0, c0);
        if (k < 0) return;
        const a = shiftOut(a0, k),
          c = shiftOut(c0, k),
          ha = Math.max(0, H(face, a)),
          hc = Math.max(0, H(face, c));
        if (ha + hc < 1e-7) return;
        const len = distance(a, c) || 1,
          ux = (c.x - a.x) / len,
          uz = (c.z - a.z) / len,
          u = (p: Point) => p.x * ux + p.z * uz;
        gab.push(
          a.x,
          top,
          a.z,
          c.x,
          top,
          c.z,
          c.x,
          top + hc,
          c.z,
          a.x,
          top,
          a.z,
          c.x,
          top + hc,
          c.z,
          a.x,
          top + ha,
          a.z,
        );
        gabUv.push(u(a), 0, u(c), 0, u(c), hc, u(a), 0, u(c), hc, u(a), ha);
      });
  if (gab.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(gab, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(gabUv, 2));
    g.computeVertexNormals();
    add("frontones", g);
  }

  // Cenefa en todo el borde del techo y canaleta en los aleros (bordes horizontales más bajos).
  const onRing = (p: Point, q: Point) =>
    offset.some((a, k) => {
      const c = offset[(k + 1) % offset.length];
      return (
        !!c &&
        distance(project(p, a, c).point, p) < 1e-5 &&
        distance(project(q, a, c).point, q) < 1e-5
      );
    });
  type Seg = { p: Point; q: Point; hp: number; hq: number; out: Point };
  const segs: Seg[] = [];
  for (const face of roof) {
    const ring = face.rings[0];
    if (!ring) continue;
    ring.forEach((p, idx) => {
      const q = ring[(idx + 1) % ring.length];
      if (!q) return;
      const len = distance(p, q);
      if (len < 1e-6 || !onRing(p, q)) return;
      const dx = (q.x - p.x) / len,
        dz = (q.z - p.z) / len,
        mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
      let out: Point = { x: -dz, z: dx };
      if (inside({ x: mid.x + out.x * 0.05, z: mid.z + out.z * 0.05 }, offset, false))
        out = { x: dz, z: -dx };
      segs.push({ p, q, hp: H(face, p), hq: H(face, q), out });
    });
  }
  for (const s of segs)
    add(
      "cenefa",
      board(
        s.p,
        s.q,
        top + s.hp + 0.01,
        top + s.hq + 0.01,
        E.fasciaHeight,
        E.fasciaThickness,
        s.out,
      ),
    );
  const level = segs.filter((s) => Math.abs(s.hp - s.hq) < 1e-3);
  const eave = level.length ? Math.min(...level.map((s) => s.hp)) : Infinity;
  const gutters = level.filter((s) => s.hp <= eave + 0.02);
  const push = (p: Point, out: Point, d: number): Point => ({
    x: p.x + out.x * d,
    z: p.z + out.z * d,
  });
  for (const s of gutters) {
    const y = top + s.hp - 0.05;
    add(
      "canaleta",
      board(
        push(s.p, s.out, E.fasciaThickness),
        push(s.q, s.out, E.fasciaThickness),
        y,
        y,
        E.gutterHeight,
        E.gutterDepth,
        s.out,
      ),
    );
  }
  // Bajada pegada a la esquina donde termina la primera canaleta, con un codo desde la canaleta.
  const first = gutters[0];
  if (first) {
    for (const end of [first.q, first.p]) {
      const j = offset.findIndex((v) => distance(v, end) < 1e-4);
      const at = j >= 0 ? offsetContour(i.contour, half + E.pipeRadius)[j] : undefined;
      if (!at) continue;
      const g = push(end, first.out, E.fasciaThickness + E.gutterDepth / 2),
        y = top + first.hp - 0.05 - E.gutterHeight / 2;
      add(
        "bajadas",
        pipe(new THREE.Vector3(g.x, y, g.z), new THREE.Vector3(at.x, y, at.z), E.pipeRadius * 0.9),
      );
      add(
        "bajadas",
        pipe(new THREE.Vector3(at.x, 0.02, at.z), new THREE.Vector3(at.x, y, at.z), E.pipeRadius),
      );
      break;
    }
  }
}

/** Todas las piezas de la envolvente (zócalo, cintas y techo) de una casa tradicional. */
export function buildEnvelope(i: EnvelopeInput): EnvelopePart[] {
  const E = ENVELOPE,
    half = i.thickness / 2,
    top = i.floorBase + (i.floors - 1) * i.floorStep + i.wallHeight;
  const bag = new Map<string, THREE.BufferGeometry[]>();
  const add: Add = (id, g) => {
    const list = bag.get(id);
    if (list) list.push(g);
    else bag.set(id, [g]);
  };
  // Zócalo de hormigón: cubre el canto de la losa del piso y sobresale unos centímetros del revoque.
  add(
    "zocalo",
    prism(i.contour, half + E.plinthProjection, -half, i.groundTop, i.floorBase + E.plinthHeight),
  );
  // Cintas entre plantas: tapan el canto de la losa de entrepiso.
  for (let f = 1; f < i.floors; f++) {
    const y = i.floorBase + f * i.floorStep;
    add("cintas", prism(i.contour, half + E.beltProjection, -half, y - i.slabThickness, y));
  }
  if (i.finish === "clasica") addFlatRoof(i, top, add);
  else addPitchedRoof(i, top, add);
  const parts: EnvelopePart[] = [];
  for (const [id, list] of bag) {
    const geometry = merge(list);
    if (geometry) parts.push({ id, style: STYLES[id] ?? "plaster", geometry });
  }
  return parts;
}
