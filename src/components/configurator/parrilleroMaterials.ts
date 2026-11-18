import * as THREE from "three";

/**
 * Materiales del parrillero, todos procedurales (sin imágenes de parrilleros ni fotos): ladrillo visto, revoque fino,
 * ladrillo refractario, hormigón, revoque de la base, hollín y acero inoxidable. Cada textura es una baldosa que repite sin
 * costuras y está dibujada en metros (por eso las caras de la geometría tienen los UV en metros): las hiladas y las juntas
 * mantienen su escala real. El ladrillo se dibuja con variaciones de tono ladrillo por ladrillo y la junta hundida (mapa de
 * relieve), para que no se vea una repetición artificial.
 */

/** Generador pseudoaleatorio con semilla: la textura es siempre la misma (no titila entre cargas). */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Tile = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number };
/** Un lienzo de `px` × `px` que representa una baldosa de `w` × `h` metros (se dibuja en metros). */
function tile(px: number, w: number, h: number): Tile {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(px / w, px / h);
  return { canvas, ctx, w, h };
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + ((b[i] ?? v) - v) * t);
const css = (c: number[]) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(",")})`;

/** Granulado fino (motas claras y oscuras) para que ninguna cara sea un color plano. */
function speckle(t: Tile, rand: () => number, count: number, amount: number, size = 0.004) {
  for (let i = 0; i < count; i++) {
    const x = rand() * t.w,
      y = rand() * t.h,
      v = rand() < 0.5 ? 0 : 255;
    t.ctx.fillStyle = `rgba(${v},${v},${v},${rand() * amount})`;
    t.ctx.fillRect(x, y, size * (0.5 + rand()), size * (0.5 + rand()));
  }
}

/**
 * Hiladas de ladrillo en aparejo trabado: ladrillo de 0,24 × 0,065 m con junta de 1 cm (paso 0,25 × 0,075 m). La baldosa
 * repite sin costura porque su ancho es un número entero de ladrillos y su alto un número entero de hiladas.
 */
function brickPattern(
  t: Tile,
  rand: () => number,
  opt: { cols: number; rows: number; brick: number[][]; mortar: number[]; lift?: number; bump?: boolean; pitch?: [number, number]; body?: [number, number] },
) {
  const [pw, ph] = opt.pitch ?? [0.25, 0.075],
    [bw, bh] = opt.body ?? [0.24, 0.065];
  t.ctx.fillStyle = css(opt.mortar);
  t.ctx.fillRect(0, 0, t.w, t.h);
  for (let r = 0; r < opt.rows; r++) {
    const off = r % 2 ? pw / 2 : 0;
    for (let k = -1; k <= opt.cols; k++) {
      const base = opt.brick[Math.floor(rand() * opt.brick.length)] as number[],
        tone = 1 + (rand() - 0.5) * 0.16,
        x = off + k * pw + (pw - bw) / 2,
        y = r * ph + (ph - bh) / 2;
      const c = base.map((v) => v * tone);
      if (opt.bump) {
        const v = 170 + rand() * 60;
        t.ctx.fillStyle = css([v, v, v]);
      } else {
        // Leve degradé vertical: el ladrillo se ve apenas abombado, no plano.
        const g = t.ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, css(c.map((v) => v * 1.06)));
        g.addColorStop(1, css(c.map((v) => v * 0.94)));
        t.ctx.fillStyle = g;
      }
      t.ctx.fillRect(x, y, bw, bh);
      // Dibujado en los dos extremos para que el ladrillo que cruza el borde de la baldosa repita sin costura.
      if (x + bw > t.w) t.ctx.fillRect(x - t.w, y, bw, bh);
      if (x < 0) t.ctx.fillRect(x + t.w, y, bw, bh);
    }
  }
  if (!opt.bump) speckle(t, rand, 5200, 0.28);
}

function toTexture(t: Tile, repeatX: number, repeatY: number, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(t.canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const BRICK_TONES = [
  [183, 86, 58],
  [196, 102, 70],
  [176, 78, 52],
  [205, 120, 82],
  [189, 98, 66],
  [199, 132, 92],
  [170, 80, 56],
];
const MORTAR = [214, 205, 188];
const REFRACTORY_TONES = [
  [236, 224, 196],
  [229, 215, 183],
  [241, 232, 208],
  [222, 207, 173],
];

function brickTextures() {
  const color = tile(1024, 1, 0.9),
    bump = tile(1024, 1, 0.9);
  brickPattern(color, rng(11), { cols: 4, rows: 12, brick: BRICK_TONES, mortar: MORTAR });
  brickPattern(bump, rng(11), { cols: 4, rows: 12, brick: [[200, 200, 200]], mortar: [40, 40, 40], bump: true });
  speckle(bump, rng(5), 4000, 0.35);
  return { map: toTexture(color, 1, 1 / 0.9, true), bump: toTexture(bump, 1, 1 / 0.9, false) };
}

function refractoryTextures() {
  // Baldosa de 0,50 × 0,45 m: 2 ladrillos refractarios de ancho y 6 hiladas de alto.
  const color = tile(512, 0.5, 0.45),
    bump = tile(512, 0.5, 0.45),
    opt = { cols: 2, rows: 6, body: [0.245, 0.07] as [number, number] };
  brickPattern(color, rng(23), { ...opt, brick: REFRACTORY_TONES, mortar: [160, 152, 138] });
  brickPattern(bump, rng(23), { ...opt, brick: [[210, 210, 210]], mortar: [30, 30, 30], bump: true });
  return { map: toTexture(color, 2, 1 / 0.45, true), bump: toTexture(bump, 2, 1 / 0.45, false) };
}

/** Revoque: color casi uniforme con grano fino y manchas muy suaves, mate (sin brillo de plástico). */
function plasterTexture(base: number[], seed: number, blotch = 0.05) {
  const t = tile(512, 1, 1),
    rand = rng(seed);
  t.ctx.fillStyle = css(base);
  t.ctx.fillRect(0, 0, 1, 1);
  for (let i = 0; i < 60; i++) {
    const x = rand(),
      y = rand(),
      r = 0.08 + rand() * 0.16,
      v = rand() < 0.5 ? 0 : 255;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const g = t.ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},${blotch * rand()})`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      t.ctx.fillStyle = g;
      t.ctx.fillRect(0, 0, 1, 1);
    }
  }
  speckle(t, rand, 9000, 0.22, 0.003);
  return toTexture(t, 1, 1, true);
}

