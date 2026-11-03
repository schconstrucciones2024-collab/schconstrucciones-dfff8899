/**
 * Modelo de las dos paredes del apartado "Sistemas constructivos": qué piezas hay, dónde están y cómo se separan
 * al explotar la vista. Es código puro y serializable (sin Three): el visor 3D y las pruebas leen el mismo modelo.
 *
 * Las dimensiones son ILUSTRATIVAS: sirven para que las capas se lean bien en pantalla, no son especificaciones
 * de SCH ni de ningún proyecto, y no se muestran como datos en la interfaz.
 *
 * Ejes (metros): x ancho de la pared, y altura (0 = piso), z espesor (interior negativo/atrás → exterior positivo/adelante).
 */
import { defaultOptions, SYSTEMS, type SystemId, type WallMaterialKind } from "@/config/wallSystems";
import { solidBounds, solidFromSpec, type SolidSpec, type Vec3 } from "./wallGeometry";

export type Part = {
  id: string;
  material: WallMaterialKind;
  spec: SolidSpec;
  /** Posición del origen de la pieza con la pared armada. */
  pos: Vec3;
  /** 0..1: variación de tono entre piezas de un mismo material. */
  tint: number;
  /** < 1: se dibuja translúcida (hormigón con armaduras a la vista). */
  opacity?: number;
  /** Escala del mapa normal (para no duplicar el relieve cuando la geometría ya lo tiene). */
  ns?: number;
  /** Desplazamiento extra al explotar la vista, además del de la capa. */
  ex?: Vec3;
};

export type ModelLayer = {
  id: string;
  parts: Part[];
  /** Desplazamiento de la capa con la vista totalmente explotada. */
  explode: Vec3;
  /** Centro de la capa armada (punto sobre el que crece o se achica al agregarla o quitarla). */
  pivot: Vec3;
};

export type WallModel = {
  system: SystemId;
  options: Record<string, string>;
  layers: ModelLayer[];
  min: Vec3;
  max: Vec3;
  center: Vec3;
};

const hash = (n: number) => {
  let t = (n * 0x9e3779b1) >>> 0;
  t ^= t >>> 15;
  t = Math.imul(t, 0x85ebca6b) >>> 0;
  t ^= t >>> 13;
  return (t >>> 0) / 4294967296;
};

type PartExtra = { rot?: boolean; uv?: boolean; opacity?: number; ns?: number; ex?: Vec3 };
class Builder {
  private n = 0;
  parts: Part[] = [];
  constructor(private layer: string) {}
  private id() {
    return `${this.layer}-${this.n++}`;
  }
  box(material: WallMaterialKind, size: Vec3, pos: Vec3, x: PartExtra = {}) {
    const spec: SolidSpec = { k: "box", s: size, ...(x.rot ? { rot: true } : {}), ...(x.uv ? { o: pos } : {}) };
    this.add(material, spec, pos, x);
  }
  add(material: WallMaterialKind, spec: SolidSpec, pos: Vec3, x: PartExtra = {}) {
    const i = this.n;
    this.parts.push({
      id: this.id(), material, spec, pos, tint: hash(i + this.layer.length * 101),
      ...(x.opacity !== undefined ? { opacity: x.opacity } : {}),
      ...(x.ns !== undefined ? { ns: x.ns } : {}),
      ...(x.ex ? { ex: x.ex } : {}),
    });
  }
}

export function partBounds(p: Part): { min: Vec3; max: Vec3 } {
  const b = solidBounds(solidFromSpec(p.spec));
  return {
    min: [b.min[0] + p.pos[0], b.min[1] + p.pos[1], b.min[2] + p.pos[2]],
    max: [b.max[0] + p.pos[0], b.max[1] + p.pos[1], b.max[2] + p.pos[2]],
  };
}

