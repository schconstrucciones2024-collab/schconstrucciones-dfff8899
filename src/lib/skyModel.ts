/**
 * Cielo y luz según la hora del día (0–24). Son funciones puras: no usan Three.
 * El visor las evalúa en cada cuadro de la transición y aplica el resultado a las luces, la niebla,
 * el domo del cielo y la exposición; así las pruebas cubren los valores sin necesidad de WebGL.
 * Los colores son sRGB (#rrggbb).
 */
export type Vec3 = [number, number, number];

export type SkyKey = {
  hour: number;
  zenith: string;
  horizon: string;
  fog: string;
  light: string;
  lightI: number;
  ambient: string;
  ambientI: number;
  exposure: number;
  env: number;
  stars: number;
  glow: number;
};

/** Cuadros clave: del amanecer al anochecer. La hora 24 repite la 0 para que el ciclo cierre. */
export const SKY_KEYS: SkyKey[] = [
  { hour: 0, zenith: "#05070f", horizon: "#0b1224", fog: "#0b1224", light: "#8fa6d6", lightI: 0.32, ambient: "#6b7fb0", ambientI: 0.3, exposure: 0.95, env: 0.12, stars: 1, glow: 1 },
  { hour: 5, zenith: "#0d1530", horizon: "#3a3a5c", fog: "#2a2f4a", light: "#8fa6d6", lightI: 0.3, ambient: "#6b7fb0", ambientI: 0.32, exposure: 0.95, env: 0.15, stars: 0.6, glow: 1 },
  { hour: 6.5, zenith: "#3d5a8c", horizon: "#f2a56a", fog: "#d9a98a", light: "#ffb27a", lightI: 1.2, ambient: "#c9b0a8", ambientI: 0.45, exposure: 1, env: 0.55, stars: 0, glow: 0.25 },
  { hour: 9, zenith: "#3f7fc4", horizon: "#b9d7ee", fog: "#c9dcea", light: "#fff1dc", lightI: 2.2, ambient: "#dfe9f2", ambientI: 0.65, exposure: 1, env: 0.9, stars: 0, glow: 0 },
  { hour: 13, zenith: "#2f78c4", horizon: "#cfe6f5", fog: "#d6e8f3", light: "#fffaf0", lightI: 2.5, ambient: "#eef3f7", ambientI: 0.7, exposure: 1, env: 1, stars: 0, glow: 0 },
  { hour: 18, zenith: "#3a6fb0", horizon: "#f0c890", fog: "#e0c9a8", light: "#ffd59a", lightI: 1.8, ambient: "#f1dcc4", ambientI: 0.55, exposure: 1, env: 0.8, stars: 0, glow: 0 },
  { hour: 19.7, zenith: "#3a4a7a", horizon: "#f06f4a", fog: "#c98a78", light: "#ff8f5a", lightI: 0.9, ambient: "#b99aa0", ambientI: 0.4, exposure: 1, env: 0.45, stars: 0.1, glow: 0.65 },
  { hour: 21, zenith: "#101a3a", horizon: "#4a3a62", fog: "#2c2c4a", light: "#8fa6d6", lightI: 0.3, ambient: "#6b7fb0", ambientI: 0.3, exposure: 0.95, env: 0.2, stars: 0.6, glow: 1 },
  { hour: 24, zenith: "#05070f", horizon: "#0b1224", fog: "#0b1224", light: "#8fa6d6", lightI: 0.32, ambient: "#6b7fb0", ambientI: 0.3, exposure: 0.95, env: 0.12, stars: 1, glow: 1 },
];

export const HOUR_DAY = 13;
export const HOUR_NIGHT = 23;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Lleva cualquier hora al rango [0, 24). */
export const wrapHour = (h: number) => ((h % 24) + 24) % 24;

export function hexToRgb(hex: string): Vec3 {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(rgb: Vec3): string {
  return "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
}

export type SkyState = {
  hour: number;
  zenith: string;
  horizon: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  light: string;
  lightI: number;
  /** Posición de la luz principal (sol de día, luna de noche), a unos 22 m del origen. */
  lightPos: Vec3;
  sunDir: Vec3;
  moonDir: Vec3;
  /** 0 = luna, 1 = sol. */
  sunWeight: number;
  ambient: string;
  ambientI: number;
  exposure: number;
  env: number;
  stars: number;
  glow: number;
  /** 0 = de noche, 1 = de día (sol por encima del horizonte). */
  day: number;
};

const sunAngle = (h: number) => (Math.PI * (h - 6)) / 12;
function celestial(h: number): Vec3 {
  const a = sunAngle(h);
  const x = Math.cos(a), y = Math.sin(a), z = 0.4 * Math.max(y, 0) + 0.1;
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
}
/** Dirección del sol (puede quedar bajo el horizonte de noche). */
export const sunDirection = (h: number): Vec3 => celestial(wrapHour(h));
/** La luna recorre el mismo arco con 12 horas de diferencia. */
export const moonDirection = (h: number): Vec3 => celestial(wrapHour(h - 12));

export function skyAt(hourIn: number): SkyState {
  const hour = wrapHour(hourIn);
  let i = 0;
  while (i < SKY_KEYS.length - 2 && hour >= (SKY_KEYS[i + 1] as SkyKey).hour) i++;
  const a = SKY_KEYS[i] as SkyKey, b = SKY_KEYS[i + 1] as SkyKey;
  const t = easeInOut((hour - a.hour) / (b.hour - a.hour));
  const sun = sunDirection(hour), moon = moonDirection(hour);
  const sunWeight = smoothstep(0.02, 0.22, sun[1]);
  const moonUp = smoothstep(0.02, 0.22, moon[1]) * (1 - sunWeight);
  const wSun = sunWeight, wMoon = moonUp;
  const total = wSun + wMoon || 1;
  const dir: Vec3 = [
    (sun[0] * wSun + moon[0] * wMoon) / total,
    Math.max(0.12, (sun[1] * wSun + moon[1] * wMoon) / total),
    (sun[2] * wSun + moon[2] * wMoon) / total,
  ];
  const n = Math.hypot(...dir) || 1;
  const R = 22;
  return {
    hour,
    zenith: lerpHex(a.zenith, b.zenith, t),
    horizon: lerpHex(a.horizon, b.horizon, t),
    fog: lerpHex(a.fog, b.fog, t),
    fogNear: 35,
    fogFar: lerp(90, 70, 1 - smoothstep(0, 1, lerp(a.env, b.env, t))),
    light: lerpHex(a.light, b.light, t),
    lightI: lerp(a.lightI, b.lightI, t),
    lightPos: [(dir[0] / n) * R, (dir[1] / n) * R, (dir[2] / n) * R],
    sunDir: sun,
    moonDir: moon,
    sunWeight,
    ambient: lerpHex(a.ambient, b.ambient, t),
    ambientI: lerp(a.ambientI, b.ambientI, t),
    exposure: lerp(a.exposure, b.exposure, t),
    env: lerp(a.env, b.env, t),
    stars: lerp(a.stars, b.stars, t),
    glow: lerp(a.glow, b.glow, t),
    day: smoothstep(-0.05, 0.2, sun[1]),
  };
}

/** Hora mostrada durante una transición: arranca en `from`, llega a `to` en `duration` s con aceleración suave. */
export function transitionHour(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0) return to;
  return lerp(from, to, easeInOut(elapsed / duration));
}

/** "Día" mientras el sol esté por encima del horizonte. */
export const isDay = (hour: number) => sunDirection(hour)[1] > 0;

/** 13.5 → "13:30". */
export function formatHour(hour: number): string {
  const h = wrapHour(hour);
  const total = Math.round(h * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
