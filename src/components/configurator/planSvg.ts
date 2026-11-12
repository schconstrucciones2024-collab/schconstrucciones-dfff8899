/**
 * Dibujo del plano como SVG: lo usan el lienzo en pantalla (símbolos de puertas y ventanas) y la descarga en imagen.
 * Todo en metros reales. Sin DOM salvo `exportPlanPng`.
 */
import type { Point } from "@/config/geometry";
import { PLAN, meters, pieceNormal, squareMeters, type PlacedOpening, type PlanAnalysis, type PlanDoc } from "@/config/planDraw";
import { boxOf } from "./planView";

export type Seg = { x1: number; z1: number; x2: number; z2: number };
export type Glyph = { cut: Seg & { width: number }; lines: Seg[]; leaf: Seg | null; arc: string | null };

const seg = (a: Point, b: Point): Seg => ({ x1: a.x, z1: a.z, x2: b.x, z2: b.z });
const add = (p: Point, d: Point, k: number): Point => ({ x: p.x + d.x * k, z: p.z + d.z * k });
const f = (n: number) => String(Math.round(n * 1000) / 1000);

/** Símbolo de una abertura: hueco en la pared, y vidrio (ventanas) u hoja con su arco de giro (puertas). */
export function openingGlyph(o: PlacedOpening, thickness: number): Glyph {
  const half = o.width / 2, p0 = add(o.center, o.dir, -half), p1 = add(o.center, o.dir, half);
  const cut = { ...seg(p0, p1), width: thickness + 0.03 };
  if (o.kind === "puerta") {
    const leafEnd = add(p0, o.inward, o.width);
    const rx = leafEnd.x - p0.x, rz = leafEnd.z - p0.z, jx = p1.x - p0.x, jz = p1.z - p0.z;
    const sweep = rx * jz - rz * jx > 0 ? 1 : 0;
    return { cut, lines: [], leaf: seg(p0, leafEnd), arc: `M ${f(leafEnd.x)} ${f(leafEnd.z)} A ${f(o.width)} ${f(o.width)} 0 0 ${sweep} ${f(p1.x)} ${f(p1.z)}` };
  }
  const t = thickness / 3;
  if (o.kind === "ventanal") {
    const mid0 = add(o.center, o.dir, -0.08), mid1 = add(o.center, o.dir, 0.08);
    return { cut, leaf: null, arc: null, lines: [seg(add(p0, o.inward, -t), add(mid1, o.inward, -t)), seg(add(mid0, o.inward, t), add(p1, o.inward, t))] };
  }
  return { cut, leaf: null, arc: null, lines: [-t, 0, t].map((k) => seg(add(p0, o.inward, k), add(p1, o.inward, k))) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const line = (s: Seg, w: number, extra = "") => `<line x1="${f(s.x1)}" y1="${f(s.z1)}" x2="${f(s.x2)}" y2="${f(s.z2)}" stroke-width="${f(w)}" ${extra}/>`;

export type PlanSvgOptions = { title?: string; pxPerMeter?: number };
export type PlanSvg = { svg: string; width: number; height: number };

/** Plano para imprimir o compartir: blanco y negro, con medidas, superficies, nombres y regla de escala. */
export function planToSvg(doc: PlanDoc, a: PlanAnalysis, options: PlanSvgOptions = {}): PlanSvg {
  const ppm = options.pxPerMeter ?? 100;
  const box = boxOf(doc.walls.flatMap((w) => [w.a, w.b])) ?? { minX: 0, maxX: 4, minZ: 0, maxZ: 3 };
  const margin = 1.6, head = 1.5, foot = 1.4;
  const minX = box.minX - margin, minZ = box.minZ - margin - head;
  const w = Math.max(box.maxX - box.minX + margin * 2, 7), h = box.maxZ - box.minZ + margin * 2 + head + foot;
  const out: string[] = [];
  const text = (x: number, z: number, s: string, size: number, extra = "") =>
    `<text x="${f(x)}" y="${f(z)}" font-size="${f(size)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ${extra}>${esc(s)}</text>`;

  a.rooms.forEach((r, i) => {
    const ring = [r.room.polygon, ...(r.room.holes ?? [])].map((p) => `M ${p.map((q) => `${f(q.x)} ${f(q.z)}`).join(" L ")} Z`).join(" ");
    out.push(`<path d="${ring}" fill="${i % 2 ? "#eee9e1" : "#f6f3ee"}" fill-rule="evenodd" stroke="none"/>`);
  });
  const drawn = a.contour ? a.pieces.filter((p) => p.kind !== "stray") : a.pieces;
  for (const p of drawn) out.push(line(seg(p.a, p.b), p.kind === "exterior" ? PLAN.exteriorLine : PLAN.interiorLine, `stroke="#111" stroke-linecap="square"`));
  for (const o of a.openings) {
    if (o.problem) continue;
    const g = openingGlyph(o, o.exterior ? PLAN.exteriorLine : PLAN.interiorLine);
    out.push(line(g.cut, g.cut.width, `stroke="#fff"`));
    for (const l of g.lines) out.push(line(l, 0.025, `stroke="#111"`));
    if (g.leaf) out.push(line(g.leaf, 0.03, `stroke="#111"`));
    if (g.arc) out.push(`<path d="${g.arc}" fill="none" stroke="#111" stroke-width="0.02" stroke-dasharray="0.08 0.05"/>`);
  }
  for (const p of drawn) {
    const len = Math.hypot(p.a.x - p.b.x, p.a.z - p.b.z);
    if (len < 0.6) continue;
    const { x: nx, z: nz } = pieceNormal(a, p);
    const off = p.kind === "exterior" ? 0.42 : 0.28;
    out.push(text((p.a.x + p.b.x) / 2 + nx * off, (p.a.z + p.b.z) / 2 + nz * off + 0.07, meters(len), 0.2, `fill="#333"`));
  }
  for (const r of a.rooms) {
    const name = r.label?.text;
    if (name) out.push(text(r.room.center.x, r.room.center.z - 0.05, name, 0.27, `font-weight="700" fill="#111"`));
    out.push(text(r.room.center.x, r.room.center.z + (name ? 0.3 : 0.08), squareMeters(r.room.area), 0.22, `fill="#444"`));
  }
  const title = options.title ?? "Plano · SCH Construcciones";
  out.push(text(minX + w / 2, minZ + 0.7, title, 0.42, `font-weight="700" fill="#111"`));
  if (a.contour) out.push(text(minX + w / 2, minZ + 1.15, `Superficie cubierta ${squareMeters(a.area)} · medidas reales en metros`, 0.24, `fill="#444"`));
  // Regla de escala de 0 a 3 m, abajo a la izquierda.
  const bx = minX + 0.6, bz = minZ + h - 0.8;
  out.push(line({ x1: bx, z1: bz, x2: bx + 3, z2: bz }, 0.04, `stroke="#111"`));
  for (let m = 0; m <= 3; m++) out.push(line({ x1: bx + m, z1: bz - 0.12, x2: bx + m, z2: bz + 0.12 }, 0.03, `stroke="#111"`));
  for (const m of [0, 1, 2, 3]) out.push(text(bx + m, bz + 0.4, String(m), 0.2, `fill="#333"`));
  out.push(text(bx + 3.8, bz + 0.06, "m", 0.2, `fill="#333"`));

  const pw = Math.round(w * ppm), ph = Math.round(h * ppm);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="${f(minX)} ${f(minZ)} ${f(w)} ${f(h)}"><rect x="${f(minX)}" y="${f(minZ)}" width="${f(w)}" height="${f(h)}" fill="#fff"/>${out.join("")}</svg>`;
  return { svg, width: pw, height: ph };
}

/** Descarga el plano como imagen PNG (solo navegador). */
export async function planToPng(doc: PlanDoc, a: PlanAnalysis, options: PlanSvgOptions = {}): Promise<{ blob: Blob; width: number; height: number }> {
  const { svg, width, height } = planToSvg(doc, a, options);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error("No pudimos preparar la imagen del plano."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no pudo crear la imagen.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!blob) throw new Error("Tu navegador no pudo guardar la imagen.");
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