export type ParrilleroMaterials = {
  brick: THREE.MeshStandardMaterial;
  plaster: THREE.MeshStandardMaterial;
  refractory: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  base: THREE.MeshStandardMaterial;
  soot: THREE.MeshStandardMaterial;
  stainless: THREE.MeshStandardMaterial;
  dispose: () => void;
};

/** Crea los materiales (y sus texturas) una sola vez; `dispose` los libera al desmontar. */
export function createParrilleroMaterials(): ParrilleroMaterials {
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture>(t: T) => (textures.push(t), t);
  const brick = brickTextures(),
    refractory = refractoryTextures(),
    plaster = keep(plasterTexture([222, 212, 192], 31, 0.05)),
    concrete = keep(plasterTexture([170, 170, 164], 47, 0.12));
  textures.push(brick.map, brick.bump, refractory.map, refractory.bump);

  const mats: Omit<ParrilleroMaterials, "dispose"> = {
    brick: new THREE.MeshStandardMaterial({ map: brick.map, bumpMap: brick.bump, bumpScale: 1.6, roughness: 0.94, metalness: 0 }),
    plaster: new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.96, metalness: 0 }),
    refractory: new THREE.MeshStandardMaterial({ map: refractory.map, bumpMap: refractory.bump, bumpScale: 1.2, roughness: 0.9, metalness: 0 }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.88, metalness: 0 }),
    // La base de ticholos va revocada (revoque grueso, un poco más oscuro y cálido que el hormigón).
    base: new THREE.MeshStandardMaterial({ map: concrete, color: "#cfc3ae", roughness: 0.95, metalness: 0 }),
    soot: new THREE.MeshStandardMaterial({ color: "#1f1b18", roughness: 1, metalness: 0 }),
    stainless: new THREE.MeshStandardMaterial({ color: "#c9ced2", roughness: 0.34, metalness: 0.92, envMapIntensity: 1 }),
  };
  return {
    ...mats,
    dispose: () => {
      for (const m of Object.values(mats)) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
