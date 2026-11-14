import { TRADICIONAL_EXCLUIDO, TRADICIONAL_TEXTOS, discountedRate, incluyeFor, nextVolumeTier, volumeDiscount } from "@/config/tradicional";
import { DEFAULT_DECK, DECK_A_COTIZAR, DECK_TEXTOS, deckLabel, deckLineName, deckPrice, type DeckConfig, type DeckPrice } from "@/config/deck";
import {
  PAINT_TEXTOS,
  coatsLabel,
  colorName,
  colorText,
  estimatePaintSurfaces,
  formatRate,
  paintIsActive,
  paintLineName,
  paintPrice,
  paintTarget,
  woodStain,
  type PaintConfig,
  type PaintPrice,
  type PaintSurfaces,
} from "@/config/paint";

export const AREA_MIN = 10;
export const AREA_MAX = 500;
export const AREA_DEFAULT = 40;
export const WHATSAPP_OFICIAL = "https://wa.me/message/XQR2B2RH7SSWD1";
// Same contact used by the site's existing prefilled contact form.
const WHATSAPP_MESSAGE_DESTINATION = "https://wa.me/59895564068";

export type SystemId = "woodframe" | "tradicional";
export type CategoryId = "rustica" | "moderna" | "allwood" | "esencial" | "clasica";
export type Category = { id: CategoryId; name: string; price: number; description: string; interior: string };
export type Areas = Partial<Record<CategoryId, number>>;

export const EXTERIOR_REVESTIMIENTO = "Revestimiento exterior: siding, modificable según el proyecto del cliente.";

export const CATEGORIES: Category[] = [
  {
    id: "rustica",
    name: "RÚSTICA",
    price: 850,
    description: "Una alternativa accesible y funcional para quienes buscan materializar su proyecto con una inversión inicial más económica.",
    interior:
      "Pared y cielorraso de chapones cepillados de primera de eucalipto/pino. Piso de tablas machimbradas curadas/tratadas de pino de primera. Baños con piso de cerámica antideslizante y paredes de cerámica.",
  },
  {
    id: "moderna",
    name: "MODERNA",
    price: 900,
    description: "Una alternativa equilibrada para quienes buscan una propuesta de vivienda contemporánea.",
    interior:
      "Pared y cielorraso de drywall (yeso). Piso de tablas machimbradas curadas/tratadas de pino de primera. Baños con piso de cerámica antideslizante y paredes de cerámica.",
  },
  {
    id: "allwood",
    name: "ALLWOOD",
    price: 990,
    description: "La alternativa de mayor precio por metro cuadrado entre las tres categorías disponibles.",
    interior:
      "Pared de tablas machimbradas de madera de pino curadas/tratadas de primera. Cielorraso de lambriz de pino de primera. Piso de tablas machimbradas de pino curadas/tratadas de primera. Baños con piso de cerámica antideslizante y paredes de cerámica.",
  },
];

