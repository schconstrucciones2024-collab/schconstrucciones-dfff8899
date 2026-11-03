import type { CategoryId } from "@/lib/cotizador";

export type FinishId = Extract<CategoryId, "rustica" | "moderna" | "allwood">;
export type MaterialKind =
  | "chapones" | "drywall" | "machimbre" | "lambriz" | "pisoPino"
  | "sidingRustico" | "sidingModerno" | "sidingAllwood"
  | "arena" | "hormigon" | "maderaPilote" | "pasto" | "chapa" | "mesada"
  // Apartado "Sistemas constructivos" (paredes Wood Frame y tradicional)
  | "maderaEstructural" | "chaponPino" | "chaponEucalipto" | "osb" | "lanaVidrio" | "membrana"
  | "ladrilloComun" | "ladrilloHueco" | "revoque" | "revoqueFino";

export const MATERIAL_NAMES: Record<MaterialKind, string> = {
  chapones: "Chapones cepillados de eucalipto/pino",
  drywall: "Drywall (yeso) blanco mate",
  machimbre: "Tablas machimbradas de pino",
  lambriz: "Lambriz de pino",
  pisoPino: "Piso de tablas machimbradas de pino",
  sidingRustico: "Siding natural",
  sidingModerno: "Siding gris claro",
  sidingAllwood: "Siding pino miel",
  hormigon: "Hormigón",
  maderaPilote: "Madera curada (pilote)",
  arena: "Arena costera",
  pasto: "Pasto",
  chapa: "Chapa",
  mesada: "Mesada",
  maderaEstructural: "Madera de estructura (pino)",
  chaponPino: "Chapones de pino cepillado",
  chaponEucalipto: "Chapones de eucalipto cepillado",
  osb: "Placa OSB",
  lanaVidrio: "Lana de vidrio",
  membrana: "Membrana hidrófuga",
  ladrilloComun: "Ladrillo común",
  ladrilloHueco: "Ladrillo hueco (ticholo)",
  revoque: "Revoque grueso",
  revoqueFino: "Revoque fino",
};

