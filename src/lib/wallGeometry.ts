/**
 * Geometría de las paredes del apartado "Sistemas constructivos".
 *
 * Es código puro (sin Three): arma mallas como listas de números (posiciones, normales, UV, índices) a partir de
 * una descripción serializable (`SolidSpec`). El visor 3D las convierte en BufferGeometry y la vista previa de
 * prueba las dibuja en 2D, así que lo que se verifica acá es exactamente lo que ve el visor.
 *
 * Convenciones: metros; y hacia arriba; z va del interior (negativo) al exterior (positivo).
 * Las UV son planas y en metros (1 repetición = 1 m, igual que los mapas de `public/textures/`), así que una
 * textura se ve del mismo tamaño en todas las piezas y continúa entre piezas vecinas.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Axis = "x" | "y" | "z";

export type Solid = { positions: number[]; normals: number[]; uvs: number[]; indices: number[] };

export type SolidSpec =
  /** Caja centrada en el origen. `o` desplaza el origen de las UV (para que la textura continúe entre piezas vecinas). */
  | { k: "box"; s: Vec3; rot?: boolean; o?: Vec3 }
  /** Ladrillo hueco: carcasa con celdas que atraviesan el largo (eje x). Centrado en el origen. */
  | { k: "hollow"; L: number; H: number; D: number; t: number; ny: number; nz: number }
  /** Tabla de siding superpuesta. Origen abajo y al centro del ancho; plano posterior en z = 0; más gruesa abajo (`tb`) que arriba (`tt`). */
  | { k: "lap"; w: number; h: number; tb: number; tt: number; o?: Vec3 }
  /** Chapa acanalada ondulada. Origen abajo y al centro del ancho; la onda queda centrada en z = 0. */
  | { k: "corr"; w: number; h: number; waves: number; amp: number; th: number }
  /** Barra redonda (armadura) centrada en el origen. */
  | { k: "bar"; axis: Axis; len: number; r: number }
  /** Estribo rectangular de 4 barras, en el plano perpendicular a `axis`. `a` y `b` son los lados interiores. */
  | { k: "stirrup"; axis: Axis; a: number; b: number; r: number };

export const newSolid = (): Solid => ({ positions: [], normals: [], uvs: [], indices: [] });

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** UV plana en metros según el eje dominante de la normal. */
function uvOf(p: Vec3, n: Vec3, o: Vec3): Vec2 {
  const x = p[0] + o[0], y = p[1] + o[1], z = p[2] + o[2];
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ax >= ay && ax >= az) return [z, y];
  if (ay >= az) return [x, z];
  return [x, y];
}

/** Agrega un cuadrilátero; el orden de los vértices se corrige solo para que mire hacia donde apuntan las normales. */
function addQuad(s: Solid, p: [Vec3, Vec3, Vec3, Vec3], n: [Vec3, Vec3, Vec3, Vec3], rot = false, o: Vec3 = [0, 0, 0]) {
  const base = s.positions.length / 3;
  const avg = norm([n[0][0] + n[1][0] + n[2][0] + n[3][0], n[0][1] + n[1][1] + n[2][1] + n[3][1], n[0][2] + n[1][2] + n[2][2] + n[3][2]]);
  for (let i = 0; i < 4; i++) {
    const [u, v] = uvOf(p[i]!, avg, o);
    s.positions.push(...p[i]!);
    s.normals.push(...n[i]!);
    s.uvs.push(rot ? v : u, rot ? u : v);
  }
  const g1 = cross(sub(p[1], p[0]), sub(p[2], p[0]));
  const g2 = cross(sub(p[2], p[0]), sub(p[3], p[0]));
  const g: Vec3 = [g1[0] + g2[0], g1[1] + g2[1], g1[2] + g2[2]];
  if (dot(g, avg) >= 0) s.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  else s.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

function addTri(s: Solid, p: [Vec3, Vec3, Vec3], n: Vec3, o: Vec3 = [0, 0, 0]) {
  const base = s.positions.length / 3;
  for (let i = 0; i < 3; i++) {
    const [u, v] = uvOf(p[i]!, n, o);
    s.positions.push(...p[i]!);
    s.normals.push(...n);
    s.uvs.push(u, v);
  }
  const g = cross(sub(p[1], p[0]), sub(p[2], p[0]));
  if (dot(g, n) >= 0) s.indices.push(base, base + 1, base + 2);
  else s.indices.push(base, base + 2, base + 1);
}

export function addBox(s: Solid, [sx, sy, sz]: Vec3, [cx, cy, cz]: Vec3, rot = false, o: Vec3 = [0, 0, 0]) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const face = (c: [Vec3, Vec3, Vec3, Vec3], n: Vec3) => addQuad(s, c, [n, n, n, n], rot, o);
  face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
  face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
  face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
  face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
  face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
}

