/**
 * Calidad de render del visor "Diseñá tu casa".
 *
 * Todo lo que se puede decidir sin WebGL está acá (y se prueba con `renderQuality.test.ts`): qué efectos lleva cada perfil,
 * qué perfil conviene según el equipo, cuándo bajar la calidad porque el visor va lento y cómo detectar un cuadro
 * completamente negro (señal de que la postproducción no funciona en ese dispositivo).
 *
 * El perfil "economico" es el render de siempre (sin postproducción): es también el respaldo si algo falla.
 */

export type QualityId = "economico" | "alto" | "ultra";
export const QUALITY_IDS: readonly QualityId[] = ["economico", "alto", "ultra"];

export type AoConfig = {
  /** Muestras por píxel del cálculo de oclusión ambiental. */
  samples: number;
  /** Radio de búsqueda en metros: qué tan lejos "mira" una esquina para oscurecerse. */
  radius: number;
  scale: number;
  thickness: number;
  distanceExponent: number;
  /** Cuánto se mezcla el resultado con la imagen (0–1). */
  intensity: number;
  /** Muestras del filtro que limpia el ruido del cálculo. */
  denoiseSamples: number;
};

export type RenderProfile = {
  id: QualityId;
  label: string;
  hint: string;
  /** Usa la cadena de postproducción (tono de cine, oclusión, brillo, etc.). */
  post: boolean;
  /** Suavizado de bordes dentro de la cadena (0 = sin; 4 = cuatro muestras). */
  msaa: 0 | 4;
  /** Suavizado de bordes final (FXAA) sobre la imagen ya con tono de cine. */
  fxaa: boolean;
  ao: AoConfig | null;
  bloom: boolean;
  /** Lado del mapa de sombras del sol. */
  shadowMap: 1024 | 2048 | 4096;
  /** Densidad de píxeles máxima del visor. */
  dprMax: number;
  /** Reflejos del cielo real (se calculan del cielo de la hora elegida). */
  reflections: boolean;
  /** Resolución de cada cara del mapa de reflejos (PMREM admite 256 como mínimo). */
  reflectionRes: 256 | 512;
};

export const PROFILES: Record<QualityId, RenderProfile> = {
  economico: {
    id: "economico",
    label: "Económico",
    hint: "Render simple y liviano, sin sombras en celulares. Probá Alto o Ultra para verlas.",
    post: false, msaa: 0, fxaa: false, ao: null, bloom: false, shadowMap: 2048, dprMax: 1.5, reflections: false, reflectionRes: 256,
  },
  alto: {
    id: "alto",
    label: "Alto",
    hint: "Sombras del sol y suaves en esquinas, brillo de luces, reflejos del cielo y tono de cine.",
    post: true, msaa: 0, fxaa: true,
    ao: { samples: 8, radius: 0.5, scale: 1, thickness: 1, distanceExponent: 1, intensity: 0.7, denoiseSamples: 8 },
    bloom: true, shadowMap: 2048, dprMax: 1.75, reflections: true, reflectionRes: 256,
  },
  ultra: {
    id: "ultra",
    label: "Ultra",
    hint: "Lo más cercano a un render: bordes suaves, sombras nítidas (4096 px en compu, 2048 px en celular) y más oclusión ambiental.",
    post: true, msaa: 4, fxaa: false,
    ao: { samples: 16, radius: 0.5, scale: 1, thickness: 1, distanceExponent: 1, intensity: 0.85, denoiseSamples: 16 },
    bloom: true, shadowMap: 4096, dprMax: 1.75, reflections: true, reflectionRes: 512,
  },
};

export const isQualityId = (value: unknown): value is QualityId => typeof value === "string" && (QUALITY_IDS as readonly string[]).includes(value);

export type DeviceInfo = { mobile: boolean; cores: number; memoryGB?: number; saveData?: boolean };

/**
 * Límites que impone el equipo a cualquier perfil. En un celular (o un equipo de 4 núcleos o menos):
 *  - sin suavizado MSAA: los buffers multisample de alto rango no andan bien en muchas GPU móviles y dejaban la imagen
 *    transparente o blanquecina. Se usa FXAA, que da un resultado muy parecido y funciona en todos lados;
 *  - mapa de sombras de 2048 px como máximo (el de 4096 no entra en la memoria de muchos celulares);
 *  - oclusión ambiental con menos muestras (el cálculo de 16 muestras por píxel es muy pesado para una GPU móvil).
 */
