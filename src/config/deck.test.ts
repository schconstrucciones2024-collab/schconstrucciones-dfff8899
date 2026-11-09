import { describe, expect, it } from "vitest";
import {
  BARANDA_PRECIO_ML,
  DECK_A_COTIZAR,
  DECK_LIMITES,
  DECK_PRECIO_M2,
  DECK_TECHADO_PRECIO_M2,
  DEFAULT_DECK,
  deckArea,
  deckPrice,
  deckRailMl,
  deckWithinLimits,
  normalizeDeck,
  type DeckConfig,
} from "./deck";
import {
  buildSummary,
  calculateLogistics,
  deckExtra,
  formatUSD,
  withExtras,
  type LogisticsSelection,
} from "@/lib/cotizador";

const deck = (patch: Partial<DeckConfig>): DeckConfig =>
  normalizeDeck({ ...DEFAULT_DECK, enabled: true, ...patch });
const local: LogisticsSelection = { zoneId: "local", separateTrip: false };
const medium: LogisticsSelection = { zoneId: "medium", separateTrip: false };

describe("deck y techado: precios", () => {
  it("las constantes son las del brief", () => {
    expect(DECK_PRECIO_M2).toBe(130);
    expect(DECK_TECHADO_PRECIO_M2).toBe(250);
    expect(BARANDA_PRECIO_ML).toBe(50);
  });

  it("deck de 12 m² (4 × 3 m): USD 1.560", () => {
    const q = deckExtra(deck({}), local);
    expect(q.area).toBe(12);
    expect(q.subtotal).toBe(1560);
    expect(q.total).toBe(1560);
    expect(formatUSD(q.total ?? 0)).toBe("USD 1.560");
  });

  it("deck techado de 12 m²: USD 3.000 (el techo ya incluye el deck, no se suman los dos precios)", () => {
    const q = deckExtra(deck({ roofed: true }), local);
    expect(q.rate).toBe(250);
    expect(q.total).toBe(3000);
  });

  it("deck techado de 12 m² + 7 ml de barandas (frente de 4 m + un lateral de 3 m): USD 3.350", () => {
    const d = deck({ roofed: true, railFront: true, railLeft: true });
    expect(deckRailMl(d)).toBe(7);
    expect(deckExtra(d, local).total).toBe(3350);
  });

  it("el caso anterior con costo logístico del 10 %: USD 3.685", () => {
    const d = deck({ roofed: true, railFront: true, railRight: true });
    const q = deckExtra(d, medium);
    expect(q.percentage).toBe(10);
    expect(q.surcharge).toBe(335);
    expect(q.total).toBe(3685);
  });

  it("deck de 9 m² (3 × 3): USD 1.170 y deck techado de 20 m² (8 × 2,5): USD 5.000", () => {
    expect(deckExtra(deck({ width: 3, depth: 3 }), local).total).toBe(1170);
    const big = deck({ roofed: true, width: 8, depth: 2.5 });
    expect(deckArea(big)).toBe(20);
    expect(deckExtra(big, local).total).toBe(5000);
  });

  it("los escalones no suman al total", () => {
    expect(deckExtra(deck({ steps: true }), local).total).toBe(1560);
  });

  it("la logística usa la tabla que ya existe en la web: 6 %, 10 %, 15 % y viaje aparte en el último tramo", () => {
    const d = deck({});
    expect(deckExtra(d, { zoneId: "near", separateTrip: false }).percentage).toBe(6);
    expect(deckExtra(d, { zoneId: "medium", separateTrip: false }).percentage).toBe(10);
    expect(deckExtra(d, { zoneId: "long", separateTrip: false }).total).toBe(1560 + 234);
    const far = deckExtra(d, { zoneId: "far", separateTrip: true });
    expect(far.separateTrip).toBe(true);
    expect(far.total).toBeNull();
    // Lo mismo que le pasa a la vivienda con esos datos.
    expect(calculateLogistics(1560, { zoneId: "far", separateTrip: true }).total).toBeNull();
  });
});

