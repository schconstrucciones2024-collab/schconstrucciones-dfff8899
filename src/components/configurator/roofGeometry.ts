import * as THREE from "three";
import {
  bounds,
  distance,
  isOrthogonal,
  offsetContour,
  planeHeight,
  roofFaces,
  signedArea,
  type Point,
  type RoofFace,
} from "@/config/geometry";
import { exteriorThickness } from "@/config/systems";
import { TOP_WALL_HEIGHT, type HouseConfig } from "@/store/useConfigurator";

/**
 * Techo de las casas livianas (woodframe), separado del componente para poder probarlo: los faldones de chapa y los frontones
 * (el muro que sigue hasta el techo). Las coordenadas son las de la casa; el techo se apoya en `TOP_WALL_HEIGHT` sobre el piso de
 * la última planta, así que las alturas empiezan en 0 sobre el borde superior del muro.
 */

/** Holgura entre la chapa y el borde superior del muro: la chapa apoya siempre por encima, nunca a ras (evita el borde blanco que asomaba). */
export const ROOF_SEAT = 0.004;
/** El fronton arranca un poco por debajo del borde superior del muro para que no quede ninguna rendija entre los dos. */
export const GABLE_OVERLAP = 0.004;

/** Cuánto se sube el techo: lo justo para que, sobre la cara exterior del muro, la chapa quede por encima de su borde superior. */
export function roofLift(slope: number, wallThickness: number): number {
  return (slope * wallThickness) / 2 + ROOF_SEAT;
}

type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