export type DeviceLimits = { limited: boolean; msaa: boolean; maxShadowMap: 1024 | 2048 | 4096; maxAoSamples: number };

export const NO_LIMITS: DeviceLimits = { limited: false, msaa: true, maxShadowMap: 4096, maxAoSamples: 16 };

export function deviceLimits(device: Pick<DeviceInfo, "mobile" | "cores">): DeviceLimits {
  const cores = Number.isFinite(device.cores) && device.cores > 0 ? device.cores : 4;
  if (device.mobile || cores <= 4) return { limited: true, msaa: false, maxShadowMap: 2048, maxAoSamples: 8 };
  return NO_LIMITS;
}

/** Calidad inicial según el equipo. Un celular o un equipo de 4 núcleos o menos arranca en Económico; uno potente, en Ultra. */
export function defaultQuality(device: DeviceInfo): QualityId {
  const cores = Number.isFinite(device.cores) && device.cores > 0 ? device.cores : 4;
  if (device.mobile || device.saveData || cores <= 4) return "economico";
  const memoryKnownLow = device.memoryGB !== undefined && Number.isFinite(device.memoryGB) && device.memoryGB < 8;
  if (cores >= 8 && !memoryKnownLow) return "ultra";
  return "alto";
}

/** Un escalón menos de calidad (o `null` si ya está en el mínimo). */
export function lowerQuality(id: QualityId): QualityId | null {
  if (id === "ultra") return "alto";
  if (id === "alto") return "economico";
  return null;
}

/** Interruptores que el usuario puede apagar dentro de un perfil. */
export type FxToggles = { ao: boolean; bloom: boolean; reflections: boolean; cine: boolean };
export const ALL_FX: FxToggles = { ao: true, bloom: true, reflections: true, cine: true };

/** Lo que de verdad queda activo: perfil + interruptores + si la postproducción falló. */
export type EffectiveFx = {
  quality: QualityId;
  profile: RenderProfile;
  post: boolean;
  ao: AoConfig | null;
  bloom: boolean;
  cine: boolean;
  fxaa: boolean;
  msaa: 0 | 4;
  reflections: boolean;
  /** Sombras del sol: en Económico se apagan en equipos limitados; en Alto y Ultra siempre se ven. */
  shadows: { enabled: boolean; size: 1024 | 2048 | 4096 };
  /** Cambia solo cuando hay que rearmar la cadena de postproducción (no con los ajustes que varían por cuadro). */
  key: string;
};

export function effectiveFx(quality: QualityId, toggles: FxToggles, failed: boolean, limits: DeviceLimits = NO_LIMITS): EffectiveFx {
  const profile = PROFILES[failed ? "economico" : quality];
  const ao = profile.ao && toggles.ao ? (limits.maxAoSamples < profile.ao.samples ? { ...profile.ao, samples: limits.maxAoSamples, denoiseSamples: limits.maxAoSamples } : profile.ao) : null;
  const bloom = profile.bloom && toggles.bloom;
  const cine = profile.post && toggles.cine;
  // Si no queda ningún efecto activo, se dibuja como en Económico: no tiene sentido pagar la cadena entera.
  const post = profile.post && (!!ao || bloom || cine);
  const msaa = post && limits.msaa ? profile.msaa : 0;
  // Si el equipo no admite MSAA, el suavizado de bordes lo hace FXAA.
  const fxaa = post && (profile.fxaa || (profile.msaa > 0 && msaa === 0));
  const shadowSize = Math.min(profile.shadowMap, limits.maxShadowMap) as 1024 | 2048 | 4096;
  const shadows = { enabled: profile.id !== "economico" || !limits.limited, size: shadowSize };
  const reflections = profile.reflections && toggles.reflections;
  const key = post ? `post|${ao ? `ao${ao.samples}-${ao.denoiseSamples}-${ao.radius}` : "noao"}|${bloom ? "bl" : "nobl"}|${cine ? "ci" : "noci"}|m${msaa}|${fxaa ? "fx" : "nofx"}` : "plain";
  return { quality: profile.id, profile, post, ao, bloom, cine, fxaa, msaa, reflections, shadows, key };
}

