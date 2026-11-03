export const AREA_MIN = 10;
export const AREA_MAX = 200;
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
      "Pared y cielorraso de chapones cepillados de primera de eucalipto/pino. Piso de tablas machimbradas curadas/tratadas de pino de primera.",
  },
  {
    id: "moderna",
    name: "MODERNA",
    price: 900,
    description: "Una alternativa equilibrada para quienes buscan una propuesta de vivienda contemporánea.",
    interior:
      "Pared y cielorraso de drywall (yeso). Piso de tablas machimbradas curadas/tratadas de pino de primera.",
  },
  {
    id: "allwood",
    name: "ALLWOOD",
    price: 990,
    description: "La alternativa de mayor precio por metro cuadrado entre las tres categorías disponibles.",
    interior:
      "Pared de tablas machimbradas de madera de pino curadas/tratadas de primera. Cielorraso de lambriz de pino de primera. Piso de tablas machimbradas de pino curadas/tratadas de primera.",
  },
];

export const EXCLUDED = ["Grifería.", "Artefactos de sanitaria.", "Pintura.", "Decks.", "Pérgolas.", "Parrilleros."];
export const SYSTEMS: Record<SystemId, { name: string; count: string; categories: Category[]; materialsLabel: string; included: string[] }> = {
  woodframe: {
    name: "Woodframe", count: "tres", categories: CATEGORIES, materialsLabel: "Revestimientos interiores",
    included: ["Madera 100 % curada y tratada.", "Instalación eléctrica interior completa.", "Instalación sanitaria completa hasta la primera cámara.", "Mobiliario principal: mesada de cocina.", "Mobiliario principal: mesada de baño."],
  },
  tradicional: {
    name: "Construcción tradicional", count: "dos", materialsLabel: "Materiales y terminaciones",
    included: ["Instalación eléctrica interior completa con firma de UTE.", "Instalación sanitaria completa hasta la primera cámara."],
    categories: [
      { id: "esencial", name: "ESENCIAL", price: 1300, description: "Una alternativa sólida y accesible para construir en ladrillo con una inversión inicial más económica.", interior: "Muros de ladrillo hueco (ticholo) o ladrillo común, con revoque común · Cielorraso de yeso · Piso cerámico estándar · Aberturas · Techo liviano de chapa con aislación básica" },
      { id: "clasica", name: "CLÁSICA", price: 1500, description: "Una alternativa de mayor terminación, con losa de hormigón y piso porcelanato.", interior: "Muros de ladrillo hueco (ticholo) o ladrillo común, con revoque fino · Losa de hormigón con aislación térmica y membrana asfáltica · Piso porcelanato · Aberturas" },
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

export function clampArea(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return AREA_DEFAULT;
  return Math.min(AREA_MAX, Math.max(AREA_MIN, Math.round(n)));
}

export const estimate = (area: number, price: number) => clampArea(area) * price;

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

export function buildSummary(areas: Areas, logistics?: LogisticsSelection, system: SystemId = "woodframe", categoryId?: CategoryId): string {
  const config = SYSTEMS[system];
  const blocks = config.categories.filter((c) => categoryId === undefined || c.id === categoryId).map(
    (c) =>
      `${c.name}\nSuperficie: ${clampArea(areas[c.id] ?? AREA_DEFAULT)} m²\nPrecio: USD ${c.price}/m²\nInversión estimada: ${formatUSD(estimate(areas[c.id] ?? AREA_DEFAULT, c.price))}\n${system === "woodframe" ? "Terminaciones interiores" : config.materialsLabel}: ${c.interior}\nObra base: ${formatUSD(estimate(areas[c.id] ?? AREA_DEFAULT, c.price))}${logistics ? logisticsSummary(estimate(areas[c.id] ?? AREA_DEFAULT, c.price), logistics) : ""}`,
  );
  return [
    "SCH CONSTRUCCIONES — RESUMEN DE COTIZACIÓN",
    `Sistema: ${config.name}`,
    ...blocks,
    ...(system === "woodframe" ? [EXTERIOR_REVESTIMIENTO] : []),
    "Hola, SCH CONSTRUCCIONES. Quisiera solicitar un presupuesto personalizado para mi proyecto.",
    "Estas son las alternativas que estuve evaluando.",
    "Me gustaría recibir más información y conocer los detalles necesarios para elaborar un presupuesto personalizado.",
    "Gracias.",
  ].join("\n\n");
}

export function buildWhatsAppUrl(areas: Areas, logistics: LogisticsSelection, system: SystemId, categoryId?: CategoryId) {
  return `${WHATSAPP_MESSAGE_DESTINATION}?text=${encodeURIComponent(buildSummary(areas, logistics, system, categoryId))}`;
}

function logisticsSummary(base: number, selection: LogisticsSelection): string {
  const zone = getLogisticsZone(selection.zoneId);
  const result = calculateLogistics(base, selection);
  return `\nZona logística: ${zone.label} (${zone.places})` + (result.separateTrip
    ? `\nPorcentaje de referencia: ${result.percentage}%\nViaje a cotizar aparte. Total final pendiente de cotización logística.`
    : `\nCosto logístico extra (${result.percentage}%): ${formatUSD(result.surcharge ?? 0)}\nTotal estimado con logística: ${formatUSD(result.total ?? base)}`);
}
