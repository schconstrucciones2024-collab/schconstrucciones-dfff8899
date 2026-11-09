import {
  AREA_MAX,
  AREA_MIN,
  SYSTEMS,
  calculateLogistics,
  deckExtra,
  formatUSD,
  getLogisticsZone,
  withExtras,
  type LogisticsSelection,
} from "@/lib/cotizador";
import { BARANDA_PRECIO_ML, DECK_TEXTOS, deckLabel, type DeckConfig } from "./deck";
import type { FinishId } from "./materials";
import { systemOf } from "./systems";

/** Rates per m² come from the existing quote configuration — never duplicated here. */
export const RATES: Record<FinishId, number> = Object.fromEntries(
  [...SYSTEMS.woodframe.categories, ...SYSTEMS.tradicional.categories].map((c) => [c.id, c.price]),
) as Record<FinishId, number>;

export type FoundationId = "hormigon" | "madera" | "platea";
export type RoofId = "una" | "dos" | "plano";

/**
 * Optional adjustments the owner can edit. All in USD, all zero by default.
 * - foundationPerM2: added per m² of the selected foundation.
 * - perExtraFloor: fixed amount for each floor above the ground floor.
 * - roofPerM2: added per m² for the selected roof type.
 * - perExtraOpening: for each opening beyond the suggested default ones.
 */
export const ADJUSTMENTS = {
  foundationPerM2: { hormigon: 0, madera: 0, platea: 0 } as Record<FoundationId, number>,
  perExtraFloor: 0,
  roofPerM2: { una: 0, dos: 0, plano: 0 } as Record<RoofId, number>,
  perExtraOpening: 0,
  perStair: 0,
  perCounter: 0,
  contourPerM2: 0,
};

export const FINISH_NAMES: Record<FinishId, string> = {
  rustica: "RÚSTICA",
  moderna: "MODERNA",
  allwood: "ALLWOOD",
  esencial: "ESENCIAL",
  clasica: "CLÁSICA",
};
export const FOUNDATION_NAMES: Record<FoundationId, string> = {
  hormigon: "pilotes de hormigón",
  madera: "pilotes de madera curada",
  platea: "platea de hormigón",
};
export const ROOF_NAMES: Record<RoofId, string> = {
  una: "Una caída",
  dos: "Doble agua",
  plano: "Plano / liviano",
};
/** En la Clásica el techo plano es la losa de hormigón. */
export const roofName = (roof: RoofId, finish: FinishId): string =>
  finish === "clasica" && roof === "plano" ? "Losa de hormigón" : ROOF_NAMES[roof];

export type PriceInput = {
  m2: number;
  floors: number;
  finish: FinishId;
  foundation: FoundationId;
  roofType: RoofId;
  extraOpenings: number;
  logistics: LogisticsSelection;
  stairsCount?: number;
  countersCount?: number;
  ground?: string;
  roomsCount?: number;
  designLink?: string;
  /** Extra opcional «Deck y techado»: no entra en `configPrice` (el precio de la vivienda no cambia). */
  deck?: DeckConfig;
};

export function configPrice(input: PriceInput) {
  const m2 = Math.max(AREA_MIN, Math.min(AREA_MAX, input.m2));
  const base = m2 * RATES[input.finish];
  const adjustments =
    m2 * ADJUSTMENTS.foundationPerM2[input.foundation] +
    Math.max(0, input.floors - 1) * ADJUSTMENTS.perExtraFloor +
    (m2 / Math.max(1, input.floors)) * ADJUSTMENTS.roofPerM2[input.roofType] +
    Math.max(0, input.extraOpenings) * ADJUSTMENTS.perExtraOpening +
    (input.stairsCount ?? 0) * ADJUSTMENTS.perStair +
    (input.countersCount ?? 0) * ADJUSTMENTS.perCounter +
    m2 * ADJUSTMENTS.contourPerM2;
  const obra = base + adjustments;
  const logistics = calculateLogistics(obra, input.logistics);
  return { base, adjustments, obra, ...logistics };
}

export const CONFIG_WHATSAPP = "https://wa.me/59895564068";

export function configWhatsAppText(input: PriceInput & { openings: number }) {
  const p = configPrice(input);
  const zone = getLogisticsZone(input.logistics.zoneId);
  const floors = `${input.floors} planta${input.floors > 1 ? "s" : ""}`;
  const traditional = systemOf(input.finish) === "tradicional";
  const lines = [
    `Hola SCH Construcciones, configuré ${traditional ? "mi vivienda en construcción tradicional" : "mi cabaña"}: ${Number(input.m2.toFixed(2))} m² · ${floors} · Terminación: ${FINISH_NAMES[input.finish]} · Base: ${FOUNDATION_NAMES[input.foundation]} · Techo: ${roofName(input.roofType, input.finish)} · Aberturas: ${input.openings} · Inversión estimada: ${formatUSD(p.obra)}`,
  ];
  if (zone.id !== "local") {
    lines.push(
      `Zona: ${zone.label} · Logística: ${p.surcharge === null ? "a cotizar aparte" : `${p.percentage}% (${formatUSD(p.surcharge)})`} · Total estimado: ${p.total === null ? "pendiente" : formatUSD(p.total)}`,
    );
  }
  lines.push(
    `Suelo: ${input.ground === "cesped" ? "Suelo firme con césped" : "Suelo de arena"} · Ambientes: ${input.roomsCount ?? 0} · Escaleras: ${input.stairsCount ?? 0} · Mesadas: ${input.countersCount ?? 0}`,
  );
  if (input.deck?.enabled) {
    const extra = deckExtra(input.deck, input.logistics),
      totals = withExtras(p.total, extra),
      parts = [`Extras opcionales (no incluidos en el presupuesto de la vivienda): ${deckLabel(input.deck)}`];
    if (extra.subtotal === null) parts.push(`Deck: ${DECK_TEXTOS.escalonesPrecio}`);
    else {
      parts.push(`${input.deck.roofed ? "Deck techado" : "Deck"}: ${formatUSD(extra.deck ?? 0)}`);
      if (extra.railMl > 0) parts.push(`Barandas: ${extra.railMl} ml × USD ${BARANDA_PRECIO_ML} = ${formatUSD(extra.rails ?? 0)}`);
    }
    if (input.deck.steps) parts.push(`Escalones: ${DECK_TEXTOS.escalonesPrecio}`);
    if (extra.total !== null && extra.percentage > 0) parts.push(`Logística del extra (${extra.percentage}%): ${formatUSD(extra.surcharge ?? 0)}`);
    parts.push(`Total del extra: ${extra.total === null ? "a cotizar" : formatUSD(extra.total)}`);
    parts.push(`Total con extras: ${totals.totalConExtras === null ? "a cotizar" : formatUSD(totals.totalConExtras)}`);
    lines.push(parts.join(" · "), DECK_TEXTOS.letraChica);
  }
  if (input.designLink) lines.push(`Mi diseño: ${input.designLink}`);
  return lines.join("\n");
}

export const configWhatsAppUrl = (input: PriceInput & { openings: number }) =>
  `${CONFIG_WHATSAPP}?text=${encodeURIComponent(configWhatsAppText(input))}`;