/** Ajustes que cambian con la hora del día (se recalculan solo cuando cambia el cielo). */
export type FxParams = {
  aoIntensity: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  vignette: number;
  saturation: number;
  contrast: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * `day` = 1 de día pleno, 0 de noche cerrada; `glow` = 0–1 nivel de luz de las ventanas.
 * De día solo brillan el sol y los reflejos fuertes; de noche el umbral baja para que se noten las ventanas encendidas.
 */
export function fxParams(fx: Pick<EffectiveFx, "ao" | "bloom" | "cine" | "quality">, sky: { day: number; glow: number }): FxParams {
  const day = clamp(Number.isFinite(sky.day) ? sky.day : 1, 0, 1);
  const glow = clamp(Number.isFinite(sky.glow) ? sky.glow : 0, 0, 1);
  const night = 1 - day;
  return {
    aoIntensity: fx.ao ? fx.ao.intensity : 0,
    bloomStrength: fx.bloom ? clamp(0.1 + 0.3 * night + 0.25 * glow, 0, 0.7) : 0,
    bloomRadius: 0.55,
    bloomThreshold: lerp(1.0, 0.72, night),
    vignette: fx.cine ? (fx.quality === "ultra" ? 0.26 : 0.2) : 0,
    saturation: fx.cine ? 1.05 : 1,
    contrast: fx.cine ? 1.04 : 1,
  };
}

/* ------------------------------------------------------------- ajuste automático */

export type GovernorOptions = {
  /** Promedio de milisegundos por cuadro a partir del cual se considera lento. */
  slowMs?: number;
  /** Cantidad de cuadros seguidos que se promedian. */
  window?: number;
  /** Cuadros iniciales que se ignoran (compilar shaders hace lentos los primeros). */
  warmup?: number;
  /** Un cuadro más largo que esto es una pausa (el visor dibuja solo cuando hace falta), no lentitud. */
  gapMs?: number;
};

/**
 * Mide la fluidez mientras el visor dibuja de corrido (al orbitar, en una transición) y avisa cuando conviene bajar un escalón.
 * Es una función pura de lo que recibe: no toca el reloj ni WebGL.
 */
export function createGovernor(options: GovernorOptions = {}) {
  const slowMs = options.slowMs ?? 1000 / 24, windowSize = options.window ?? 45, warmup = options.warmup ?? 12, gapMs = options.gapMs ?? 250;
  let skipped = 0, count = 0, sum = 0;
  return {
    /** Devuelve `"down"` cuando el promedio de la ventana supera el límite. */
    push(frameMs: number): "down" | null {
      if (!Number.isFinite(frameMs) || frameMs <= 0) return null;
      if (frameMs > gapMs) { count = 0; sum = 0; return null; }
      if (skipped < warmup) { skipped++; return null; }
      count++;
      sum += frameMs;
      if (count < windowSize) return null;
      const average = sum / count;
      count = 0;
      sum = 0;
      return average > slowMs ? "down" : null;
    },
    reset() { skipped = 0; count = 0; sum = 0; },
  };
}

/* ------------------------------------------------------------- cuadro negro */

/** Nueve puntos repartidos por la imagen (en píxeles enteros) donde se comprueba que el cuadro no esté vacío. */
export function samplePoints(width: number, height: number): { x: number; y: number }[] {
  const w = Math.max(1, Math.floor(width)), h = Math.max(1, Math.floor(height));
  const pts: { x: number; y: number }[] = [];
  for (const fy of [0.2, 0.5, 0.8]) for (const fx of [0.2, 0.5, 0.8]) pts.push({ x: Math.min(w - 1, Math.floor(w * fx)), y: Math.min(h - 1, Math.floor(h * fy)) });
  return pts;
}

/**
 * `true` si todos los píxeles muestreados (RGBA, de a cuatro valores) son negro absoluto. El cielo nocturno nunca lo es:
 * un cuadro así indica que la postproducción falló en ese dispositivo y hay que volver al render simple.
 */
export function looksBlank(rgba: ArrayLike<number>): boolean {
  if (rgba.length < 4) return false;
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    if ((rgba[i] ?? 0) > 1 || (rgba[i + 1] ?? 0) > 1 || (rgba[i + 2] ?? 0) > 1) return false;
  }
  return true;
}

/**
 * `true` si casi todos los puntos muestreados son blanco puro: la imagen salió "lavada" (señal de que un efecto se rompió
 * en la GPU del equipo). Una escena real siempre tiene tierra, pasto, sombras o paredes bien por debajo de ese blanco.
 */
export function looksWashedOut(rgba: ArrayLike<number>): boolean {
  let total = 0, white = 0;
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    total++;
    if ((rgba[i] ?? 0) >= 240 && (rgba[i + 1] ?? 0) >= 240 && (rgba[i + 2] ?? 0) >= 240) white++;
  }
  return total >= 4 && white / total >= 0.8;
}