/** Cilindro de `seg` lados con normales suaves en el lateral y tapas planas. */
export function addBar(s: Solid, axis: Axis, len: number, r: number, [cx, cy, cz]: Vec3, seg = 10) {
  const pt = (t: number, ang: number): Vec3 => {
    const a = Math.cos(ang) * r, b = Math.sin(ang) * r;
    if (axis === "x") return [cx + t, cy + a, cz + b];
    if (axis === "y") return [cx + a, cy + t, cz + b];
    return [cx + a, cy + b, cz + t];
  };
  const nr = (ang: number): Vec3 => {
    const a = Math.cos(ang), b = Math.sin(ang);
    return axis === "x" ? [0, a, b] : axis === "y" ? [a, 0, b] : [a, b, 0];
  };
  const dir: Vec3 = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const h = len / 2;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    addQuad(s, [pt(-h, a0), pt(-h, a1), pt(h, a1), pt(h, a0)], [nr(a0), nr(a1), nr(a1), nr(a0)]);
    addTri(s, [[cx, cy, cz].map((v, k) => v + dir[k]! * h) as Vec3, pt(h, a0), pt(h, a1)], dir);
    addTri(s, [[cx, cy, cz].map((v, k) => v - dir[k]! * h) as Vec3, pt(-h, a1), pt(-h, a0)], [-dir[0], -dir[1], -dir[2]]);
  }
}

/**
 * Perfil engrosado (dos líneas: `top` hacia afuera y `bottom` hacia adentro) extruido a lo largo de un eje.
 * plano "xz": (a, b) = (x, z), se extruye en y.  plano "yz": (a, b) = (y, z), se extruye en x.
 */
export function addStrip(s: Solid, top: Vec2[], bottom: Vec2[], plane: "xz" | "yz", from: number, to: number, o: Vec3 = [0, 0, 0]) {
  const P = (a: number, b: number, t: number): Vec3 => (plane === "xz" ? [a, t, b] : [t, a, b]);
  const N = (na: number, nb: number): Vec3 => (plane === "xz" ? [na, 0, nb] : [0, na, nb]);
  const ext: Vec3 = plane === "xz" ? [0, 1, 0] : [1, 0, 0];
  const n = top.length;
  const tangent = (line: Vec2[], i: number): Vec2 => {
    const a = line[Math.max(0, i - 1)]!, b = line[Math.min(n - 1, i + 1)]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const outward = (line: Vec2[], other: Vec2[], i: number, sign: 1 | -1): Vec3 => {
    const [ta, tb] = tangent(line, i);
    let p: Vec2 = [-tb, ta];
    const away: Vec2 = [(line[i]![0] - other[i]![0]) * sign, (line[i]![1] - other[i]![1]) * sign];
    if (p[0] * away[0] + p[1] * away[1] < 0) p = [tb, -ta];
    if (Math.abs(away[0]) + Math.abs(away[1]) < 1e-9 && p[1] < 0) p = [-p[0], -p[1]];
    return N(p[0], p[1]);
  };
  const nt = top.map((_, i) => outward(top, bottom, i, 1));
  // la normal de la línea `bottom` apunta hacia afuera de su lado (es decir, alejándose de `top`)
  const nbOut = bottom.map((_, i) => outward(bottom, top, i, 1));
  for (let i = 0; i < n - 1; i++) {
    const t0 = top[i]!, t1 = top[i + 1]!, b0 = bottom[i]!, b1 = bottom[i + 1]!;
    addQuad(s, [P(t0[0], t0[1], from), P(t1[0], t1[1], from), P(t1[0], t1[1], to), P(t0[0], t0[1], to)], [nt[i]!, nt[i + 1]!, nt[i + 1]!, nt[i]!], false, o);
    addQuad(s, [P(b0[0], b0[1], from), P(b1[0], b1[1], from), P(b1[0], b1[1], to), P(b0[0], b0[1], to)], [nbOut[i]!, nbOut[i + 1]!, nbOut[i + 1]!, nbOut[i]!], false, o);
    const back: Vec3 = [-ext[0], -ext[1], -ext[2]];
    addQuad(s, [P(t0[0], t0[1], from), P(t1[0], t1[1], from), P(b1[0], b1[1], from), P(b0[0], b0[1], from)], [back, back, back, back], false, o);
    addQuad(s, [P(t0[0], t0[1], to), P(t1[0], t1[1], to), P(b1[0], b1[1], to), P(b0[0], b0[1], to)], [ext, ext, ext, ext], false, o);
  }
  const t0 = tangent(top, 0), tN = tangent(top, n - 1);
  const nStart = N(-t0[0], -t0[1]), nEnd = N(tN[0], tN[1]);
  const T = top[0]!, B = bottom[0]!, T2 = top[n - 1]!, B2 = bottom[n - 1]!;
  addQuad(s, [P(T[0], T[1], from), P(B[0], B[1], from), P(B[0], B[1], to), P(T[0], T[1], to)], [nStart, nStart, nStart, nStart], false, o);
  addQuad(s, [P(T2[0], T2[1], from), P(B2[0], B2[1], from), P(B2[0], B2[1], to), P(T2[0], T2[1], to)], [nEnd, nEnd, nEnd, nEnd], false, o);
}

function buildHollow(L: number, H: number, D: number, t: number, ny: number, nz: number): Solid {
  const s = newSolid();
  const cellH = (H - (ny + 1) * t) / ny;
  const cellW = (D - (nz + 1) * t) / nz;
  for (let j = 0; j <= ny; j++) addBox(s, [L, t, D], [0, -H / 2 + t / 2 + j * (cellH + t), 0]);
  for (let r = 0; r < ny; r++) {
    const cy = -H / 2 + t + r * (cellH + t) + cellH / 2;
    for (let k = 0; k <= nz; k++) addBox(s, [L, cellH, t], [0, cy, -D / 2 + t / 2 + k * (cellW + t)]);
  }
  return s;
}

function buildLap(w: number, h: number, tb: number, tt: number, o?: Vec3): Solid {
  const s = newSolid();
  // plano "yz": a = y (0..h), b = z. `top` es la cara que se ve (afuera); `bottom` es la cara posterior (z = 0).
  addStrip(s, [[0, tb], [h, tt]], [[0, 0], [h, 0]], "yz", -w / 2, w / 2, o);
  return s;
}

function buildCorrugated(w: number, h: number, waves: number, amp: number, th: number): Solid {
  const s = newSolid();
  const per = 12;
  const n = waves * per;
  const top: Vec2[] = [], bottom: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (i / n) * w;
    const z = amp * Math.sin((i / per) * Math.PI * 2);
    top.push([x, z + th / 2]);
    bottom.push([x, z - th / 2]);
  }
  addStrip(s, top, bottom, "xz", 0, h);
  return s;
}