function finish(system: SystemId, options: Record<string, string>, layers: { id: string; parts: Part[]; explode: Vec3 }[]): WallModel {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const out: ModelLayer[] = layers.map((l) => {
    const lmin: Vec3 = [Infinity, Infinity, Infinity], lmax: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of l.parts) {
      const b = partBounds(p);
      for (let k = 0; k < 3; k++) {
        lmin[k] = Math.min(lmin[k]!, b.min[k]!);
        lmax[k] = Math.max(lmax[k]!, b.max[k]!);
      }
    }
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, lmin[k]!);
      max[k] = Math.max(max[k]!, lmax[k]!);
    }
    return { id: l.id, parts: l.parts, explode: l.explode, pivot: [(lmin[0]! + lmax[0]!) / 2, (lmin[1]! + lmax[1]!) / 2, (lmin[2]! + lmax[2]!) / 2] };
  });
  return { system, options, layers: out, min, max, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
}

/** Capas que existen con las opciones elegidas (las opcionales pueden faltar). */
export function presentLayerIds(system: SystemId, options: Record<string, string>): string[] {
  const o = { ...defaultOptions(system), ...options };
  return SYSTEMS[system].layers(o)
    .map((l) => l.id)
    .filter((id) => !(system === "woodframe" && id === "clavaderas" && o["battens"] === "sin") && !(system === "tradicional" && id === "revoqueExt" && o["revoqueExt"] === "sin"));
}

/* ───────────────────────────── Wood Frame ───────────────────────────── */

export const WF = {
  W: 2.4,
  H: 2.0,
  /** Paso de las tablas de siding: coincide con el de los mapas `sidingModerno` / `sidingAllwood` (7 por metro). */
  board: 1 / 7,
  stud: 0.045,
  studDepth: 0.09,
  tInterior: 0.02,
  tOsb: 0.02,
  tMembrane: 0.006,
  batten: { w: 0.045, d: 0.03 },
  sidingBase: 0.014,
  sidingTop: 0.005,
  overlap: 0.02,
  gap: 0.42,
};