/** Lo que no incluye el precio de una cabaña woodframe. */
export const EXCLUDED = ["Grifería.", "Artefactos de sanitaria.", "Pintura.", "Decks.", "Pérgolas.", "Parrilleros."];
export type SystemConfig = {
  name: string;
  count: string;
  categories: Category[];
  materialsLabel: string;
  included: string[];
  excluded: readonly string[];
};
export const SYSTEMS: Record<SystemId, SystemConfig> = {
  woodframe: {
    name: "Woodframe", count: "tres", categories: CATEGORIES, materialsLabel: "Revestimientos interiores",
    included: ["Madera 100 % curada y tratada.", "Instalación eléctrica interior completa.", "Instalación sanitaria completa hasta la primera cámara.", "Mobiliario principal: mesada de cocina.", "Mobiliario principal: mesada de baño."],
    excluded: EXCLUDED,
  },
  tradicional: {
    name: "Construcción tradicional", count: "dos", materialsLabel: "Materiales y terminaciones",
    // Los mismos cinco puntos que justifican el valor (config/tradicional.ts), con el detalle de las dos opciones.
    included: incluyeFor().map((item) => `${item.titulo}: ${item.texto}`),
    excluded: TRADICIONAL_EXCLUIDO,
    // Tarifas base por m² (Punta del Diablo, terreno firme y nivelado). Desde 65 m² rige el descuento por superficie
    // (config/tradicional.ts → VOLUME_TIERS): se calcula con `rateFor` / `estimateFor`, nunca con `price` a secas.
    categories: [
      { id: "esencial", name: "ESENCIAL", price: 1200, description: "Una alternativa sólida y accesible para construir en ladrillo, con techo liviano y una inversión inicial más económica.", interior: "Muros de ladrillo hueco (ticholo) o ladrillo común, con revoque común · Cielorraso de yeso · Piso cerámico estándar · Aberturas · Techo liviano de chapa con aislación térmica/hidrófuga reforzada" },
      { id: "clasica", name: "CLÁSICA", price: 1400, description: "Una alternativa de mayor terminación, con losa de hormigón armado y piso porcelanato.", interior: "Muros de ladrillo hueco (ticholo) o ladrillo común, con revoque fino · Losa llena de hormigón armado con aislación térmica y membrana asfáltica · Piso porcelanato · Aberturas" },
    ],
  },
};

export const createAreas = (): Record<CategoryId, number> => ({ rustica: AREA_DEFAULT, moderna: AREA_DEFAULT, allwood: AREA_DEFAULT, esencial: AREA_DEFAULT, clasica: AREA_DEFAULT });
export function updateAreas(areas: Record<CategoryId, number>, system: SystemId, id: CategoryId, value: number, sync: boolean) {
  const next = { ...areas };
  for (const category of SYSTEMS[system].categories) {
    if (sync || category.id === id) next[category.id] = clampArea(value);
  }
  return next;
}

/** Más de AREA_MAX m² ya no se cotiza en línea: se consulta directamente con SCH. */
export const AREA_CONSULT_TEXT = `¿Necesitás más de ${AREA_MAX} m²? Consultalo con SCH.`;
export const AREA_CONSULT_URL = `${WHATSAPP_MESSAGE_DESTINATION}?text=${encodeURIComponent(`Hola SCH Construcciones, quiero consultar por una obra de más de ${AREA_MAX} m².`)}`;

export function clampArea(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return AREA_DEFAULT;
  return Math.min(AREA_MAX, Math.max(AREA_MIN, Math.round(n)));
}

/** Superficie × tarifa a secas, SIN descuento por superficie. Para una categoría usá `estimateFor`. */
export const estimate = (area: number, price: number) => clampArea(area) * price;

/** Solo la construcción tradicional tiene descuento por superficie (65 m² → 5%, 90 m² → 8%); woodframe no. */
export const hasVolumeDiscount = (id: CategoryId): boolean => id === "esencial" || id === "clasica";

/** Precio por m² que se cobra para esa superficie: la tarifa base, o la bonificada en tradicional (1.200 → 1.140 → 1.104). */
export const rateFor = (id: CategoryId, price: number, area: number): number => (hasVolumeDiscount(id) ? discountedRate(price, area) : price);

/** Precio de la vivienda de esa categoría y superficie (m² entre 10 y 500). Lo usan el cotizador y el diseñador 3D. */
export const estimateFor = (category: Pick<Category, "id" | "price">, area: number): number => {
  const m2 = clampArea(area);
  return m2 * rateFor(category.id, category.price, m2);
};

export type VolumeBonus = {
  /** 5 u 8. */
  discount: number;
  area: number;
  /** Tarifa base por m². */
  baseRate: number;
  /** Precio por m² efectivo, ya con el descuento. */
  rate: number;
  /** Lo que se ahorra en total respecto de la tarifa base. */
  saving: number;
};

/** La bonificación que corresponde a esa superficie, o null si no aplica (woodframe o menos de 65 m²). */
export function volumeBonus(category: Pick<Category, "id" | "price">, area: number): VolumeBonus | null {
  if (!hasVolumeDiscount(category.id)) return null;
  const discount = volumeDiscount(area);
  if (discount === 0) return null;
  const rate = rateFor(category.id, category.price, area);
  return { discount, area, baseRate: category.price, rate, saving: area * (category.price - rate) };
}