function buildStirrup(axis: Axis, a: number, b: number, r: number): Solid {
  const s = newSolid();
  // a y b son los lados del rectángulo en los dos ejes perpendiculares a `axis`, en orden (y, z) / (x, z) / (x, y).
  const [ea, eb]: [Axis, Axis] = axis === "x" ? ["y", "z"] : axis === "y" ? ["x", "z"] : ["x", "y"];
  const at = (va: number, vb: number): Vec3 => {
    const v: Vec3 = [0, 0, 0];
    v[ea === "x" ? 0 : ea === "y" ? 1 : 2] = va;
    v[eb === "y" ? 1 : 2] = vb;
    return v;
  };
  // barras a lo largo de `ea` (en ±b/2) y a lo largo de `eb` (en ±a/2)
  addBar(s, ea, a + 2 * r, r, at(0, b / 2 + r), 8);
  addBar(s, ea, a + 2 * r, r, at(0, -b / 2 - r), 8);
  addBar(s, eb, b + 2 * r, r, at(a / 2 + r, 0), 8);
  addBar(s, eb, b + 2 * r, r, at(-a / 2 - r, 0), 8);
  return s;
}

const cache = new Map<string, Solid>();
export const specKey = (spec: SolidSpec) => JSON.stringify(spec);

export function solidFromSpec(spec: SolidSpec): Solid {
  const key = specKey(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  let s: Solid;
  switch (spec.k) {
    case "box": s = newSolid(); addBox(s, spec.s, [0, 0, 0], spec.rot, spec.o); break;
    case "hollow": s = buildHollow(spec.L, spec.H, spec.D, spec.t, spec.ny, spec.nz); break;
    case "lap": s = buildLap(spec.w, spec.h, spec.tb, spec.tt, spec.o); break;
    case "corr": s = buildCorrugated(spec.w, spec.h, spec.waves, spec.amp, spec.th); break;
    case "bar": s = newSolid(); addBar(s, spec.axis, spec.len, spec.r, [0, 0, 0]); break;
    case "stirrup": s = buildStirrup(spec.axis, spec.a, spec.b, spec.r); break;
  }
  cache.set(key, s);
  return s;
}

export function clearSolidCache() {
  cache.clear();
}

export function solidBounds(s: Solid): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < s.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = s.positions[i + k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  return { min, max };
}

export const triangleCount = (s: Solid) => s.indices.length / 3;
