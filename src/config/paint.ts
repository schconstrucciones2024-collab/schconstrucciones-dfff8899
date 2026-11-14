/**
 * Pintura (opcional): precios, manos, colores y qué se pinta en cada opción de presupuesto.
 *
 * Es un extra que NO está incluido en el presupuesto de la vivienda. Todo lo que se pueda querer editar (precios,
 * textos, colores) vive en este archivo; los componentes solo lo leen.
 *
 * Los precios son por m² de superficie pintada, mano de obra y materiales incluidos. Se cargaron en pesos uruguayos y en
 * dólares tal como los pasó SCH (USD 1 = $U 40); el cotizador cobra en dólares, con los totales por manos que figuran en
 * cada ficha.
 *
 * Qué se pinta depende de la opción que se elige (`PAINT_PLAN`):
 *  - exterior: siding con acrílico exterior (Rústica, Moderna y Allwood);
 *  - interior: yeso/drywall con látex premium (Moderna) o madera con protector (Rústica y Allwood).
 * La construcción tradicional lleva muros revocados, que no están en la lista de precios: el color se elige igual, pero el
 * precio queda «A cotizar». Cuando haya precio de revoque, se completa `system` en `PAINT_PLAN` y listo.
 *
 * Archivo liviano a propósito (sin three, sin el estado del diseñador): lo importa el cotizador de la página.
 */
import { FINISH_MATERIALS, type FinishId, type MaterialKind } from "./materials";

/** Pesos uruguayos por dólar que usa la lista de precios. */
export const PAINT_FX = 40;

export type PaintCoats = 1 | 2 | 3;
export const PAINT_COATS: readonly PaintCoats[] = [1, 2, 3];
/** Por defecto son 2 manos. */
export const DEFAULT_COATS: PaintCoats = 2;

export type PaintSystemId = "yeso" | "siding" | "madera";
export const PAINT_SYSTEMS: readonly PaintSystemId[] = ["yeso", "siding", "madera"];
export type PaintZone = "interior" | "exterior";
export const PAINT_ZONES: readonly PaintZone[] = ["exterior", "interior"];

/** Un renglón de la ficha: el trabajo y su valor por m² en pesos y en dólares. */
export type PaintStep = { label: string; uyu: number; usd: number };

export type PaintTariff = {
  id: PaintSystemId;
  /** «Interior yeso / drywall». */
  nombre: string;
  /** Producto: «Látex premium (Belco Aqua)». */
  producto: string;
  /** Superficie que pinta, en una frase. */
  superficie: string;
  preparacion: PaintStep;
  /** 1ª, 2ª y 3ª mano (la tercera es opcional). */
  manos: readonly [PaintStep, PaintStep, PaintStep];
  /** Totales por m² según la cantidad de manos, preparación incluida (los de la lista de precios). */
  totales: Record<PaintCoats, { uyu: number; usd: number }>;
};

export const PAINT_TARIFFS: Record<PaintSystemId, PaintTariff> = {
  yeso: {
    id: "yeso",
    nombre: "Interior yeso / drywall",
    producto: "Látex premium (Belco Aqua)",
    superficie: "paredes interiores de yeso o drywall",
    preparacion: { label: "Preparación (lijado + sellador)", uyu: 50, usd: 1.25 },
    manos: [
      { label: "1ª mano", uyu: 120, usd: 3.0 },
      { label: "2ª mano", uyu: 100, usd: 2.5 },
      { label: "3ª mano opcional", uyu: 100, usd: 2.5 },
    ],
    totales: { 1: { uyu: 170, usd: 4.25 }, 2: { uyu: 270, usd: 6.75 }, 3: { uyu: 370, usd: 9.25 } },
  },
  siding: {
    id: "siding",
    nombre: "Exterior siding",
    producto: "Acrílico exterior",
    superficie: "paredes exteriores de siding",
    preparacion: { label: "Preparación (lijado + fijador/sellador)", uyu: 55, usd: 1.4 },
    manos: [
      { label: "1ª mano", uyu: 155, usd: 3.9 },
      { label: "2ª mano", uyu: 140, usd: 3.5 },
      { label: "3ª mano opcional", uyu: 140, usd: 3.5 },
    ],
    totales: { 1: { uyu: 210, usd: 5.25 }, 2: { uyu: 350, usd: 8.75 }, 3: { uyu: 490, usd: 12.25 } },
  },
  madera: {
    id: "madera",
    nombre: "Madera interior",
    producto: "Protector de madera",
    superficie: "paredes interiores de madera",
    preparacion: { label: "Preparación (lijado + limpieza)", uyu: 75, usd: 1.9 },
    manos: [
      { label: "1ª mano", uyu: 195, usd: 4.9 },
      { label: "2ª mano", uyu: 145, usd: 3.6 },
      { label: "3ª mano opcional", uyu: 145, usd: 3.6 },
    ],
    totales: { 1: { uyu: 270, usd: 6.75 }, 2: { uyu: 415, usd: 10.4 }, 3: { uyu: 560, usd: 14.0 } },
  },
};

