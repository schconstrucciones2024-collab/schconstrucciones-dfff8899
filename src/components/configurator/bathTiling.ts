import * as THREE from "three";
import polygonClipping from "polygon-clipping";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { detectRooms, inside, miterPolygon, distance, type Point } from "@/config/geometry";
import { BATHROOM_TILE_HEIGHT } from "@/config/materials";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { designWalls, resolveWall, roomName, type HouseConfig } from "@/store/useConfigurator";

/**
 * Revestimiento cerámico de los baños de woodframe.
 *
 * Los ambientes que detecta `detectRooms` están medidos sobre el eje de las paredes; la cerámica va sobre la cara
 * real de cada pared, así que acá se descuenta el espesor de los muros del ambiente. De ese contorno interior salen:
 *  - `floors`: los polígonos del piso antideslizante (con agujeros si hay una columna o un núcleo adentro);
 *  - `faces`: un paño de cerámica por cada tramo de pared, ya recortado alrededor de puertas y ventanas.
 */
export type TileFace = {
  /** Inicio del tramo, sobre la cara de la pared. */
  a: Point;
  /** Dirección unitaria del tramo. */
  dir: Point;
  /** Normal unitaria, apuntando hacia adentro del baño. */
  n: Point;
  /** Tramo [t0, t1] medido desde `a` (m) y franja de altura [y0, y1] (m). */
  t0: number;
  t1: number;
  y0: number;
  y1: number;
};
export type BathSurfaces = { floors: Point[][][]; faces: TileFace[] };

/** Un ambiente "Baño" más grande que esto es un espacio abierto con un sanitario suelto, no un baño. */
export const BATH_MAX_AREA = 16;
export const isBathName = (name: string) => /^\s*(ba[ñn]o|toilette)/i.test(name);

type Ring = [number, number][];
const toRing = (pts: Point[]): Ring => pts.map((p) => [p.x, p.z]);
const fromRing = (r: Ring): Point[] => r.slice(0, -1).map(([x, z]) => ({ x, z }));

type Cut = { t0: number; t1: number; sill: number; top: number };

export function bathSurfaces(c: HouseConfig, floor: number): BathSurfaces {
  const out: BathSurfaces = { floors: [], faces: [] };
  const rooms = detectRooms(c.contour, c.walls[floor] ?? []);
  const baths = rooms.filter(
    (r, i) => r.area <= BATH_MAX_AREA && isBathName(roomName(c, floor, r, i)),
  );
  if (!baths.length) return out;
  const walls = designWalls(c, floor);
  const footprints = walls.map((w) => [toRing(miterPolygon(w, walls))] as [Ring]);
  const openings = c.openings
    .filter((o) => o.floor === floor)
    .flatMap((o) => {
      const seg = resolveWall(c, o.wall, floor);
      if (!seg) return [];
      const len = distance(seg.a, seg.b);
      if (len < 1e-6) return [];
      const dir = { x: (seg.b.x - seg.a.x) / len, z: (seg.b.z - seg.a.z) / len };
      const spec = OPENINGS_CATALOG[o.type];
      const center = {
        x: (seg.a.x + seg.b.x) / 2 + dir.x * o.offset,
        z: (seg.a.z + seg.b.z) / 2 + dir.z * o.offset,
      };
      return [
        {
          center,
          dir,
          half: spec.width / 2,
          sill: spec.sill,
          top: spec.sill + spec.height,
          thickness: seg.thickness,
        },
      ];
    });

  for (const room of baths) {
    const subject = [toRing(room.polygon), ...(room.holes ?? []).map(toRing)] as Ring[];
    const region = polygonClipping.difference(subject as never, ...(footprints as never[]));
    for (const poly of region) {
      const rings = poly.map((r) => fromRing(r as Ring));
      const outer = rings[0];
      if (!outer || outer.length < 3) continue;
      const holes = rings.slice(1);
      out.floors.push(rings);
      const inRegion = (p: Point) => inside(p, outer) && !holes.some((h) => inside(p, h));
      for (const ring of rings) {
        ring.forEach((a, i) => {
          const b = ring[(i + 1) % ring.length];
          if (!b) return;
          const len = distance(a, b);
          if (len < 0.04) return;
          const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
          let n = { x: -dir.z, z: dir.x };
          const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
          if (!inRegion({ x: mid.x + n.x * 0.03, z: mid.z + n.z * 0.03 })) n = { x: -n.x, z: -n.z };
          // Aberturas cuyo eje cae sobre este tramo de pared (misma recta, a media pared de distancia).
          const cuts: Cut[] = [];
          for (const o of openings) {
            if (Math.abs(o.dir.x * dir.z - o.dir.z * dir.x) > 0.02) continue;
            const off = { x: o.center.x - a.x, z: o.center.z - a.z };
            if (Math.abs(off.x * dir.z - off.z * dir.x) > o.thickness / 2 + 0.06) continue;
            const t = off.x * dir.x + off.z * dir.z;
            const t0 = Math.max(0, t - o.half),
              t1 = Math.min(len, t + o.half);
            if (t1 - t0 > 1e-4)
              cuts.push({ t0, t1, sill: o.sill, top: Math.min(o.top, BATHROOM_TILE_HEIGHT) });
          }
          cuts.sort((p, q) => p.t0 - q.t0);
          const add = (t0: number, t1: number, y0: number, y1: number) => {
            if (t1 - t0 > 1e-4 && y1 - y0 > 1e-4) out.faces.push({ a, dir, n, t0, t1, y0, y1 });
          };
          let cursor = 0;
          for (const cut of cuts) {
            if (cut.t1 <= cursor) continue;
            const start = Math.max(cut.t0, cursor);
            add(cursor, start, 0, BATHROOM_TILE_HEIGHT);
            add(start, cut.t1, 0, cut.sill);
            add(start, cut.t1, cut.top, BATHROOM_TILE_HEIGHT);
            cursor = cut.t1;
          }
          add(cursor, len, 0, BATHROOM_TILE_HEIGHT);
        });
      }
    }
  }
  return out;
}