/** Pista de cuántos m² faltan para el próximo tramo de descuento (solo tradicional). */
export function nextBonusHint(category: Pick<Category, "id">, area: number): string | null {
  if (!hasVolumeDiscount(category.id)) return null;
  const next = nextVolumeTier(area);
  return next ? TRADICIONAL_TEXTOS.pista(next) : null;
}

/** Líneas de texto de la bonificación para el resumen: mensaje, precio por m² efectivo y ahorro. */
export const volumeBonusLines = (bonus: VolumeBonus): string[] => [
  TRADICIONAL_TEXTOS.bonificacion(bonus.discount),
  `${TRADICIONAL_TEXTOS.precioEfectivo}: ${formatUSD(bonus.rate)}/m² (${TRADICIONAL_TEXTOS.tarifaBase} ${formatUSD(bonus.baseRate)}/m²)`,
];

export const LOGISTICS_ZONES = [
  { id: "local", label: "Punta del Diablo", places: "Sin costo logístico extra", min: 0, max: 0 },
  { id: "near", label: "Hasta 50 km", places: "Chuy, Barra del Chuy, Santa Teresa", min: 6, max: 6 },
  { id: "medium", label: "50–150 km", places: "Rocha, La Paloma", min: 10, max: 10 },
  { id: "long", label: "150–300 km", places: "Maldonado, Punta del Este, Montevideo", min: 15, max: 15 },
  { id: "far", label: "Más de 300 km", places: "Canelones, Soriano, litoral, norte", min: 19, max: 19 },
] as const;

export type LogisticsZoneId = (typeof LOGISTICS_ZONES)[number]["id"];
export type LogisticsSelection = { zoneId: LogisticsZoneId; separateTrip: boolean };
export const DEFAULT_LOGISTICS: LogisticsSelection = { zoneId: "local", separateTrip: false };
export const getLogisticsZone = (id: LogisticsZoneId) => LOGISTICS_ZONES.find((zone) => zone.id === id) ?? LOGISTICS_ZONES[0];

/** Cada tramo tiene un porcentaje fijo que se aplica al valor de la obra. */
export const logisticsPercentage = (selection: LogisticsSelection) => getLogisticsZone(selection.zoneId).max;

export function calculateLogistics(base: number, selection: LogisticsSelection) {
  const percentage = logisticsPercentage(selection);
  const separateTrip = selection.zoneId === "far" && selection.separateTrip;
  const surcharge = separateTrip ? null : (base * percentage) / 100;
  return { percentage, separateTrip, surcharge, total: surcharge === null ? null : base + surcharge };
}