/** USD por m² de un sistema con tantas manos (el total de la lista de precios). */
export const paintRateUsd = (system: PaintSystemId, coats: PaintCoats) => PAINT_TARIFFS[system].totales[coats].usd;
export const paintRateUyu = (system: PaintSystemId, coats: PaintCoats) => PAINT_TARIFFS[system].totales[coats].uyu;

/** El precio más bajo por m² con las manos por defecto: el «Desde» de la tarjeta. */
export const PAINT_DESDE_USD = Math.min(...PAINT_SYSTEMS.map((s) => paintRateUsd(s, DEFAULT_COATS)));

/** Lo que no incluye la pintura (se cotiza aparte). */
export const PAINT_NO_INCLUYE = [
  "Enduido completo.",
  "Masillado / tomado de juntas.",
  "Reparación de humedad.",
  "Decapado de barniz viejo.",
  "Cielorraso.",
  "Andamio / silleta ni trabajo en altura.",
] as const;

/* ─────────────────────────── Qué se pinta en cada opción ─────────────────────────── */

/** Cómo se elige el color: con el selector RGB, o con el tono de la madera. */
export type PaintKind = "color" | "madera";
export type PaintTarget = {
  /** Sistema de precios; null = no está en la lista (se cotiza aparte). */
  system: PaintSystemId | null;
  kind: PaintKind;
  /** Superficie sobre la que se pinta, tal como se ve en la ficha de la opción. */
  sustrato: string;
};

export const PAINT_PLAN: Record<FinishId, Record<PaintZone, PaintTarget>> = {
  rustica: {
    exterior: { system: "siding", kind: "color", sustrato: "Siding" },
    interior: { system: "madera", kind: "madera", sustrato: "Chapones cepillados de eucalipto/pino" },
  },
  moderna: {
    exterior: { system: "siding", kind: "color", sustrato: "Siding" },
    interior: { system: "yeso", kind: "color", sustrato: "Drywall (yeso)" },
  },
  allwood: {
    exterior: { system: "siding", kind: "color", sustrato: "Siding" },
    interior: { system: "madera", kind: "madera", sustrato: "Tablas machimbradas de pino" },
  },
  esencial: {
    exterior: { system: null, kind: "color", sustrato: "Revoque común" },
    interior: { system: null, kind: "color", sustrato: "Revoque común" },
  },
  clasica: {
    exterior: { system: null, kind: "color", sustrato: "Revoque fino" },
    interior: { system: null, kind: "color", sustrato: "Revoque fino" },
  },
};

export const paintTarget = (finish: FinishId, zone: PaintZone): PaintTarget => PAINT_PLAN[finish][zone];

/* ─────────────────────────── Colores ─────────────────────────── */

export type WoodStainId = "cristal" | "natural" | "cedro" | "caoba" | "roble-claro" | "roble-oscuro" | "nogal" | "ebano";

export type WoodStain = {
  id: WoodStainId;
  nombre: string;
  /** Una línea para el cliente. */
  descripcion: string;
  /** Cómo se ve sobre pino (la muestra de la paleta y la referencia del 3D). */
  muestra: string;
  /** Transparente: deja ver la veta y la madera tal cual, con un poco de brillo. */
  transparente: boolean;
};