export function buildRoofGeometry(c: Pick<HouseConfig, "contour" | "roofType" | "roofPitch" | "roofDirection" | "overhang" | "finish">) {
  const b = bounds(c.contour),
    slope = Math.tan(((c.roofType === "plano" ? 3 : c.roofPitch) * Math.PI) / 180),
    thickness = exteriorThickness(c.finish),
    half = thickness / 2,
    lift = roofLift(slope, thickness),
    orthogonalGable = c.roofType === "dos" && isOrthogonal(c.contour);

  const faces: RoofFace[] = orthogonalGable
    ? roofFaces(c.contour, c.roofDirection, slope)
    : [{ rings: [c.contour], plane: c.roofDirection === "x" ? { x: slope, z: 0, c: -b.minX * slope } : { x: 0, z: slope, c: -b.minZ * slope } }];
  const roof: RoofFace[] = orthogonalGable
    ? roofFaces(c.contour, c.roofDirection, slope, c.overhang)
    : [{ ...faces[0]!, rings: [offsetContour(c.contour, c.overhang)] }];

  // Faldones. Cada triángulo se ordena para que mire hacia arriba: así la cara "delantera" es la de arriba (la que se ve) en
  // todos los pasos de dibujo, incluida la oclusión ambiental, que solo dibuja caras delanteras.
  const pts: number[] = [],
    uv: number[] = [];
  for (const face of roof) {
    const outer = face.rings[0];
    if (!outer) continue;
    const holes = face.rings.slice(1),
      flat = [...outer, ...holes.flat()],
      indices = THREE.ShapeUtils.triangulateShape(
        outer.map((p) => new THREE.Vector2(p.x, p.z)),
        holes.map((r) => r.map((p) => new THREE.Vector2(p.x, p.z))),
      );
    for (const triangle of indices) {
      const corners = triangle.map((i) => flat[i]);
      if (corners.some((p) => !p)) continue;
      const v = (corners as Point[]).map((p) => new THREE.Vector3(p.x, planeHeight(face.plane, p) + lift, p.z)) as Tri;
      const up = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
      if (up.y < 0) v.reverse();
      for (const q of v) {
        pts.push(q.x, q.y, q.z);
        if (c.roofDirection === "x") uv.push(q.z, q.x);
        else uv.push(q.x, q.z);
      }
    }
  }

  // Frontones: el muro sigue hasta el techo, a ras de la cara EXTERIOR del muro (no del eje) y con el mismo revestimiento, para
  // que no se note un escalón ni un tramo más angosto entre el muro de la casa y el muro que sube bajo el techo.
  const n = c.contour.length,
    sign = signedArea(c.contour) > 0 ? 1 : -1,
    outerCorners = offsetContour(c.contour, half),
    gables: number[] = [],
    gableUv: number[] = [],
    T = TOP_WALL_HEIGHT;
  for (const face of faces) {
    // Solo sobre el borde de la planta, nunca sobre cumbreras ni limahoyas. Un borde del faldón puede cubrir solo una parte del
    // lado de la planta (por ejemplo en una L: el faldón sigue hacia adentro de la casa), así que se toma el tramo que coincide.
    for (const ring of face.rings)
      ring.forEach((a0, i) => {
        const b0 = ring[(i + 1) % ring.length];
        if (!b0) return;
        for (let k = 0; k < n; k++) {
          const w0 = c.contour[k],
            w1 = c.contour[(k + 1) % n];
          if (!w0 || !w1) continue;
          const len = distance(w0, w1);
          if (len < 1e-9) continue;
          const dx = (w1.x - w0.x) / len,
            dz = (w1.z - w0.z) / len,
            off = (p: Point) => Math.abs((p.x - w0.x) * dz - (p.z - w0.z) * dx),
            along = (p: Point) => (p.x - w0.x) * dx + (p.z - w0.z) * dz;
          if (off(a0) > 1e-6 || off(b0) > 1e-6) continue;
          const ta = along(a0),
            tb = along(b0),
            lo = Math.max(Math.min(ta, tb), 0),
            hi = Math.min(Math.max(ta, tb), len);
          if (hi - lo < 1e-6) continue;
          // Hacia afuera del muro (a la cara exterior): en las esquinas, la esquina exterior de la planta; en el resto, un corrimiento perpendicular.
          const nx = sign * dz,
            nz = -sign * dx,
            at = (t: number): Point => {
              if (t <= 1e-6) return outerCorners[k] ?? w0;
              if (t >= len - 1e-6) return outerCorners[(k + 1) % n] ?? w1;
              return { x: w0.x + dx * t + nx * half, z: w0.z + dz * t + nz * half };
            },
            a = at(lo),
            e = at(hi),
            top = (p: Point) => Math.max(0, planeHeight(face.plane, p) + slope * half),
            ha = top(a),
            hb = top(e);
          if (ha + hb < 1e-7) continue;
          const base = -GABLE_OVERLAP,
            // Orden de los vértices: la normal del triángulo mira hacia afuera de la casa.
            tri = new THREE.Vector3(e.x - a.x, 0, e.z - a.z).cross(new THREE.Vector3(0, 1, 0)),
            flip = tri.x * nx + tri.z * nz < 0,
            P = flip ? [e, a] : [a, e],
            H = flip ? [hb, ha] : [ha, hb],
            u = (p: Point) => ((p.x - (w0.x + w1.x) / 2) * dx + (p.z - (w0.z + w1.z) / 2) * dz);
          const [p0, p1] = P as [Point, Point],
            [h0, h1] = H as [number, number];
          gables.push(p0.x, base, p0.z, p1.x, base, p1.z, p1.x, h1, p1.z, p0.x, base, p0.z, p1.x, h1, p1.z, p0.x, h0, p0.z);
          // UV como las del muro de abajo (a lo largo del muro desde su centro; la altura sigue contando desde el piso de esa planta).
          gableUv.push(u(p0), T + base, u(p1), T + base, u(p1), T + h1, u(p0), T + base, u(p1), T + h1, u(p0), T + h0);
        }
      });
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const ends = new THREE.BufferGeometry();
  ends.setAttribute("position", new THREE.Float32BufferAttribute(gables, 3));
  ends.setAttribute("uv", new THREE.Float32BufferAttribute(gableUv, 2));
  ends.computeVertexNormals();
  return { g, ends };
}