export function formatUSD(value: number): string {
  return "USD " + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Extra opcional «Deck y techado»: no forma parte del presupuesto de la vivienda, se calcula aparte y se suma como extra.
 * Si la obra está fuera de Punta del Diablo, el costo logístico del mismo tramo se aplica también sobre el extra.
 */
export type DeckExtraQuote = DeckPrice & {
  percentage: number;
  /** Viaje a cotizar aparte (tramo de más de 300 km): no hay recargo calculable. */
  separateTrip: boolean;
  surcharge: number | null;
  /** Total del extra con logística; null si es «A cotizar» o hay viaje aparte. */
  total: number | null;
};

export function deckExtra(deck: DeckConfig, logistics: LogisticsSelection = DEFAULT_LOGISTICS): DeckExtraQuote {
  const price = deckPrice(deck);
  if (price.subtotal === null)
    return { ...price, percentage: logisticsPercentage(logistics), separateTrip: false, surcharge: null, total: null };
  const result = calculateLogistics(price.subtotal, logistics),
    surcharge = result.surcharge === null ? null : Math.round(result.surcharge);
  return {
    ...price,
    percentage: result.percentage,
    separateTrip: result.separateTrip,
    surcharge,
    total: surcharge === null ? null : price.subtotal + surcharge,
  };
}

/**
 * Extra opcional «Pintura»: igual que el deck, no forma parte del presupuesto de la vivienda y lleva el mismo costo logístico.
 * Las paredes de construcción tradicional (revoque) no están en la lista de precios: quedan «A cotizar» y no suman al total.
 */
export type PaintExtraQuote = PaintPrice & {
  percentage: number;
  separateTrip: boolean;
  surcharge: number | null;
  /** Total con logística de las paredes que tienen precio; null si hay viaje a cotizar aparte. */
  total: number | null;
};

export function paintExtra(
  paint: PaintConfig,
  finish: CategoryId,
  surfaces: PaintSurfaces,
  logistics: LogisticsSelection = DEFAULT_LOGISTICS,
): PaintExtraQuote {
  const price = paintPrice(paint, finish, surfaces),
    result = calculateLogistics(price.subtotal, logistics),
    surcharge = result.surcharge === null ? null : Math.round(result.surcharge);
  return {
    ...price,
    percentage: result.percentage,
    separateTrip: result.separateTrip,
    surcharge,
    total: surcharge === null ? null : price.subtotal + surcharge,
  };
}

/** ¿La pintura suma algo al total? (está activa y al menos una pared tiene precio). */
export const paintCounts = (q: PaintExtraQuote | undefined): q is PaintExtraQuote =>
  !!q && q.active && q.lines.some((l) => l.subtotal !== null);

/** Las tres líneas del resumen: la vivienda (su total no cambia por los extras), los extras y el total con extras. */
export function withExtras(vivienda: number | null, extra: DeckExtraQuote, paint?: PaintExtraQuote) {
  const items = [extra.active ? extra : null, paintCounts(paint) ? paint : null].filter(
    (q): q is DeckExtraQuote | PaintExtraQuote => q !== null,
  );
  const extras = items.length === 0 ? 0 : items.some((q) => q.total === null) ? null : items.reduce((n, q) => n + (q.total ?? 0), 0);
  return {
    vivienda,
    extras,
    totalConExtras: vivienda === null || items.length === 0 ? vivienda : extras === null ? null : vivienda + extras,
  };
}

/** Las paredes que se pintan en una opción, con el color elegido: «Exterior: Gris perla (#CFD3D6 · RGB 207, 211, 214)». */
export function paintColorLines(paint: PaintConfig, finishes: CategoryId[]): string[] {
  const lines: string[] = [];
  if (paint.exterior) lines.push(`Color exterior: ${colorName(paint.exteriorColor, "exterior")} (${colorText(paint.exteriorColor)})`);
  if (paint.interior) {
    const targets = finishes.map((f) => paintTarget(f, "interior"));
    if (targets.some((t) => t.kind === "color"))
      lines.push(`Color interior (yeso/drywall o revoque): ${colorName(paint.interiorColor, "interior")} (${colorText(paint.interiorColor)})`);
    if (targets.some((t) => t.kind === "madera")) lines.push(`Tono de la madera interior: ${woodStain(paint.woodColor).nombre}`);
  }
  return lines;
}

/** Líneas de una opción: «Exterior · siding (acrílico exterior): 46 m² × USD 8,75/m² = USD 403». */
export function paintQuoteLines(q: PaintExtraQuote): string[] {
  return q.lines.map((l) =>
    l.rate === null || l.subtotal === null
      ? `${paintLineName(l)}: ${l.area} m² — ${PAINT_TEXTOS.aCotizar}`
      : `${paintLineName(l)}: ${l.area} m² × ${formatRate(l.rate)}/m² = ${formatUSD(l.subtotal)}`,
  );
}

type SummaryRow = { id: CategoryId; name: string; area: number; total: number | null };

/** Bloque de extras cuando hay pintura (con o sin deck): el deck igual para todas las opciones y la pintura de cada una. */
function extrasWithPaintSummary(
  deck: DeckConfig | undefined,
  paint: PaintConfig,
  system: SystemId,
  logistics: LogisticsSelection,
  rows: SummaryRow[],
): string {
  const lines = ["Extras opcionales (no incluidos en el presupuesto de la vivienda)"];
  const dq = deck?.enabled ? deckExtra(deck, logistics) : null;
  if (deck && dq) {
    lines.push(deckLabel(deck));
    if (dq.subtotal === null) lines.push(`Deck: ${DECK_A_COTIZAR}`);
    else {
      lines.push(`${deck.roofed ? "Deck techado" : "Deck"} ${deckLineName(deck.line)}: ${dq.area} m² × USD ${dq.rate}/m² = ${formatUSD(dq.deck ?? 0)}`);
      if (dq.railMl > 0) lines.push(`Barandas ${deckLineName(deck.line)}: ${dq.railMl} ml × USD ${dq.railRate}/ml = ${formatUSD(dq.rails ?? 0)}`);
    }
    if (deck.steps) lines.push(`Escalones: ${DECK_TEXTOS.escalonesPrecio}`);
  }
  lines.push(`Pintura: ${coatsLabel(paint.coats)} (mano de obra y materiales incluidos)`);
  const quotes = rows.map((r) => ({ row: r, q: paintExtra(paint, r.id, estimatePaintSurfaces(r.area, system), logistics) }));
  const multi = rows.length > 1;
  for (const { row, q } of quotes) {
    for (const text of paintQuoteLines(q)) lines.push(multi ? `${row.name} — ${text}` : text);
  }
  lines.push(...paintColorLines(paint, rows.map((r) => r.id)));
  lines.push("Superficie estimada según los m² de cada opción (una planta); se confirma con la visita.");
  for (const { row, q } of quotes) {
    const withDeck = withExtras(row.total, dq ?? deckExtra(DEFAULT_DECK, logistics), q);
    const tag = multi ? ` (${row.name})` : "";
    if (withDeck.extras === null) lines.push(`Total de los extras${tag}: a confirmar (viaje a cotizar aparte)`);
    else {
      lines.push(`Total de los extras${tag}: ${formatUSD(withDeck.extras)}${q.percentage > 0 && !q.separateTrip ? ` (incluye logística ${q.percentage}%)` : ""}`);
      lines.push(`Total con extras${tag}: ${withDeck.totalConExtras === null ? "a confirmar" : formatUSD(withDeck.totalConExtras)}`);
    }
    if (q.pending) lines.push(`La pintura de las paredes marcadas «A cotizar»${tag} se presupuesta aparte y no está sumada.`);
  }
  lines.push(PAINT_TEXTOS.letraChica);
  return lines.join("\n");
}

function deckSummary(deck: DeckConfig, logistics: LogisticsSelection, viviendas: { name: string; total: number | null }[]): string {
  const extra = deckExtra(deck, logistics);
  const lines = [`Extras opcionales (no incluidos en el presupuesto de la vivienda)`, deckLabel(deck)];
  if (extra.subtotal === null) lines.push(`Deck: ${DECK_A_COTIZAR}`);
  else {
    lines.push(`${deck.roofed ? "Deck techado" : "Deck"} ${deckLineName(deck.line)}: ${extra.area} m² × USD ${extra.rate}/m² = ${formatUSD(extra.deck ?? 0)}`);
    if (extra.railMl > 0) lines.push(`Barandas ${deckLineName(deck.line)}: ${extra.railMl} ml × USD ${extra.railRate}/ml = ${formatUSD(extra.rails ?? 0)}`);
  }
  if (deck.steps) lines.push(`Escalones: ${DECK_TEXTOS.escalonesPrecio}`);
  if (extra.subtotal !== null) {
    if (extra.separateTrip) lines.push("Viaje a cotizar aparte. Total del extra pendiente de cotización logística.");
    else if (extra.percentage > 0) lines.push(`Costo logístico extra (${extra.percentage}%): ${formatUSD(extra.surcharge ?? 0)}`);
    if (extra.total !== null) lines.push(`Total del extra: ${formatUSD(extra.total)}`);
  }
  for (const v of viviendas) {
    const t = withExtras(v.total, extra).totalConExtras;
    lines.push(`Total con extras${viviendas.length > 1 ? ` (${v.name})` : ""}: ${t === null ? "a confirmar" : formatUSD(t)}`);
  }
  lines.push(DECK_TEXTOS.letraChica);
  return lines.join("\n");
}

export function buildSummary(areas: Areas, logistics?: LogisticsSelection, system: SystemId = "woodframe", categoryId?: CategoryId, deck?: DeckConfig, paint?: PaintConfig): string {
  const config = SYSTEMS[system];
  const selected = config.categories
    .filter((c) => categoryId === undefined || c.id === categoryId)
    .map((c) => {
      const area = clampArea(areas[c.id] ?? AREA_DEFAULT),
        base = estimateFor(c, area);
      return { category: c, area, base, bonus: volumeBonus(c, area) };
    });
  const rows: SummaryRow[] = selected.map(({ category: c, area, base }) => ({
    id: c.id,
    name: c.name,
    area,
    total: logistics ? calculateLogistics(base, logistics).total : base,
  }));
  // Precio por m² que se cobra: en tradicional, con la bonificación por superficie si corresponde.
  const blocks = selected.map(({ category: c, area, base, bonus }) =>
    [
      c.name,
      `Superficie: ${area} m²`,
      `Precio: ${formatUSD(bonus ? bonus.rate : c.price)}/m²${bonus ? ` (${TRADICIONAL_TEXTOS.tarifaBase} ${formatUSD(bonus.baseRate)}/m²)` : ""}`,
      ...(bonus ? [TRADICIONAL_TEXTOS.bonificacion(bonus.discount)] : []),
      `Inversión estimada: ${formatUSD(base)}`,
      `${system === "woodframe" ? "Terminaciones interiores" : config.materialsLabel}: ${c.interior}`,
      `Obra base: ${formatUSD(base)}${logistics ? logisticsSummary(base, logistics) : ""}`,
    ].join("\n"),
  );
  return [
    "SCH CONSTRUCCIONES — RESUMEN DE COTIZACIÓN",
    `Sistema: ${config.name}`,
    ...blocks,
    ...(system === "tradicional" ? [TRADICIONAL_TEXTOS.exclusiones] : []),
    ...(paint && paintIsActive(paint)
      ? [extrasWithPaintSummary(deck, paint, system, logistics ?? DEFAULT_LOGISTICS, rows)]
      : deck?.enabled
        ? [deckSummary(deck, logistics ?? DEFAULT_LOGISTICS, rows.map((r) => ({ name: r.name, total: r.total })))]
        : []),
    ...(system === "woodframe" ? [EXTERIOR_REVESTIMIENTO] : []),
    "Hola, SCH CONSTRUCCIONES. Quisiera solicitar un presupuesto personalizado para mi proyecto.",
    "Estas son las alternativas que estuve evaluando.",
    "Me gustaría recibir más información y conocer los detalles necesarios para elaborar un presupuesto personalizado.",
    "Gracias.",
  ].join("\n\n");
}

export function buildWhatsAppUrl(areas: Areas, logistics: LogisticsSelection, system: SystemId, categoryId?: CategoryId, deck?: DeckConfig, paint?: PaintConfig) {
  return `${WHATSAPP_MESSAGE_DESTINATION}?text=${encodeURIComponent(buildSummary(areas, logistics, system, categoryId, deck, paint))}`;
}

function logisticsSummary(base: number, selection: LogisticsSelection): string {
  const zone = getLogisticsZone(selection.zoneId);
  const result = calculateLogistics(base, selection);
  return `\nZona logística: ${zone.label} (${zone.places})` + (result.separateTrip
    ? `\nPorcentaje de referencia: ${result.percentage}%\nViaje a cotizar aparte. Total final pendiente de cotización logística.`
    : `\nCosto logístico extra (${result.percentage}%): ${formatUSD(result.surcharge ?? 0)}\nTotal estimado con logística: ${formatUSD(result.total ?? base)}`);
}