describe("deck y techado: medidas", () => {
  it("no hay límite de medidas: cualquier frente y profundidad se cotizan (m² × tarifa)", () => {
    expect(deckWithinLimits({ width: 8, depth: 3 })).toBe(true);
    expect(deckWithinLimits({ width: 8.1, depth: 3 })).toBe(true);
    expect(deckWithinLimits({ width: 30, depth: 12 })).toBe(true);
    const q = deckExtra(deck({ width: 9, depth: 3 }), local);
    expect(q.quotable).toBe(true);
    expect(q.total).toBe(Math.round(27 * 130));
    // Un deck grande, techado y con barandas: 30 × 12 = 360 m² × 250 + 54 ml × 50.
    const big = deckExtra(
      deck({
        width: 30,
        depth: 12,
        roofed: true,
        railFront: true,
        railLeft: true,
        railRight: true,
      }),
      local,
    );
    expect(big.total).toBe(360 * 250 + 54 * 50);
    expect(DECK_A_COTIZAR).toBe("A cotizar");
  });

  it("el límite de cotización sigue siendo configurable: con números finitos, lo que se pasa es «A cotizar»", () => {
    // En DECK_LIMITES hoy es Infinity; la regla se conserva por si SCH quiere volver a exigir presupuesto a medida.
    expect(DECK_LIMITES.frenteMax).toBe(Infinity);
    expect(DECK_LIMITES.profundidadMax).toBe(Infinity);
  });

  it("las barandas salen de las medidas: frente = ancho, laterales = profundidad", () => {
    expect(deckRailMl(deck({ width: 5, depth: 2.5, railFront: true }))).toBe(5);
    expect(deckRailMl(deck({ width: 5, depth: 2.5, railLeft: true, railRight: true }))).toBe(5);
    expect(
      deckRailMl(deck({ width: 5, depth: 2.5, railFront: true, railLeft: true, railRight: true })),
    ).toBe(10);
  });

  it("arranca apagado, de 4 × 3 m (donde no hay diseño) y cubriendo todo el frente donde lo hay", () => {
    expect(DEFAULT_DECK.enabled).toBe(false);
    expect(DEFAULT_DECK.fullFront).toBe(true);
    expect(normalizeDeck({ enabled: true, fullFront: false }).fullFront).toBe(false);
    expect(normalizeDeck({ enabled: true }).fullFront).toBe(true);
    expect([DEFAULT_DECK.width, DEFAULT_DECK.depth]).toEqual([4, 3]);
    expect(deckPrice(DEFAULT_DECK).subtotal).toBeNull();
    expect(deckExtra(DEFAULT_DECK, medium).total).toBeNull();
  });

  it("si se apaga el deck se apaga el techo", () => {
    expect(normalizeDeck({ enabled: false, roofed: true }).roofed).toBe(false);
    expect(normalizeDeck({ enabled: true, roofed: true }).roofed).toBe(true);
  });

  it("normaliza basura sin romper: números inválidos, topes y diseños viejos sin deck", () => {
    expect(normalizeDeck(undefined)).toEqual(DEFAULT_DECK);
    expect(normalizeDeck({ enabled: true, width: Number.NaN, depth: -4 }).width).toBe(4);
    expect(normalizeDeck({ enabled: true, width: Number.NaN, depth: -4 }).depth).toBe(
      DECK_LIMITES.profundidadMin,
    );
    expect(normalizeDeck({ width: 500, depth: 500 })).toMatchObject({
      width: DECK_LIMITES.frenteTope,
      depth: DECK_LIMITES.profundidadTope,
    });
    expect(normalizeDeck({ width: 3.14159 }).width).toBe(3.1);
  });
});

describe("deck y techado: resumen", () => {
  const areas = { rustica: 50, moderna: 50, allwood: 50, esencial: 50, clasica: 50 };

  it("el total de la vivienda no cambia: se suman tres líneas", () => {
    const q = deckExtra(deck({ roofed: true }), local);
    expect(withExtras(42500, q)).toEqual({ vivienda: 42500, extras: 3000, totalConExtras: 45500 });
    expect(withExtras(42500, deckExtra(DEFAULT_DECK, local))).toEqual({
      vivienda: 42500,
      extras: 0,
      totalConExtras: 42500,
    });
  });

  it("con viaje aparte el total con extras queda pendiente", () => {
    const q = deckExtra(deck({}), { zoneId: "far", separateTrip: true });
    expect(withExtras(null, q).totalConExtras).toBeNull();
  });

  it("el texto copiable separa los extras y no cambia si el deck está apagado", () => {
    const sin = buildSummary(areas, local, "woodframe", "rustica");
    expect(buildSummary(areas, local, "woodframe", "rustica", DEFAULT_DECK)).toBe(sin);
    const con = buildSummary(
      areas,
      medium,
      "woodframe",
      "rustica",
      deck({ roofed: true, railFront: true, railLeft: true, steps: true }),
    );
    expect(con).toContain("Extras opcionales (no incluidos en el presupuesto de la vivienda)");
    expect(con).toContain("Deck techado: 12 m² × USD 250/m² = USD 3.000");
    expect(con).toContain("Barandas: 7 ml × USD 50/ml = USD 350");
    expect(con).toContain("Escalones: A cotizar");
    expect(con).toContain("Costo logístico extra (10%): USD 335");
    expect(con).toContain("Total del extra: USD 3.685");
    // Vivienda Rústica: 50 m² × 850 = 42.500, +10 % = 46.750; más el extra 3.685.
    expect(con).toContain("Total con extras: USD 50.435");
    expect(con).toContain("Precio estimado en dólares, sujeto a visita y medidas finales.");
  });
});