function buildWoodFrame(options: Record<string, string>): WallModel {
  const { W, H } = WF;
  const present = presentLayerIds("woodframe", options);
  const layers: { id: string; parts: Part[]; explode: Vec3 }[] = [];

  let z = 0;
  const zInt = z; z += WF.tInterior;
  const zStr = z; z += WF.studDepth;
  const zOsb = z; z += WF.tOsb;
  const zMem = z; z += WF.tMembrane;
  const zBat = z; if (present.includes("clavaderas")) z += WF.batten.d;
  const zExt = z;

  // 01 · interior
  {
    const b = new Builder("interior");
    const zc = zInt + WF.tInterior / 2;
    const kind = options["interior"] ?? "yeso";
    if (kind === "yeso") {
      for (const sx of [-1, 1]) b.box("drywall", [W / 2 - 0.002, H, WF.tInterior], [sx * (W / 4), H / 2, zc], { uv: true });
    } else if (kind === "machimbre") {
      const n = Math.round(W / 0.1);
      for (let i = 0; i < n; i++) b.box("machimbre", [0.1 - 0.002, H, WF.tInterior], [-W / 2 + (i + 0.5) * 0.1, H / 2, zc], { uv: true });
    } else {
      const material: WallMaterialKind = kind === "chaponEucalipto" ? "chaponEucalipto" : "chaponPino";
      const n = Math.round(H / 0.25);
      for (let i = 0; i < n; i++) b.box(material, [W, 0.25 - 0.003, WF.tInterior], [0, (i + 0.5) * 0.25, zc], { uv: true });
    }
    layers.push({ id: "interior", parts: b.parts, explode: [0, 0, 0] });
  }

  // 02 · estructura y aislación (la lana de vidrio rellena los huecos entre montantes)
  const zStrC = zStr + WF.studDepth / 2;
  const studs = 7;
  const sp = (W - WF.stud) / (studs - 1);
  const studX = (i: number) => -W / 2 + WF.stud / 2 + i * sp;
  {
    const b = new Builder("aislacion");
    for (let i = 0; i < studs - 1; i++) {
      const x = (studX(i) + studX(i + 1)) / 2;
      b.box("lanaVidrio", [sp - WF.stud, H - 2 * WF.stud, WF.studDepth], [x, H / 2, zStrC], { uv: true });
    }
    layers.push({ id: "aislacion", parts: b.parts, explode: [0, 0, 0] });
  }
  {
    const b = new Builder("estructura");
    for (let i = 0; i < studs; i++) b.box("maderaEstructural", [WF.stud, H - 2 * WF.stud, WF.studDepth], [studX(i), H / 2, zStrC], { uv: true });
    for (const y of [WF.stud / 2, H - WF.stud / 2]) b.box("maderaEstructural", [W, WF.stud, WF.studDepth], [0, y, zStrC], { uv: true, rot: true });
    layers.push({ id: "estructura", parts: b.parts, explode: [0, 0, 0] });
  }

  // 03 · placa OSB (dos paños, con la junta sobre un montante)
  {
    const b = new Builder("osb");
    for (const sx of [-1, 1]) b.box("osb", [W / 2 - 0.002, H, WF.tOsb], [sx * (W / 4), H / 2, zOsb + WF.tOsb / 2], { uv: true });
    layers.push({ id: "osb", parts: b.parts, explode: [0, 0, 0] });
  }

  // 04 · aislante hidrófugo
  {
    const b = new Builder("membrana");
    b.box("membrana", [W, H, WF.tMembrane], [0, H / 2, zMem + WF.tMembrane / 2], { uv: true });
    layers.push({ id: "membrana", parts: b.parts, explode: [0, 0, 0] });
  }

  // 05 · clavaderas (opcionales)
  if (present.includes("clavaderas")) {
    const b = new Builder("clavaderas");
    for (let i = 0; i < studs; i++) b.box("maderaEstructural", [WF.batten.w, H, WF.batten.d], [studX(i), H / 2, zBat + WF.batten.d / 2], { uv: true });
    layers.push({ id: "clavaderas", parts: b.parts, explode: [0, 0, 0] });
  }

  // 06 · exterior
  {
    const b = new Builder("exterior");
    const kind = options["exterior"] ?? "siding";
    if (kind === "chapa") {
      const amp = 0.0145, th = 0.002;
      b.add("chapa", { k: "corr", w: W, h: H, waves: 29, amp, th }, [0, 0, zExt + amp + th / 2], { ns: 0.15 });
    } else {
      const material: WallMaterialKind = kind === "tablas" ? "sidingAllwood" : "sidingModerno";
      const n = Math.round(H / WF.board);
      for (let i = 0; i < n; i++) {
        const h = WF.board + (i === n - 1 ? 0 : WF.overlap);
        // cada tabla toma un tramo distinto del mapa (si no, todas mostrarían exactamente la misma veta);
        // el desplazamiento vertical es múltiplo de 1/7 m, así las juntas del mapa siguen coincidiendo con el borde de cada tabla
        b.add(material, { k: "lap", w: W, h, tb: WF.sidingBase, tt: WF.sidingTop, o: [(i * 0.37) % 1, i * WF.board, 0] }, [0, i * WF.board, zExt]);
      }
    }
    layers.push({ id: "exterior", parts: b.parts, explode: [0, 0, 0] });
  }

  // Explosión: cada capa se separa de la estructura (que queda quieta) a lo largo del espesor.
  const order = layers.map((l) => l.id);
  const anchor = order.indexOf("estructura");
  const spread = layers.map((l, i) => ({ ...l, explode: [0, 0, (i - anchor) * WF.gap] as Vec3 }));
  return finish("woodframe", options, spread);
}

/* ───────────────────────── Construcción tradicional ───────────────────────── */

export const TR = {
  W: 2.4,
  D: 0.12,
  col: 0.12,
  /** Alto de mampostería: 9 hiladas de ticholo o 27 de ladrillo común dan exactamente lo mismo. */
  Hm: 1.728,
  beam: 0.192,
  ticholo: { L: 0.25, h: 0.18, n: 9, t: 0.012, ny: 3, nz: 2 },
  comun: { L: 0.25, h: 0.052, n: 27 },
  joint: 0.012,
  opening: { x0: -0.05, x1: 0.85, y0: 0.96, y1: 1.536 },
  bearing: 0.15,
  tInterior: 0.015,
  tExterior: 0.02,
  bar: 0.005,
  stirrup: 0.003,
  cover: 0.025,
  stirrupPitch: 0.15,
};

type Interval = [number, number];

