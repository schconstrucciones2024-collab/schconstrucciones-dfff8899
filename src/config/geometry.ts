import { orient2d } from "robust-predicates";
import polygonClipping from "polygon-clipping";
export type Point = { x: number; z: number };
export type Segment = {
  id: string;
  a: Point;
  b: Point;
  thickness: number;
  height: number;
  locked?: boolean;
};
export type Counter = {
  id: string;
  floor: number;
  x: number;
  z: number;
  rotation: number;
  length: number;
  depth: number;
  height: number;
  kind: "cocina" | "bano";
  material: "pino" | "drywall";
  shape: "lineal" | "L";
  locked?: boolean;
};
/** Movable furniture/sanitary pieces. Sizes are fixed per kind (meters, local x = width, z = depth). */
export type FixtureKind = "wc" | "ducha" | "cama";
export const FIXTURE_SIZES: Record<FixtureKind, { width: number; depth: number; name: string }> = {
  wc: { width: 0.4, depth: 0.7, name: "Inodoro (WC)" },
  ducha: { width: 0.9, depth: 0.9, name: "Ducha" },
  cama: { width: 1.4, depth: 1.9, name: "Cama matrimonial" },
};
export type Fixture = {
  id: string;
  floor: number;
  x: number;
  z: number;
  rotation: number;
  kind: FixtureKind;
  locked?: boolean;
};
export type Stair = {
  id: string;
  floor: number;
  x: number;
  z: number;
  rotation: number;
  width: number;
  type: "recta" | "L" | "U" | "caracol";
  reverse: boolean;
  closed: boolean;
  exterior: boolean;
  wall?: string;
  offset?: number;
  rail: boolean;
  locked?: boolean;
};
export type Room = { id: string; polygon: Point[]; holes?: Point[][]; area: number; center: Point };
export type Footprint = "rectangular" | "L" | "U" | "T" | "escalonada";
export const GEOMETRY = {
  exteriorThickness: 0.15,
  interiorThickness: 0.1,
  wallHeight: 2.65,
  slabThickness: 0.2,
  pileHeight: 0.65,
  ceilingThickness: 0.07,
  minSide: 1.5,
  minArea: 10,
  snap: 0.1,
  headroom: 2,
  railHeight: 1,
};
export const snap = (v: number) => Math.round(v / GEOMETRY.snap) * GEOMETRY.snap;
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function signedArea(p: Point[]) {
  return (
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return b ? s + a.x * b.z - b.x * a.z : s;
    }, 0) / 2
  );
}
export const polygonArea = (p: Point[]) => Math.abs(signedArea(p));
export function bounds(p: Point[]) {
  const xs = p.map((v) => v.x),
    zs = p.map((v) => v.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}
export function scalePolygon(p: Point[], area: number) {
  const b = bounds(p),
    cx = (b.minX + b.maxX) / 2,
    cz = (b.minZ + b.maxZ) / 2,
    k = Math.sqrt(area / polygonArea(p));
  return p.map((v) => ({ x: cx + (v.x - cx) * k, z: cz + (v.z - cz) * k }));
}
export function presetPolygon(type: Footprint, area: number, elongated = false): Point[] {
  const shapes: Record<Footprint, number[][]> = {
    rectangular: [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4],
    ],
    L: [
      [0, 0],
      [6, 0],
      [6, 3],
      [3, 3],
      [3, 6],
      [0, 6],
    ],
    U: [
      [0, 0],
      [9, 0],
      [9, 7],
      [6, 7],
      [6, 3],
      [3, 3],
      [3, 7],
      [0, 7],
    ],
    T: [
      [0, 0],
      [9, 0],
      [9, 3],
      [6, 3],
      [6, 7],
      [3, 7],
      [3, 3],
      [0, 3],
    ],
    escalonada: [
      [0, 0],
      [6, 0],
      [6, 3],
      [9, 3],
      [9, 6],
      [3, 6],
      [3, 3],
      [0, 3],
    ],
  };
  const p = shapes[type].map((v) => ({ x: (v[0] ?? 0) * (elongated ? 1.3 : 1), z: v[1] ?? 0 }));
  const b = bounds(p);
  return scalePolygon(
    p.map((v) => ({ x: v.x - b.width / 2, z: v.z - b.depth / 2 })),
    area,
  );
}
export function project(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return { point: { x: a.x + dx * t, z: a.z + dz * t }, t };
}
export function inside(p: Point, ring: Point[], edge = true) {
  let yes = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    if (distance(project(p, a, b).point, p) < 1e-6) return edge;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x)
      yes = !yes;
  }
  return yes;
}
function intersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    ex = d.x - c.x,
    ez = d.z - c.z,
    den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * ez - (c.z - a.z) * ex) / den,
    u = ((c.x - a.x) * dz - (c.z - a.z) * dx) / den;
  return t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7
    ? { x: a.x + t * dx, z: a.z + t * dz }
    : null;
}
export function validateContour(p: Point[], floors: number) {
  if (p.length < 3 || p.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.z)))
    return "Contorno inválido.";
  if(p.some((a,i)=>p.some((b,j)=>i!==j&&distance(a,b)<1e-7)))return "El contorno no puede repetir vértices.";
  for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if(!a||!b||!c)continue;if(Math.abs(orient2d(a.x,a.z,b.x,b.z,c.x,c.z))<1e-9&&(a.x-b.x)*(c.x-b.x)+(a.z-b.z)*(c.z-b.z)>1e-8)return "El contorno no puede superponerse.";}
  const area = polygonArea(p) * floors;
  if (area < 10 - 1e-5 || area > 200 + 1e-5)
    return "La superficie total debe estar entre 10 y 200 m².";
  if (floors > 1 && polygonArea(p) < 20 - 1e-5) return "Mínimo 20 m² por planta.";
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    if (!a || !b) continue;
    if (distance(a, b) < GEOMETRY.minSide - 1e-6) return "Cada lado debe medir al menos 1,5 m.";
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      const c = p[j],
        d = p[(j + 1) % p.length];
      if (!c || !d) continue;
      if (
        intersection(a, b, c, d) ||
        distance(project(c, a, b).point, c) < 1e-7 ||
        distance(project(d, a, b).point, d) < 1e-7
      )
        return "El contorno no puede cruzarse.";
    }
  }
  return null;
}
export const isOrthogonal = (p: Point[]) =>
  p.every((a, i) => {
    const b = p[(i + 1) % p.length];
    return b && (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.z - b.z) < 1e-6);
  });
