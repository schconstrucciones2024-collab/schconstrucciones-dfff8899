import {
  AREA_MAX,
  AREA_MIN,
  SYSTEMS,
  calculateLogistics,
  deckExtra,
  formatUSD,
  getLogisticsZone,
  paintColorLines,
  paintCounts,
  paintExtra,
  paintQuoteLines,
  rateFor,
  volumeBonus,
  withExtras,
  type LogisticsSelection,
} from "@/lib/cotizador";
import { TRADICIONAL_TEXTOS } from "./tradicional";
import { DECK_TEXTOS, DEFAULT_DECK, deckLabel, deckLineName, type DeckConfig } from "./deck";
import { PAINT_TEXTOS, coatsLabel, paintIsActive, type PaintConfig, type PaintSurfaces } from "./paint";
import type { FinishId } from "./materials";
import { systemOf } from "./systems";

/** Rates per m² come from the existing quote configuration — never duplicated here. */
export const RATES: Record<FinishId, number> = Object.fromEntries(
  [...SYSTEMS.woodframe.categories, ...SYSTEMS.tradicional.categories].map((c) => [c.id, c.price]),
) as Record<FinishId, number>;

/** m² que se cobran en el diseñador: entre el mínimo y el máximo del cotizador. */
const clampM2 = (m2: number) => Math.max(AREA_MIN, Math.min(AREA_MAX, m2));

/**
 * Precio por m² de una terminación para esa superficie: la tarifa base, o la bonificada en tradicional
 * (1.200 → 1.140 desde 65 m² → 1.104 desde 90 m²). Es lo que muestra el panel y lo que cobra `configPrice`.
 */
export const configRate = (finish: FinishId, m2: number): number => rateFor(finish, RATES[finish], clampM2(m2));

/** La bonificación por superficie del diseño (5% desde 65 m², 8% desde 90 m²), o null si no aplica. */
export const configBonus = (finish: FinishId, m2: number) => volumeBonus({ id: finish, price: RATES[finish] }, clampM2(m2));

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
  /** Extra opcional «Pintura» y los m² de pared medidos sobre el diseño: tampoco entra en `configPrice`. */
  paint?: PaintConfig;
  paintSurfaces?: PaintSurfaces;
};

/**
 * Precio de la vivienda en el diseñador 3D. Usa las mismas tarifas y la misma regla de descuento por superficie que el
 * cotizador (`rateFor` / `volumeBonus` de `lib/cotizador.ts`): con la misma superficie y terminación dan el mismo valor.
 */
export function configPrice(input: PriceInput) {
  const m2 = clampM2(input.m2);
  const rate = configRate(input.finish, m2),
    bonus = configBonus(input.finish, m2),
    base = m2 * rate;
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
  return { base, rate, baseRate: RATES[input.finish], bonus, adjustments, obra, ...logistics };
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
  if (p.bonus) {
    lines.push(`${TRADICIONAL_TEXTOS.bonificacion(p.bonus.discount)} ${TRADICIONAL_TEXTOS.precioEfectivo}: ${formatUSD(p.bonus.rate)}/m² (${TRADICIONAL_TEXTOS.tarifaBase} ${formatUSD(p.bonus.baseRate)}/m²)`);
  }
  lines.push(
    `Suelo: ${input.ground === "cesped" ? "Suelo firme con césped" : "Suelo de arena"} · Ambientes: ${input.roomsCount ?? 0} · Escaleras: ${input.stairsCount ?? 0} · Mesadas: ${input.countersCount ?? 0}`,
  );
  if (traditional) lines.push(TRADICIONAL_TEXTOS.exclusiones);
  const deckOn = !!input.deck?.enabled,
    paintOn = !!input.paint && paintIsActive(input.paint);
  if (deckOn || paintOn) {
    const deck = input.deck ?? DEFAULT_DECK,
      extra = deckExtra(deck, input.logistics),
      pq = paintOn && input.paint ? paintExtra(input.paint, input.finish, input.paintSurfaces ?? { interior: 0, exterior: 0 }, input.logistics) : undefined,
      totals = withExtras(p.total, extra, pq),
      head = "Extras opcionales (no incluidos en el presupuesto de la vivienda)",
      parts = [deckOn ? `${head}: ${deckLabel(deck)}` : head];
    if (deckOn) {
      if (extra.subtotal === null) parts.push(`Deck: ${DECK_TEXTOS.escalonesPrecio}`);
      else {
        parts.push(`${deck.roofed ? "Deck techado" : "Deck"} ${deckLineName(deck.line)}: ${formatUSD(extra.deck ?? 0)}`);
        if (extra.railMl > 0) parts.push(`Barandas ${deckLineName(deck.line)}: ${extra.railMl} ml × USD ${extra.railRate} = ${formatUSD(extra.rails ?? 0)}`);
      }
      if (deck.steps) parts.push(`Escalones: ${DECK_TEXTOS.escalonesPrecio}`);
    }
    if (pq && input.paint) {
      parts.push(`Pintura (${coatsLabel(pq.coats)}, mano de obra y materiales incluidos)`, ...paintQuoteLines(pq), ...paintColorLines(input.paint, [input.finish]));
      if (pq.pending) parts.push("La pintura de revoque se presupuesta aparte y no está sumada");
    }
    const logisticsShare = (deckOn ? extra.surcharge ?? 0 : 0) + (pq && paintCounts(pq) ? pq.surcharge ?? 0 : 0),
      percentage = deckOn ? extra.percentage : pq?.percentage ?? 0;
    if (totals.extras !== null && percentage > 0) parts.push(`Logística del extra (${percentage}%): ${formatUSD(logisticsShare)}`);
    parts.push(`Total del extra: ${totals.extras === null ? "a cotizar" : formatUSD(totals.extras)}`);
    parts.push(`Total con extras: ${totals.totalConExtras === null ? "a cotizar" : formatUSD(totals.totalConExtras)}`);
    lines.push(parts.join(" · "), paintOn ? PAINT_TEXTOS.letraChica : DECK_TEXTOS.letraChica);
  }
  if (input.designLink) lines.push(`Mi diseño: ${input.designLink}`);
  return lines.join("\n");
}

export const configWhatsAppUrl = (input: PriceInput & { openings: number }) =>
  `${CONFIG_WHATSAPP}?text=${encodeURIComponent(configWhatsAppText(input))}`;