/** Pino de referencia: el color medio de las tablas de pino del visor (machimbre). */
export const PINE_REFERENCE = "#d6aa70";

export const WOOD_STAINS: readonly WoodStain[] = [
  { id: "cristal", nombre: "Cristal", descripcion: "Transparente: deja ver la veta tal cual es.", muestra: PINE_REFERENCE, transparente: true },
  { id: "natural", nombre: "Natural", descripcion: "El tono natural del pino, apenas más cálido.", muestra: "#dcae70", transparente: false },
  { id: "cedro", nombre: "Cedro", descripcion: "Rojizo y cálido, con aire de cedro.", muestra: "#b4683a", transparente: false },
  { id: "caoba", nombre: "Caoba", descripcion: "Rojo oscuro, intenso y elegante.", muestra: "#7b3a28", transparente: false },
  { id: "roble-claro", nombre: "Roble claro", descripcion: "Dorado suave, luminoso.", muestra: "#c9a26b", transparente: false },
  { id: "roble-oscuro", nombre: "Roble oscuro", descripcion: "Marrón profundo con veta marcada.", muestra: "#7b5632", transparente: false },
  { id: "nogal", nombre: "Nogal", descripcion: "Marrón chocolate, sobrio.", muestra: "#523625", transparente: false },
  { id: "ebano", nombre: "Ébano", descripcion: "Casi negro, de máximo contraste.", muestra: "#241a15", transparente: false },
];
export const DEFAULT_WOOD: WoodStainId = "natural";
export const woodStain = (id: WoodStainId): WoodStain => WOOD_STAINS.find((s) => s.id === id) ?? WOOD_STAINS[1]!;

export type Swatch = { nombre: string; hex: string };