export function exteriorSegments(p: Point[], thickness: number = GEOMETRY.exteriorThickness): Segment[] {
  return p.map((a, i) => ({
    id: `edge-${i}`,
    a,
    b: p[(i + 1) % p.length] ?? a,
    thickness,
    height: GEOMETRY.wallHeight,
  }));
}
/** Split all crossings and T junctions, then walk the left face of every half-edge. */
export function detectRooms(contour: Point[], walls: Segment[]): Room[] {
  const segments = [...exteriorSegments(contour), ...walls],
    nodes = new Map<string, Point>(),
    adj = new Map<string, Set<string>>();
  const key = (p: Point) => `${Math.round(p.x * 1e6)},${Math.round(p.z * 1e6)}`;
  segments.forEach((s, i) => {
    const pts = [s.a, s.b];
    segments.forEach((t, j) => {
      if (i === j) return;
      const p = intersection(s.a, s.b, t.a, t.b);
      if (p) pts.push(p);
      for (const v of [t.a, t.b]) if (distance(project(v, s.a, s.b).point, v) < 1e-6) pts.push(v);
    });
    pts.sort((a, b) => project(a, s.a, s.b).t - project(b, s.a, s.b).t);
    for (let j = 0; j < pts.length - 1; j++) {
      const a = pts[j],
        b = pts[j + 1];
      if (!a || !b || distance(a, b) < 1e-6) continue;
      const ka = key(a),
        kb = key(b);
      nodes.set(ka, a);
      nodes.set(kb, b);
      if (!adj.has(ka)) adj.set(ka, new Set());
      if (!adj.has(kb)) adj.set(kb, new Set());
      adj.get(ka)?.add(kb);
      adj.get(kb)?.add(ka);
    }
  });
  const sorted = new Map<string, string[]>();
  adj.forEach((ns, k) => {
    const a = nodes.get(k);
    if (a)
      sorted.set(
        k,
        [...ns].sort((u, v) => {
          const b = nodes.get(u),
            c = nodes.get(v);
          return b && c ? Math.atan2(b.z - a.z, b.x - a.x) - Math.atan2(c.z - a.z, c.x - a.x) : 0;
        }),
      );
  });
  const used = new Set<string>(),
    rooms: Room[] = [];
  sorted.forEach((ns, start) =>
    ns.forEach((next) => {
      if (used.has(`${start}>${next}`)) return;
      let u = start,
        v = next;
      const ring: Point[] = [];
      let closed=false;
      const edgeCount=[...adj.values()].reduce((sum,ns)=>sum+ns.size,0);
      for (let count = 0; count <= edgeCount; count++) {
        const token = `${u}>${v}`;
        if (used.has(token)) break;
        used.add(token);
        const p = nodes.get(u);
        if (p) ring.push(p);
        const neighbors = sorted.get(v);
        if (!neighbors?.length) break;
        const index = neighbors.indexOf(u),
          w = neighbors[(index - 1 + neighbors.length) % neighbors.length];
        if (!w) break;
        u = v;
        v = w;
        if (u === start && v === next) {closed=true;break;}
      }
      const area = signedArea(ring);
      if (closed && area > 0.01) {
        const center = centroid(ring);
        if (inside(center, contour) || ring.every((p) => inside(p, contour)))
          rooms.push({ id: ring.map(key).sort().join("|"), polygon: ring, area, center });
      }
    }),
  );
  return rooms.map(room=>{
    const contained=rooms.filter(other=>other!==room&&other.area<room.area-1e-6&&other.polygon.every(p=>inside(p,room.polygon)));
    const children=contained.filter(child=>!contained.some(parent=>parent!==child&&parent.area>child.area&&child.polygon.every(p=>inside(p,parent.polygon))));
    const holes=children.map(child=>child.polygon),area=room.area-children.reduce((sum,child)=>sum+child.area,0);
    let center=room.center;
    if(holes.some(h=>inside(center,h))||!inside(center,room.polygon)){
      const b=bounds(room.polygon);let found=false;
      for(let i=1;i<40&&!found;i++)for(let j=1;j<40&&!found;j++){
        const p={x:b.minX+b.width*i/40,z:b.minZ+b.depth*j/40};
        if(inside(p,room.polygon,false)&&!holes.some(h=>inside(p,h))){center=p;found=true;}
      }
    }
    return {...room,holes,area,center};
  });
}
export function centroid(p: Point[]): Point {
  const a = signedArea(p) * 6;
  if (Math.abs(a) < 1e-9) return p[0] ?? { x: 0, z: 0 };
  let x = 0,
    z = 0;
  for (let i = 0; i < p.length; i++) {
    const u = p[i],
      v = p[(i + 1) % p.length];
    if (!u || !v) continue;
    const q = u.x * v.z - v.x * u.z;
    x += (u.x + v.x) * q;
    z += (u.z + v.z) * q;
  }
  return { x: x / a, z: z / a };
}
export function segmentInside(a: Point, b: Point, p: Point[]) {
  if (!inside(a, p) || !inside(b, p)) return false;
  const cuts = [0, 1];
  for (const s of exteriorSegments(p)) {
    const q = intersection(a, b, s.a, s.b);
    if (q) cuts.push(project(q, a, b).t);
  }
  cuts.sort((x, y) => x - y);
  return cuts.every((t, i) => {
    const u = cuts[i + 1];
    return (
      u === undefined ||
      inside({ x: a.x + ((b.x - a.x) * (t + u)) / 2, z: a.z + ((b.z - a.z) * (t + u)) / 2 }, p)
    );
  });
}
/** Crossings and T junctions are valid; coincident wall runs are not. */
export function wallOverlap(candidate: Segment, walls: Segment[]) {
  const length = distance(candidate.a, candidate.b);
  if (length < 1e-8) return false;
  return walls.some(w => {
    if (w.id === candidate.id) return false;
    if (Math.abs(orient2d(candidate.a.x, candidate.a.z, candidate.b.x, candidate.b.z, w.a.x, w.a.z)) > 1e-7 ||
        Math.abs(orient2d(candidate.a.x, candidate.a.z, candidate.b.x, candidate.b.z, w.b.x, w.b.z)) > 1e-7) return false;
    const dx = (candidate.b.x-candidate.a.x)/length, dz = (candidate.b.z-candidate.a.z)/length;
    const at = (p: Point) => (p.x-candidate.a.x)*dx+(p.z-candidate.a.z)*dz;
    return Math.min(length, Math.max(at(w.a),at(w.b)))-Math.max(0,Math.min(at(w.a),at(w.b))) > 1e-6;
  });
}
export function magnet(p: Point, walls: Segment[], orthogonalStart?: Point): Point {
  let q = { x: snap(p.x), z: snap(p.z) };
  if (orthogonalStart) {
    if (Math.abs(q.x - orthogonalStart.x) > Math.abs(q.z - orthogonalStart.z))
      q.z = orthogonalStart.z;
    else q.x = orthogonalStart.x;
  }
  let best = 0.22;
  for (const w of walls) {
    for (const n of [w.a, w.b, project(q, w.a, w.b).point]) {
      const d = distance(n, q);
      if (d < best) {
        q = n;
        best = d;
      }
    }
  }
  return q;
}
export function transformPoint(p: Point, x: number, z: number, angle: number): Point {
  return {
    x: x + p.x * Math.cos(angle) - p.z * Math.sin(angle),
    z: z + p.x * Math.sin(angle) + p.z * Math.cos(angle),
  };
}
/** Spiral stair: treads fan around a central post; origin is the post center. */
function spiralGeometry(s: Stair, height: number) {
  const count = Math.round(height / 0.18),
    rise = height / count,
    radius = s.width + 0.08,
    step = (2 * Math.PI) / count,
    dir = s.reverse ? -1 : 1;
  const steps = Array.from({ length: count }, (_, i) => {
    const a = dir * (i + 0.5) * step;
    // local x of each tread points radially, so the tread box runs from the post to the rim.
    return { x: Math.cos(a) * (radius / 2), z: Math.sin(a) * (radius / 2), y: (i + 1) * rise, rotation: a, width: radius, depth: Math.tan(step / 2) * radius + 0.02 };
  });
  const r = radius + 0.05,
    square: Point[] = [{ x: -r, z: -r }, { x: r, z: -r }, { x: r, z: r }, { x: -r, z: r }],
    ring = square.map((p) => transformPoint(p, s.x, s.z, s.rotation));
  return { count, rise, tread: Math.tan(step / 2) * radius, blondel: 0.62, steps, footprint: ring, hole: ring, landing: 0, first: count, radius };
}
export function stairGeometry(s: Stair, height: number) {
  if (s.type === "caracol") return spiralGeometry(s, height);
  const count = Math.round(height / 0.18),
    rise = height / count,
    tread = Math.max(0.24, Math.min(0.28, 0.62 - 2 * rise)),
    first = s.type === "recta" ? count : Math.ceil(count / 2),
    landing = s.type === "recta" ? 0 : s.width;
  const steps = Array.from({ length: count }, (_, i) => {
    let x = 0,
      z = (i + 0.5) * tread,
      rotation = 0;
    if (s.type !== "recta" && i >= first) {
      if (s.type === "L") {
        x = (i - first + 0.5) * tread + s.width / 2;
        z = first * tread + s.width / 2;
        rotation = -Math.PI / 2;
      } else {
        x = s.width;
        z = first * tread - (i - first + 0.5) * tread;
        rotation = Math.PI;
      }
    }
    if (s.reverse) {
      z = -z;
      x = -x;
      rotation += Math.PI;
    }
    return { x, z, y: (i + 1) * rise, rotation, width: s.width, depth: tread + 0.015 };
  });
  const foot: Point[] =
    s.type === "recta"
      ? [
          { x: -s.width / 2, z: 0 },
          { x: s.width / 2, z: 0 },
          { x: s.width / 2, z: count * tread },
          { x: -s.width / 2, z: count * tread },
        ]
      : s.type === "L"
        ? [
            { x: -s.width / 2, z: 0 },
            { x: s.width / 2, z: 0 },
            { x: s.width / 2, z: first * tread },
            { x: (count - first) * tread + s.width / 2, z: first * tread },
            { x: (count - first) * tread + s.width / 2, z: first * tread + s.width },
            { x: -s.width / 2, z: first * tread + s.width },
          ]
        : [
            { x: -s.width / 2, z: 0 },
            { x: s.width * 1.5, z: 0 },
            { x: s.width * 1.5, z: first * tread + s.width },
            { x: -s.width / 2, z: first * tread + s.width },
          ];
  // Headroom projection starts where the underside of the upper slab is < 2m above a tread.
  const start =
    Math.max(0, Math.floor((height - GEOMETRY.slabThickness - GEOMETRY.headroom) / rise)) * tread;
  const hole = foot
    .map((p) => ({ x: p.x, z: s.type === "U" ? p.z : Math.max(start, p.z) }))
    .map((p) => (s.reverse ? { x: -p.x, z: -p.z } : p))
    .map((p) => transformPoint(p, s.x, s.z, s.rotation));
  return {
    count,
    rise,
    tread,
    blondel: 2 * rise + tread,
    radius: 0,
    steps,
    footprint: foot
      .map((p) => (s.reverse ? { x: -p.x, z: -p.z } : p))
      .map((p) => transformPoint(p, s.x, s.z, s.rotation)),
    hole,
    landing,
    first,
  };
}
export function exteriorStairPose(s:Stair,contour:Point[],height:number){
  const wall=exteriorSegments(contour).find(w=>w.id===(s.wall??'edge-2'));
  if(!wall)return {x:s.x,z:s.z,rotation:s.rotation};
  const length=distance(wall.a,wall.b),dx=(wall.b.x-wall.a.x)/length,dz=(wall.b.z-wall.a.z)/length;
  const offset=Math.max(-length/2+s.width/2,Math.min(length/2-s.width/2,s.offset??0));
  const sign=signedArea(contour)>0?1:-1,inward={x:-dz*sign,z:dx*sign},run=stairGeometry({...s,reverse:false},height).count*stairGeometry({...s,reverse:false},height).tread;
  return {x:(wall.a.x+wall.b.x)/2+dx*offset-inward.x*run,z:(wall.a.z+wall.b.z)/2+dz*offset-inward.z*run,rotation:Math.atan2(-inward.x,inward.z)};
}
export function validateStair(s: Stair, contour: Point[], upperWalls: Segment[], height: number) {
  if (s.exterior) return null;
  const g = stairGeometry(s, height);
  if (g.rise < 0.17 || g.rise > 0.19 || g.blondel < 0.6 || g.blondel > 0.64)
    return "La altura no permite una escalera segura con estos parámetros.";
  if (
    !g.footprint.every((p, i) =>
      segmentInside(p, g.footprint[(i + 1) % g.footprint.length] ?? p, contour),
    )
  )
    return "La escalera debe quedar dentro del contorno.";
  for (const w of upperWalls) {
    if (
      inside(w.a, g.hole, false) ||
      inside(w.b, g.hole, false) ||
      g.hole.some((a, i) => {
        const b = g.hole[(i + 1) % g.hole.length];
        const p = b ? intersection(a, b, w.a, w.b) : null;
        return p && project(p, w.a, w.b).t > 1e-5 && project(p, w.a, w.b).t < 1 - 1e-5;
      })
    )
      return "El hueco cruza una pared de la planta superior.";
  }
  return null;
}
export function unionHoles(rings: Point[][]): Point[][] {
  if (!rings.length) return [];
  const polygons = rings.map((r) => [r.map((p) => [p.x, p.z] as [number, number])]);
  return polygonClipping
    .union(polygons[0] ?? [], ...polygons.slice(1))
    .map((p) => (p[0] ?? []).slice(0, -1).map((v) => ({ x: v[0], z: v[1] })));
}
/** Rectangular cells wholly inside an orthogonal polygon; merge adjacent cells into roof modules. */
export function roofModules(p: Point[]): Point[][] {
  const xs = [...new Set(p.map((v) => v.x))].sort((a, b) => a - b),
    zs = [...new Set(p.map((v) => v.z))].sort((a, b) => a - b),
    rects: Point[][] = [];
  for (let j = 0; j < zs.length - 1; j++) {
    const z = zs[j],
      zz = zs[j + 1];
    if (z === undefined || zz === undefined) continue;
    let start: number | null = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const x = xs[i],
        xx = xs[i + 1];
      if (x === undefined || xx === undefined) continue;
      const ok = inside({ x: (x + xx) / 2, z: (z + zz) / 2 }, p);
      if (ok && start === null) start = x;
      if (start !== null && (!ok || i === xs.length - 2)) {
        const end = ok ? xx : x;
        const prior = rects.find((r) => r[0]?.x === start && r[1]?.x === end && r[2]?.z === z);
        if (prior) {
          if (prior[2]) prior[2].z = zz;
          if (prior[3]) prior[3].z = zz;
        } else
          rects.push([
            { x: start, z },
            { x: end, z },
            { x: end, z: zz },
            { x: start, z: zz },
          ]);
        start = null;
      }
    }
  }
  return rects;
}
export type RoofPlane = { x: number; z: number; c: number };
export type RoofFace = { rings: Point[][]; plane: RoofPlane };
export const planeHeight = (plane: RoofPlane, p: Point) => plane.x*p.x+plane.z*p.z+plane.c;
export function offsetContour(contour:Point[],amount:number):Point[]{
  const sign=signedArea(contour)>0?1:-1;
  return contour.map((p,i)=>{
    const prev=contour[(i+contour.length-1)%contour.length],next=contour[(i+1)%contour.length];if(!prev||!next)return p;
    const ax=p.x-prev.x,az=p.z-prev.z,bx=next.x-p.x,bz=next.z-p.z,al=Math.hypot(ax,az),bl=Math.hypot(bx,bz);
    const u={x:p.x+sign*az/al*amount,z:p.z-sign*ax/al*amount},v={x:p.x+sign*bz/bl*amount,z:p.z-sign*bx/bl*amount},den=ax*bz-az*bx;
    if(Math.abs(den)<1e-8)return u;
    const t=((v.x-u.x)*bz-(v.z-u.z)*bx)/den;
    return {x:u.x+ax*t,z:u.z+az*t};
  });
}
/** Exact upper envelope of intersecting gable tents; seam heights are shared. */
export function roofFaces(contour: Point[], direction: 'x'|'z', slope: number, overhang=0): RoofFace[] {
  const xs=[...new Set(contour.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(contour.map(p=>p.z))].sort((a,b)=>a-b);
  const rectangles: Point[][]=[];
  const polygon=[contour.map(p=>[p.x,p.z] as [number,number])];
  for(let a=0;a<xs.length-1;a++)for(let b=a+1;b<xs.length;b++)for(let c=0;c<zs.length-1;c++)for(let d=c+1;d<zs.length;d++){
    const x=xs[a],xx=xs[b],z=zs[c],zz=zs[d];if(x===undefined||xx===undefined||z===undefined||zz===undefined)continue;
    const r=[{x,z},{x:xx,z},{x:xx,z:zz},{x,z:zz}];
    if(!polygonClipping.difference([r.map(p=>[p.x,p.z] as [number,number])],polygon).length)rectangles.push(r);
  }
  const maximal=rectangles.filter(r=>!rectangles.some(q=>q!==r&&polygonArea(q)>polygonArea(r)+1e-7&&r.every(p=>inside(p,q))));
  const tents=maximal.map(r=>{
    const b=bounds(r),axis=direction;
    return axis==='x'?[{x:slope,z:0,c:-b.minX*slope},{x:-slope,z:0,c:b.maxX*slope}]:[{x:0,z:slope,c:-b.minZ*slope},{x:0,z:-slope,c:b.maxZ*slope}];
  });
  const planes=tents.flat(),lines:RoofPlane[]=[];
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){const a=planes[i],b=planes[j];if(!a||!b)continue;const line={x:a.x-b.x,z:a.z-b.z,c:a.c-b.c};if(Math.hypot(line.x,line.z)>1e-8)lines.push(line);}
  // Convex clipping avoids topology instability at nearly coincident valley vertices.
  const clip=(ring:Point[],line:RoofPlane,sign:number)=>{
    const result:Point[]=[];
    ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];if(!b)return;const ha=planeHeight(line,a)*sign,hb=planeHeight(line,b)*sign;
      if(ha>=-1e-9)result.push(a);
      if((ha>1e-9&&hb<-1e-9)||(ha<-1e-9&&hb>1e-9)){const t=ha/(ha-hb);result.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
    });
    return result.filter((p,i)=>distance(p,result[(i+result.length-1)%result.length]??p)>1e-8);
  };
  let cells=roofModules(overhang?offsetContour(contour,overhang):contour);
  for(const line of lines){const split:Point[][]=[];for(const cell of cells){const h=cell.map(p=>planeHeight(line,p));if(Math.min(...h)<-1e-8&&Math.max(...h)>1e-8){for(const sign of [-1,1]){const r=clip(cell,line,sign);if(r.length>=3&&polygonArea(r)>1e-8)split.push(r);}}else split.push(cell);}cells=split;}
  const faces:RoofFace[]=[];
  for(const cell of cells){const p=centroid(cell);let best=-Infinity,selected:RoofPlane|undefined;
    for(const tent of tents){const a=tent[0],b=tent[1];if(!a||!b)continue;const plane=planeHeight(a,p)<=planeHeight(b,p)?a:b,h=planeHeight(plane,p);if(h>best){best=h;selected=plane;}}
    if(selected)faces.push({rings:[cell],plane:selected});
  }
  return faces;
}
export function miterPolygon(s: Segment, all: Segment[]): Point[] {
  const dx = s.b.x - s.a.x,
    dz = s.b.z - s.a.z,
    len = distance(s.a, s.b),
    nx = -dz / len,
    nz = dx / len,
    h = s.thickness / 2;
  const endpoint = (p: Point, sign: number) => {
    let q = { x: p.x + nx * h * sign, z: p.z + nz * h * sign };
    const other = all.find(
      (w) => w.id !== s.id && (distance(w.a, p) < 1e-6 || distance(w.b, p) < 1e-6),
    );
    if (!other) return q;
    const v = distance(other.a, p) < 1e-6 ? other.b : other.a,
      ox = v.x - p.x,
      oz = v.z - p.z,
      ol = Math.hypot(ox, oz),
      onx = -oz / ol,
      onz = ox / ol;
    const side =
      orient2d(p.x, p.z, s.a === p ? s.b.x : s.a.x, s.a === p ? s.b.z : s.a.z, v.x, v.z) > 0
        ? -sign
        : sign;
    const r = {
        x: p.x + ((onx * other.thickness) / 2) * side,
        z: p.z + ((onz * other.thickness) / 2) * side,
      },
      den = dx * oz - dz * ox;
    if (Math.abs(den) > 1e-8) {
      const t = ((r.x - q.x) * oz - (r.z - q.z) * ox) / den;
      const m = { x: q.x + t * dx, z: q.z + t * dz };
      if (distance(m, p) < h * 6) q = m;
    }
    return q;
  };
  return [endpoint(s.a, 1), endpoint(s.b, 1), endpoint(s.b, -1), endpoint(s.a, -1)];
}