export const FINISH_MATERIALS: Record<FinishId, { wall: MaterialKind; ceiling: MaterialKind; floor: MaterialKind; siding: MaterialKind }> = {
  rustica: { wall: "chapones", ceiling: "chapones", floor: "pisoPino", siding: "sidingModerno" },
  moderna: { wall: "drywall", ceiling: "drywall", floor: "pisoPino", siding: "sidingModerno" },
  allwood: { wall: "machimbre", ceiling: "lambriz", floor: "pisoPino", siding: "sidingModerno" },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Boards = { base: [number, number, number]; boards: number; gap: number; grain: number; vary: number; vertical?: boolean; tone?: "wood" | "mineral"; seed: number };
export const MATERIAL_BOARDS: Partial<Record<MaterialKind, Boards>> = {
  chapones: { base: [176, 132, 92], boards: 4, gap: 3, grain: 0.5, vary: 22, seed: 3 },
  machimbre: { base: [214, 170, 112], boards: 10, gap: 2, grain: 0.35, vary: 16, vertical: true, seed: 5 },
  lambriz: { base: [222, 182, 124], boards: 14, gap: 2, grain: 0.3, vary: 12, seed: 7 },
  pisoPino: { base: [190, 142, 90], boards: 8, gap: 2, grain: 0.45, vary: 20, seed: 9 },
  sidingRustico: { base: [128, 92, 62], boards: 7, gap: 4, grain: 0.4, vary: 14, seed: 11 },
  sidingModerno: { base: [206, 209, 212], boards: 7, gap: 4, grain: 0.16, vary: 5, tone: "mineral", seed: 13 },
  sidingAllwood: { base: [196, 146, 84], boards: 7, gap: 4, grain: 0.4, vary: 14, seed: 15 },
  maderaPilote: { base: [112, 100, 70], boards: 2, gap: 1, grain: 0.6, vary: 10, vertical: true, seed: 17 },
};

/** Draws a seamless-ish 512px swatch representing 1 m × 1 m. Browser only. */
export function drawMaterial(kind: MaterialKind, size = 512): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la muestra de material.");
  const r = rng(kind.length * 97 + 1);
  const b = MATERIAL_BOARDS[kind];
  if (b) {
    const rr = rng(b.seed);
    const bw = size / b.boards;
    const mineral = b.tone === "mineral";
    for (let i = 0; i < b.boards; i++) {
      const v = (rr() - 0.5) * b.vary;
      ctx.fillStyle = mineral
        ? `rgb(${b.base[0] + v},${b.base[1] + v},${b.base[2] + v})`
        : `rgb(${b.base[0] + v},${b.base[1] + v * 0.85},${b.base[2] + v * 0.7})`;
      if (b.vertical) ctx.fillRect(i * bw, 0, bw, size); else ctx.fillRect(0, i * bw, size, bw);
      if (mineral) {
        // relieve de tablas superpuestas: brillo en el borde superior, sombra junto a la junta
        const lap = b.vertical
          ? ctx.createLinearGradient(i * bw, 0, (i + 1) * bw, 0)
          : ctx.createLinearGradient(0, i * bw, 0, (i + 1) * bw);
        lap.addColorStop(0, "rgba(255,255,255,0.18)");
        lap.addColorStop(0.4, "rgba(255,255,255,0.02)");
        lap.addColorStop(1, "rgba(0,0,0,0.14)");
        ctx.fillStyle = lap;
        if (b.vertical) ctx.fillRect(i * bw, 0, bw, size); else ctx.fillRect(0, i * bw, size, bw);
      }
      // grain
      ctx.strokeStyle = mineral
        ? `rgba(120,126,132,${0.05 + b.grain * 0.16})`
        : `rgba(60,35,15,${0.08 + b.grain * 0.18})`;
      for (let g = 0; g < 9; g++) {
        const off = rr() * bw, amp = 1 + rr() * 3, freq = 0.01 + rr() * 0.03, ph = rr() * 6;
        ctx.lineWidth = 0.6 + rr() * 1.2;
        ctx.beginPath();
        for (let t = 0; t <= size; t += 8) {
          const w = off + Math.sin(t * freq + ph) * amp;
          if (b.vertical) ctx.lineTo(i * bw + w, t); else ctx.lineTo(t, i * bw + w);
        }
        ctx.stroke();
      }
      // knots
      if (b.grain > 0.3 && rr() > 0.55) {
        const kx = rr() * size, ky = i * bw + bw / 2;
        ctx.fillStyle = "rgba(80,45,20,0.45)";
        ctx.beginPath();
        if (b.vertical) ctx.ellipse(ky, kx, bw * 0.12, bw * 0.2, 0, 0, Math.PI * 2);
        else ctx.ellipse(kx, ky, bw * 0.2, bw * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = mineral ? "rgba(96,101,107,0.6)" : "rgba(25,15,8,0.7)";
      if (b.vertical) ctx.fillRect(i * bw, 0, b.gap, size); else ctx.fillRect(0, i * bw, size, b.gap);
    }
    if (mineral) {
      // acabado pintado mate: moteado finísimo sobre toda la superficie
      for (let d = 0; d < 2600; d++) {
        const n = (rr() - 0.5) * 40;
        ctx.fillStyle = `rgba(${180 + n},${184 + n},${188 + n},0.06)`;
        ctx.fillRect(rr() * size, rr() * size, 1 + rr() * 2, 1 + rr() * 2);
      }
    }
    if (kind === "maderaPilote") { ctx.fillStyle = "rgba(70,90,40,0.18)"; ctx.fillRect(0, 0, size, size); }
    return c;
  }
  const noise = (base: [number, number, number], amount: number, dots: number) => {
    ctx.fillStyle = `rgb(${base.join(",")})`;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < dots; i++) {
      const v = (r() - 0.5) * amount;
      ctx.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},0.6)`;
      ctx.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3);
    }
  };
  switch (kind) {
    case "arena": noise([202, 191, 165], 26, 18000); break;
    case "drywall": noise([236, 233, 226], 10, 4000); break;
    case "mesada": noise([210, 206, 198], 30, 3000); break;
    case "hormigon":
      noise([150, 150, 146], 40, 9000);
      for (let i = 0; i < 160; i++) { ctx.fillStyle = "rgba(70,70,70,0.5)"; ctx.beginPath(); ctx.arc(r() * size, r() * size, r() * 2.5, 0, Math.PI * 2); ctx.fill(); }
      break;
    case "pasto":
      noise([88, 112, 58], 40, 6000);
      for (let i = 0; i < 2500; i++) {
        const x = r() * size, y = r() * size, g = 90 + r() * 70;
        ctx.strokeStyle = `rgba(${g * 0.6},${g},${g * 0.45},0.7)`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6); ctx.stroke();
      }
      break;
    case "chapa": {
      const ribs = 12, w = size / ribs;
      for (let i = 0; i < ribs; i++) {
        const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
        g.addColorStop(0, "#3a3d40"); g.addColorStop(0.5, "#6a6e72"); g.addColorStop(1, "#3a3d40");
        ctx.fillStyle = g; ctx.fillRect(i * w, 0, w, size);
      }
      break;
    }
    default: noise([128, 128, 128], 20, 1000);
  }
  return c;
}

/** Lado, en metros, de la muestra que se repite en cada material (los no listados usan 1 m). */
export const MATERIAL_TILE_M: Partial<Record<MaterialKind, number>> = { arena: 2, pasto: 2 };

export type MaterialMapId = "albedo" | "normal" | "orm";

/**
 * Mapas PBR horneados en `public/textures/<material>/`: color (sRGB), normal (OpenGL) y ORM
 * (R = oclusión, G = rugosidad, B = metal, sin usar). `low` pide la versión de 512 px para celulares.
 */
export function materialTextureUrl(kind: MaterialKind, map: MaterialMapId, low = false): string {
  return `/textures/${kind}/${map}${low ? "-512" : ""}.webp`;
}