/** Colores de muestra para arrancar (no son de la carta de ningún fabricante); el selector RGB permite cualquier otro. */
export const EXTERIOR_SWATCHES: readonly Swatch[] = [
  { nombre: "Blanco", hex: "#f4f3ef" },
  { nombre: "Gris perla", hex: "#cfd3d6" },
  { nombre: "Gris cemento", hex: "#8f9498" },
  { nombre: "Grafito", hex: "#44484d" },
  { nombre: "Negro", hex: "#1d1e20" },
  { nombre: "Arena", hex: "#cdbb9d" },
  { nombre: "Verde bosque", hex: "#4b5e4c" },
  { nombre: "Azul marino", hex: "#2f4559" },
  { nombre: "Terracota", hex: "#a8624a" },
  { nombre: "Celeste", hex: "#9fc4da" },
];
export const INTERIOR_SWATCHES: readonly Swatch[] = [
  { nombre: "Blanco nieve", hex: "#f7f6f2" },
  { nombre: "Blanco hueso", hex: "#eee8da" },
  { nombre: "Crema", hex: "#e6d9bd" },
  { nombre: "Arena", hex: "#d6c5a6" },
  { nombre: "Gris perla", hex: "#d9dbdc" },
  { nombre: "Gris piedra", hex: "#a5a8a7" },
  { nombre: "Verde salvia", hex: "#a8b79f" },
  { nombre: "Azul niebla", hex: "#b7c6d2" },
  { nombre: "Terracota", hex: "#c47f61" },
  { nombre: "Grafito", hex: "#41454a" },
];
export const DEFAULT_EXTERIOR_COLOR = "#cfd3d6";
export const DEFAULT_INTERIOR_COLOR = "#f7f6f2";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** «#abc», «ABC» o «#AABBCC» → «#aabbcc». null si no es un color. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const m = HEX.exec(input.trim());
  if (!m) return null;
  let h = (m[1] ?? "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}
export type Rgb = [number, number, number];
export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const byte = (n: number) => Math.min(255, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));
export const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => byte(v).toString(16).padStart(2, "0")).join("")}`;
/** Nombre de un color de muestra («Gris perla»), o «Color personalizado» si salió del selector RGB. */
export function colorName(hex: string, zone: PaintZone): string {
  const n = normalizeHex(hex);
  const found = (zone === "exterior" ? EXTERIOR_SWATCHES : INTERIOR_SWATCHES).find((s) => s.hex === n);
  return found ? found.nombre : "Color personalizado";
}
/** «#CFD3D6 · RGB 207, 211, 214». */
export function colorText(hex: string): string {
  const n = normalizeHex(hex) ?? "#000000";
  return `${n.toUpperCase()} · RGB ${hexToRgb(n).join(", ")}`;
}

/** ¿Un color claro? (para elegir el color del texto o del tilde encima de una muestra). */
export function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

/* ─────────────────────────── Configuración ─────────────────────────── */

export type PaintConfig = {
  /** «Agregar pintura». */
  enabled: boolean;
  coats: PaintCoats;
  /** Qué paredes se pintan. */
  exterior: boolean;
  interior: boolean;
  /** Color del exterior (siding o revoque). */
  exteriorColor: string;
  /** Color del interior en yeso/drywall o revoque. */
  interiorColor: string;
  /** Tono del protector cuando el interior es de madera. */
  woodColor: WoodStainId;
};

export const DEFAULT_PAINT: PaintConfig = {
  enabled: false,
  coats: DEFAULT_COATS,
  exterior: true,
  interior: true,
  exteriorColor: DEFAULT_EXTERIOR_COLOR,
  interiorColor: DEFAULT_INTERIOR_COLOR,
  woodColor: DEFAULT_WOOD,
};

/** Deja cualquier entrada (un diseño viejo, un link compartido, un campo a medio escribir) como una pintura válida. */
export function normalizePaint(input?: Partial<PaintConfig> | null): PaintConfig {
  const p = (input ?? {}) as Record<string, unknown>;
  const coats = p.coats === 1 || p.coats === 3 ? p.coats : DEFAULT_COATS;
  return {
    enabled: p.enabled === true,
    coats,
    exterior: p.exterior !== false,
    interior: p.interior !== false,
    exteriorColor: normalizeHex(p.exteriorColor) ?? DEFAULT_EXTERIOR_COLOR,
    interiorColor: normalizeHex(p.interiorColor) ?? DEFAULT_INTERIOR_COLOR,
    woodColor: WOOD_STAINS.some((s) => s.id === p.woodColor) ? (p.woodColor as WoodStainId) : DEFAULT_WOOD,
  };
}

/** m² de paredes a pintar. */
export type PaintSurfaces = { interior: number; exterior: number };

/** ¿Hay algo para pintar? (la pintura está activa y al menos una de las dos caras elegida). */
export const paintIsActive = (p: PaintConfig) => p.enabled && (p.exterior || p.interior);

/* ─────────────────────────── Precio ─────────────────────────── */

export type PaintLineQuote = {
  zone: PaintZone;
  system: PaintSystemId | null;
  sustrato: string;
  /** m² de pared, redondeados al metro (lo que se muestra y se cobra). */
  area: number;
  /** USD por m² con las manos elegidas; null si no está en la lista (A cotizar). */
  rate: number | null;
  rateUyu: number | null;
  subtotal: number | null;
};

export type PaintPrice = {
  active: boolean;
  coats: PaintCoats;
  lines: PaintLineQuote[];
  /** USD de todas las líneas que tienen precio, sin logística. */
  subtotal: number;
  /** Hay paredes para pintar que se cotizan aparte (construcción tradicional). */
  pending: boolean;
};

export function paintPrice(paint: PaintConfig, finish: FinishId, surfaces: PaintSurfaces): PaintPrice {
  const active = paintIsActive(paint);
  const lines: PaintLineQuote[] = [];
  if (active) {
    for (const zone of PAINT_ZONES) {
      if (!paint[zone]) continue;
      const target = paintTarget(finish, zone),
        area = Math.max(0, Math.round(surfaces[zone]));
      if (area <= 0) continue;
      const rate = target.system ? paintRateUsd(target.system, paint.coats) : null,
        rateUyu = target.system ? paintRateUyu(target.system, paint.coats) : null;
      lines.push({
        zone,
        system: target.system,
        sustrato: target.sustrato,
        area,
        rate,
        rateUyu,
        subtotal: rate === null ? null : Math.round(area * rate),
      });
    }
  }
  return {
    active,
    coats: paint.coats,
    lines,
    subtotal: lines.reduce((n, l) => n + (l.subtotal ?? 0), 0),
    pending: lines.some((l) => l.subtotal === null),
  };
}

/** «USD 8,75» (siempre con dos decimales y coma, como se escribe en Uruguay). */
export const formatRate = (usd: number) => `USD ${usd.toFixed(2).replace(".", ",")}`;
export const formatUyu = (uyu: number) => `$U ${Math.round(uyu).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
export const coatsLabel = (n: PaintCoats) => (n === 1 ? "1 mano" : `${n} manos`);

/** Nombre corto de lo que se pinta en una línea: «Exterior · siding (acrílico exterior)». */
export function paintLineName(line: Pick<PaintLineQuote, "zone" | "system" | "sustrato">): string {
  const zone = line.zone === "exterior" ? "Exterior" : "Interior";
  if (!line.system) return `${zone} · ${line.sustrato.toLowerCase()}`;
  const t = PAINT_TARIFFS[line.system];
  return `${zone} · ${line.system === "siding" ? "siding" : line.system === "yeso" ? "yeso/drywall" : "madera"} (${t.producto.replace(/ \(.*\)$/, "").toLowerCase()})`;
}

/* ─────────────────────────── Superficie estimada (cotizador de la página) ─────────────────────────── */

/**
 * Sin diseño no se conocen las paredes: se estiman a partir de los m². Las constantes salen de medir las distribuciones
 * del catálogo del diseñador (ver `paintSurfaces.test.ts`, que vigila que la estimación no se aleje de esas medidas).
 * En «Diseñá tu casa» no se estima: se mide sobre el diseño real.
 */
export const PAINT_ESTIMATE = {
  woodframe: {
    /** m² de pared exterior = exteriorK × √m² (el perímetro crece con la raíz de la superficie), con frontones. */
    exteriorK: 11,
    /** m² de pared interior por m² construido: caras interiores de los muros + tabiques, sin la cerámica de los baños. */
    interiorPerM2: 1.85,
  },
  tradicional: { exteriorK: 9.3, interiorPerM2: 2.55 },
} as const;

/** Paredes a pintar estimadas para una casa de una planta de `m2` metros cuadrados. */
export function estimatePaintSurfaces(m2: number, system: "woodframe" | "tradicional" = "woodframe"): PaintSurfaces {
  const a = Math.max(0, m2),
    k = PAINT_ESTIMATE[system];
  return { exterior: Math.round(k.exteriorK * Math.sqrt(a)), interior: Math.round(k.interiorPerM2 * a) };
}

/* ─────────────────────────── Cómo se ve en el visor 3D ─────────────────────────── */

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/**
 * Multiplicador (en el espacio lineal del visor) que lleva una textura de color medio `base` al color `target`.
 * La textura conserva su relieve y su veta; solo cambia el tono. Puede pasar de 1 (para aclarar una textura gris a blanco).
 */
export function paintTint(target: string, base: string): Rgb {
  const t = hexToRgb(target),
    b = hexToRgb(base);
  return [0, 1, 2].map((i) => Math.min(2.2, Math.max(0, toLinear(t[i] ?? 0) / Math.max(0.02, toLinear(b[i] ?? 0))))) as Rgb;
}

/** Color medio de cada textura de pared del visor (promedio de su mapa de color). */
export const PAINT_BASE_COLOR: Partial<Record<MaterialKind, string>> = {
  chapones: "#b0845c",
  machimbre: "#d6aa70",
  lambriz: "#deb67c",
  drywall: "#ece9e3",
  sidingModerno: "#ced1d5",
  revoque: "#b2aa9a",
  revoqueFino: "#e8e3d6",
};

export type PaintLook = {
  /** Multiplicador del color de la textura (lineal). */
  tint: Rgb;
  /** Qué tanto se suaviza el brillo de la superficie (1 = como está). */
  roughness: number;
};

/**
 * Cómo se ve cada cara de la casa con la pintura elegida. null = sin cambios (la pintura está apagada o esa cara no se pinta).
 * Se aplica sobre las texturas reales de las paredes, que conservan su relieve.
 */
export function paintLooks(paint: PaintConfig | undefined, finish: FinishId): Record<PaintZone, PaintLook | null> {
  const none = { interior: null, exterior: null } as Record<PaintZone, PaintLook | null>;
  if (!paint || !paintIsActive(paint)) return none;
  const mats = FINISH_MATERIALS[finish];
  const out = { ...none };
  for (const zone of PAINT_ZONES) {
    if (!paint[zone]) continue;
    const target = paintTarget(finish, zone),
      baseKind = zone === "exterior" ? mats.siding : mats.wall,
      base = PAINT_BASE_COLOR[baseKind] ?? "#cccccc";
    if (target.kind === "madera") {
      const stain = woodStain(paint.woodColor);
      out[zone] = {
        tint: stain.transparente ? [1, 1, 1] : paintTint(stain.muestra, PINE_REFERENCE),
        roughness: stain.transparente ? 0.7 : 0.82,
      };
    } else {
      const color = zone === "exterior" ? paint.exteriorColor : paint.interiorColor;
      out[zone] = { tint: paintTint(color, base), roughness: 0.92 };
    }
  }
  return out;
}

/* ─────────────────────────── Textos ─────────────────────────── */

export const PAINT_TEXTOS = {
  titulo: "Pintura (opcional)",
  subtitulo:
    "Dejá tu casa pintada y lista para habitar. Mano de obra y materiales incluidos: elegís las manos y el color de cada superficie.",
  aviso: "Opcional. No incluida en el presupuesto de la vivienda. Se suma como extra.",
  letraChica: "Precio estimado en dólares (USD 1 = $U 40), sujeto a visita y medidas finales.",
  agregar: "Agregar pintura",
  agregarDescripcion:
    "Se cotiza por m² de pared pintada, según el material de cada superficie: látex premium en yeso, acrílico en siding y protector en madera.",
  manosTitulo: "Cantidad de manos",
  manosAyuda: "Por defecto son 2 manos. Podés elegir 1 o 3.",
  manosDefecto: "por defecto",
  tablaTitulo: "Precio por m² según las manos",
  dondeTitulo: "Qué querés pintar",
  exterior: "Paredes exteriores",
  interior: "Paredes interiores",
  colorTitulo: "Color",
  colorAyuda: "El color en pantalla es una referencia: puede verse distinto según tu pantalla y la luz. Lo confirmamos con la carta de colores antes de pintar.",
  colorExterior: "Color del exterior",
  colorInterior: "Color del interior",
  tonoMadera: "Tono del protector de madera",
  rgbTitulo: "Mezclá tu color",
  rgbAyuda: "Movés los tres controles o escribís el código.",
  paletaTitulo: "Colores de muestra",
  superficieEstimada: "Superficie estimada según los m² de cada opción. En «Diseñá tu casa» se mide sobre tu diseño real.",
  superficieDiseno: "Medida sobre tu diseño: paredes sin aberturas, ni cerámica de baños, ni cielorraso.",
  revoque:
    "Los muros revocados de la construcción tradicional se pintan con precio a medida: lo cotizamos con vos. Igual podés elegir el color y verlo en tu diseño.",
  aCotizar: "A cotizar",
  incluyeTitulo: "Qué incluye y cuánto cuesta cada trabajo",
  noIncluyeTitulo: "Qué no incluye",
  noIncluyeNota: "Se cotizan aparte.",
  comoSeCalculaTitulo: "Cómo se calcula",
  comoSeCalcula:
    "Superficie de pared por precio por m². El precio incluye la preparación (lijado y sellador) y cada mano, con mano de obra y materiales. La tercera mano es opcional. No se pinta cielorraso ni se cuentan puertas, ventanas ni la cerámica de los baños.",
  faqPregunta: "¿La pintura viene incluida en el precio de la casa?",
  faqRespuesta:
    "No. La pintura es un extra opcional que se presupuesta aparte, por m² de pared pintada, con mano de obra y materiales incluidos. Elegís 1, 2 o 3 manos (por defecto son 2) y el color de cada superficie. El cotizador y el diseñador 3D te muestran el costo y cómo queda.",
} as const;