function subtract(base: Interval, cuts: Interval[]): Interval[] {
  let segs: Interval[] = [base];
  for (const [c0, c1] of cuts) {
    const next: Interval[] = [];
    for (const [a, b] of segs) {
      if (c1 <= a || c0 >= b) next.push([a, b]);
      else {
        if (c0 > a) next.push([a, c0]);
        if (c1 < b) next.push([c1, b]);
      }
    }
    segs = next;
  }
  return segs.filter(([a, b]) => b - a > 1e-6);
}

/** Jaula de armadura: 4 barras longitudinales y estribos, a lo largo de `axis`. */
function addCage(b: Builder, axis: "x" | "y", center: Vec3, length: number, A: number, B: number, ex?: Vec3) {
  const { bar, stirrup, cover, stirrupPitch } = TR;
  const long = length - 0.04;
  const oa = A / 2 - cover - stirrup - bar; // desplazamiento de las barras en el primer eje perpendicular (y para x, x para y)
  const ob = B / 2 - cover - stirrup - bar; // en z
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const pos: Vec3 = axis === "x" ? [center[0], center[1] + sa * oa, center[2] + sb * ob] : [center[0] + sa * oa, center[1], center[2] + sb * ob];
    b.add("acero", { k: "bar", axis, len: long, r: bar }, pos, ex ? { ex } : {});
  }
  const n = Math.max(1, Math.round((length - 0.1) / stirrupPitch));
  const step = (length - 0.1) / n;
  for (let i = 0; i <= n; i++) {
    const t = -length / 2 + 0.05 + i * step;
    const pos: Vec3 = axis === "x" ? [center[0] + t, center[1], center[2]] : [center[0], center[1] + t, center[2]];
    b.add("acero", { k: "stirrup", axis, a: A - 2 * cover - 2 * stirrup, b: B - 2 * cover - 2 * stirrup, r: stirrup }, pos, ex ? { ex } : {});
  }
}