/** Separación (m) entre la cerámica y la superficie que cubre, para que no se pisen al dibujar. */
export const TILE_LIFT = 0.004;

/** Piso: un polígono por baño, con UV en metros (la textura se repite según `MATERIAL_TILE_M`). */
export function bathFloorGeometry(surfaces: BathSurfaces): THREE.BufferGeometry | null {
  const geos = surfaces.floors.map((rings) => {
    const shape = new THREE.Shape((rings[0] ?? []).map((p) => new THREE.Vector2(p.x, -p.z)));
    for (const h of rings.slice(1))
      shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.z))));
    const g = new THREE.ShapeGeometry(shape);
    const uv = g.getAttribute("uv"),
      pos = g.getAttribute("position");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const merged = geos.length ? mergeGeometries(geos) : null;
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Paredes: un rectángulo por paño, con UV en metros (a lo largo de la pared y hacia arriba) y el frente hacia el baño. */
export function bathWallGeometry(surfaces: BathSurfaces): THREE.BufferGeometry | null {
  const faces = surfaces.faces;
  if (!faces.length) return null;
  const positions = new Float32Array(faces.length * 12),
    normals = new Float32Array(faces.length * 12),
    uvs = new Float32Array(faces.length * 8),
    index = new Uint32Array(faces.length * 6);
  faces.forEach((f, k) => {
    const corners: [number, number][] = [
      [f.t0, f.y0],
      [f.t1, f.y0],
      [f.t1, f.y1],
      [f.t0, f.y1],
    ];
    corners.forEach(([t, y], j) => {
      positions.set(
        [f.a.x + f.dir.x * t + f.n.x * TILE_LIFT, y, f.a.z + f.dir.z * t + f.n.z * TILE_LIFT],
        k * 12 + j * 3,
      );
      normals.set([f.n.x, 0, f.n.z], k * 12 + j * 3);
      uvs.set([t, y], k * 8 + j * 2);
    });
    // El frente de un paño (t hacia la derecha, y hacia arriba) mira hacia dir × arriba = (-dir.z, 0, dir.x).
    const front = -f.dir.z * f.n.x + f.dir.x * f.n.z > 0,
      b = k * 4;
    index.set(
      front ? [b, b + 1, b + 2, b, b + 2, b + 3] : [b, b + 2, b + 1, b, b + 3, b + 2],
      k * 6,
    );
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}