function buildTradicional(options: Record<string, string>): WallModel {
  const { W, D, col, Hm, beam, joint, opening, bearing } = TR;
  const total = Hm + beam;
  const hueco = (options["masonry"] ?? "ticholo") === "ticholo";
  const concrete = (options["hormigon"] ?? "translucido") === "translucido" ? 0.3 : undefined;
  const present = presentLayerIds("tradicional", options);
  const layers: { id: string; parts: Part[]; explode: Vec3 }[] = [];
  const concOpts = concrete !== undefined ? { uv: true, opacity: concrete } : { uv: true };

  // revoque interior
  const slab = (b: Builder, material: WallMaterialKind, t: number, zc: number) => {
    const o = opening;
    b.box(material, [W, o.y0, t], [0, o.y0 / 2, zc], { uv: true });
    b.box(material, [W, total - o.y1, t], [0, o.y1 + (total - o.y1) / 2, zc], { uv: true });
    b.box(material, [o.x0 + W / 2, o.y1 - o.y0, t], [(-W / 2 + o.x0) / 2, (o.y0 + o.y1) / 2, zc], { uv: true });
    b.box(material, [W / 2 - o.x1, o.y1 - o.y0, t], [(o.x1 + W / 2) / 2, (o.y0 + o.y1) / 2, zc], { uv: true });
  };
  {
    const b = new Builder("revoqueInt");
    slab(b, "revoqueFino", TR.tInterior, -D / 2 - TR.tInterior / 2);
    layers.push({ id: "revoqueInt", parts: b.parts, explode: [0, 0, -0.95] });
  }

  // mampostería y mortero de asiento
  const brick = hueco ? TR.ticholo : TR.comun;
  const pitch = brick.h + joint;
  const xL = -W / 2 + col, xR = W / 2 - col;
  const masonry = new Builder("mamposteria");
  const mortar = new Builder("mortero");
  const mortarD = D - 0.012;
  for (let j = 0; j < brick.n; j++) {
    const y0 = j * pitch;
    const cuts: Interval[] = [];
    if (y0 >= opening.y0 - 1e-6 && y0 + pitch <= opening.y1 + 1e-6) cuts.push([opening.x0, opening.x1]);
    if (y0 >= opening.y1 - 1e-6 && y0 + pitch <= opening.y1 + TR.beam + 1e-6) cuts.push([opening.x0 - bearing, opening.x1 + bearing]);
    const odd = j % 2 === 1;
    for (const [a, bnd] of subtract([xL, xR], cuts)) {
      const cy = y0 + brick.h / 2;
      const fill = (from: number, to: number) => mortar.add("revoque", { k: "box", s: [to - from, brick.h, mortarD] }, [(from + to) / 2, cy, 0]);
      let c = a;
      let first = odd; // las hiladas impares arrancan con medio ladrillo (trabado)
      while (c < bnd - 1e-6) {
        const len = Math.min(first ? brick.L / 2 : brick.L, bnd - c);
        first = false;
        if (len < 0.02) { fill(c, bnd); break; }
        if (hueco) masonry.add("ladrilloHueco", { k: "hollow", L: len, H: brick.h, D, t: TR.ticholo.t, ny: TR.ticholo.ny, nz: TR.ticholo.nz }, [c + len / 2, cy, 0]);
        else masonry.add("ladrilloComun", { k: "box", s: [len, brick.h, D] }, [c + len / 2, cy, 0]);
        const e = c + len;
        if (e >= bnd - 1e-6) break;
        const jEnd = Math.min(e + joint, bnd);
        if (bnd - jEnd < 0.02) { fill(e, bnd); break; } // resto muy chico: se rellena con mortero
        fill(e, jEnd); // junta vertical
        c = jEnd;
      }
      // junta horizontal sobre la hilada
      mortar.add("revoque", { k: "box", s: [bnd - a, joint, mortarD] }, [(a + bnd) / 2, y0 + brick.h + joint / 2, 0]);
    }
  }
  layers.push({ id: "mortero", parts: mortar.parts, explode: [0, 0, -0.45] });
  layers.push({ id: "mamposteria", parts: masonry.parts, explode: [0, 0, 0] });

  // hormigón armado: encadenado horizontal, encadenado vertical y dintel
  {
    const b = new Builder("encadenadoH");
    const c: Vec3 = [0, Hm + beam / 2, 0];
    b.box("hormigon", [W, beam, D], c, concOpts);
    addCage(b, "x", c, W, beam, D);
    layers.push({ id: "encadenadoH", parts: b.parts, explode: [0, 0.55, 0] });
  }
  {
    const b = new Builder("encadenadoV");
    for (const s of [-1, 1]) {
      const c: Vec3 = [s * (W / 2 - col / 2), Hm / 2, 0];
      const ex: Vec3 = [s * 0.6, 0, 0];
      b.box("hormigon", [col, Hm, D], c, { ...concOpts, ex });
      addCage(b, "y", c, Hm, col, D, ex);
    }
    layers.push({ id: "encadenadoV", parts: b.parts, explode: [0, 0, 0] });
  }
  {
    const b = new Builder("dintel");
    const span = opening.x1 - opening.x0 + 2 * bearing;
    const c: Vec3 = [(opening.x0 + opening.x1) / 2, opening.y1 + beam / 2, 0];
    b.box("hormigon", [span, beam, D], c, concOpts);
    addCage(b, "x", c, span, beam, D);
    layers.push({ id: "dintel", parts: b.parts, explode: [0, 0.35, 0] });
  }

  // revoque exterior
  if (present.includes("revoqueExt")) {
    const b = new Builder("revoqueExt");
    slab(b, "revoque", TR.tExterior, D / 2 + TR.tExterior / 2);
    layers.push({ id: "revoqueExt", parts: b.parts, explode: [0, 0, 0.95] });
  }

  return finish("tradicional", options, layers);
}

export function buildWall(system: SystemId, options: Record<string, string> = {}): WallModel {
  const merged = { ...defaultOptions(system), ...options };
  return system === "woodframe" ? buildWoodFrame(merged) : buildTradicional(merged);
}

/** Caja que encierra la pared con la explosión `e` (0 = armada, 1 = totalmente explotada). Sirve para encuadrar la cámara. */
export function explodedBounds(model: WallModel, e: number): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const l of model.layers) for (const p of l.parts) {
    const b = partBounds(p);
    for (let k = 0; k < 3; k++) {
      const off = (l.explode[k]! + (p.ex?.[k] ?? 0)) * e;
      min[k] = Math.min(min[k]!, b.min[k]! + off);
      max[k] = Math.max(max[k]!, b.max[k]! + off);
    }
  }
  return { min, max };
}
