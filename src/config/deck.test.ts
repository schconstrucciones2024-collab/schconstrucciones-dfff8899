import { describe, expect, it } from "vitest";
import {
  DECK_A_COTIZAR,
  DECK_LIMITES,
  DECK_LINEAS,
  DECK_LINES,
  DEFAULT_DECK,
  deckArea,
  deckLabel,
  deckNoIncluye,
  deckPrice,
  deckRailMl,
  deckRates,
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
const esencial = (patch: Partial<DeckConfig> = {}) => deck({ line: "esencial", ...patch });
const premium = (patch: Partial<DeckConfig> = {}) => deck({ line: "premium", ...patch });
const local: LogisticsSelection = { zoneId: "local", separateTrip: false };
const medium: LogisticsSelection = { zoneId: "medium", separateTrip: false };

describe("deck y techado: las dos líneas", () => {
  it("hay dos líneas, Esencial (accesible) y Premium, con los precios del brief", () => {
    expect(DECK_LINES).toEqual(["esencial", "premium"]);
    expect(deckRates("esencial")).toEqual({ deck: 105, techado: 195, baranda: 40 });
    expect(deckRates("premium")).toEqual({ deck: 130, techado: 225, baranda: 50 });
    expect(DECK_LINEAS.esencial.apodo).toBe("Accesible");
    expect(DECK_LINEAS.premium.nombre).toBe("Premium");
  });

  it("cada línea tiene la ficha técnica completa del deck solo, del deck techado y de las barandas", () => {
    for (const l of DECK_LINES) {
      const { specs } = DECK_LINEAS[l];
      expect(specs.deck.items.map((i) => i.label)).toEqual([
        "Estructura y piso",
        "Subestructura",
        "Fijaciones",
        "Acabado",
      ]);
      expect(specs.techado.items.map((i) => i.label)).toEqual([
        "Estructura",
        "Cubierta",
        "Fijaciones",
        "Acabado",
      ]);
      expect(specs.baranda.items.map((i) => i.label)).toEqual(["Diseño", "Fijaciones", "Acabado"]);
    }
    expect(DECK_LINEAS.esencial.specs.deck.items[3]?.text).toBe(
      "Entregado instalado y lijado, listo para pintar (aplicación de protector a cargo del cliente).",
    );
    expect(DECK_LINEAS.premium.specs.techado.items[1]?.text).toContain("canaletas de desagüe pluvial");
    expect(DECK_LINEAS.premium.specs.baranda.items[1]?.text).toBe("Tornillería oculta o de acero inoxidable.");
  });

  it("la línea por defecto es Esencial y un diseño o link viejo, sin línea, queda en Esencial", () => {
    expect(DEFAULT_DECK.line).toBe("esencial");
    expect(normalizeDeck({ enabled: true }).line).toBe("esencial");
    expect(normalizeDeck({ enabled: true, line: "premium" }).line).toBe("premium");
    expect(normalizeDeck({ enabled: true, line: "otra" as never }).line).toBe("esencial");
    // La línea se conserva aunque el deck esté apagado (se elige antes de activarlo).
    expect(normalizeDeck({ enabled: false, line: "premium" }).line).toBe("premium");
  });

  it("lo que no incluye cada línea no contradice su ficha: la Premium sí lleva canaletas y protector", () => {
    expect(deckNoIncluye("esencial").join(" ")).toContain("Canaletas y bajadas de agua");
    expect(deckNoIncluye("esencial").join(" ")).toContain("protector");
    expect(deckNoIncluye("premium").join(" ")).not.toContain("Canaletas");
    expect(deckNoIncluye("premium").join(" ")).not.toContain("protector");
  });
});

describe("deck y techado: precios", () => {
  it("Esencial, deck de 12 m² (4 × 3 m): USD 1.260", () => {
    const q = deckExtra(esencial(), local);
    expect(q.area).toBe(12);
    expect(q.rate).toBe(105);
    expect(q.subtotal).toBe(1260);
    expect(q.total).toBe(1260);
    expect(formatUSD(q.total ?? 0)).toBe("USD 1.260");
  });

  it("Premium, deck de 12 m² (4 × 3 m): USD 1.560", () => {
    const q = deckExtra(premium(), local);
    expect(q.rate).toBe(130);
    expect(q.total).toBe(1560);
    expect(formatUSD(q.total ?? 0)).toBe("USD 1.560");
  });

  it("deck techado de 12 m²: Esencial USD 2.340 y Premium USD 2.700 (el techo ya incluye el deck, no se suman los dos precios)", () => {
    expect(deckExtra(esencial({ roofed: true }), local)).toMatchObject({ rate: 195, total: 2340 });
    expect(deckExtra(premium({ roofed: true }), local)).toMatchObject({ rate: 225, total: 2700 });
  });

  it("deck techado de 12 m² + 7 ml de barandas (frente de 4 m + un lateral de 3 m): Esencial USD 2.620 y Premium USD 3.050", () => {
    const rails = { roofed: true, railFront: true, railLeft: true };
    expect(deckRailMl(esencial(rails))).toBe(7);
    const e = deckExtra(esencial(rails), local),
      p = deckExtra(premium(rails), local);
    expect(e).toMatchObject({ railRate: 40, rails: 280, total: 2620 });
    expect(p).toMatchObject({ railRate: 50, rails: 350, total: 3050 });
  });

  it("el caso anterior con costo logístico del 10 %: Esencial USD 2.882 y Premium USD 3.355", () => {
    const rails = { roofed: true, railFront: true, railRight: true };
    const e = deckExtra(esencial(rails), medium),
      p = deckExtra(premium(rails), medium);
    expect(e.percentage).toBe(10);
    expect(e.surcharge).toBe(262);
    expect(e.total).toBe(2882);
    expect(p.surcharge).toBe(305);
    expect(p.total).toBe(3355);
  });

  it("deck de 9 m² (3 × 3) y deck techado de 20 m² (8 × 2,5), en cada línea", () => {
    expect(deckExtra(esencial({ width: 3, depth: 3 }), local).total).toBe(945);
    expect(deckExtra(premium({ width: 3, depth: 3 }), local).total).toBe(1170);
    const big = { roofed: true, width: 8, depth: 2.5 };
    expect(deckArea(esencial(big))).toBe(20);
    expect(deckExtra(esencial(big), local).total).toBe(3900);
    expect(deckExtra(premium(big), local).total).toBe(4500);
  });

  it("la Premium siempre cuesta más que la Esencial, en deck solo, techado y barandas", () => {
    const e = deckRates("esencial"),
      p = deckRates("premium");
    expect(p.deck).toBeGreaterThan(e.deck);
    expect(p.techado).toBeGreaterThan(e.techado);
    expect(p.baranda).toBeGreaterThan(e.baranda);
  });

  it("los escalones no suman al total", () => {
    expect(deckExtra(esencial({ steps: true }), local).total).toBe(1260);
    expect(deckExtra(premium({ steps: true }), local).total).toBe(1560);
  });

  it("la logística usa la tabla que ya existe en la web: 6 %, 10 %, 15 % y viaje aparte en el último tramo", () => {
    const d = premium();
    expect(deckExtra(d, { zoneId: "near", separateTrip: false }).percentage).toBe(6);
    expect(deckExtra(d, { zoneId: "medium", separateTrip: false }).percentage).toBe(10);
    expect(deckExtra(d, { zoneId: "long", separateTrip: false }).total).toBe(1560 + 234);
    expect(deckExtra(esencial(), { zoneId: "long", separateTrip: false }).total).toBe(1260 + 189);
    const far = deckExtra(d, { zoneId: "far", separateTrip: true });
    expect(far.separateTrip).toBe(true);
    expect(far.total).toBeNull();
    // Lo mismo que le pasa a la vivienda con esos datos.
    expect(calculateLogistics(1560, { zoneId: "far", separateTrip: true }).total).toBeNull();
  });

  it("el precio sin el deck activo no suma nada, pero ya informa la tarifa de la línea elegida", () => {
    const q = deckPrice({ ...DEFAULT_DECK, line: "premium" });
    expect(q.active).toBe(false);
    expect(q.subtotal).toBeNull();
    expect(q.rate).toBe(130);
    expect(q.line).toBe("premium");
  });
});

describe("deck y techado: medidas", () => {
  it("no hay límite de medidas: cualquier frente y profundidad se cotizan (m² × tarifa)", () => {
    expect(deckWithinLimits({ width: 8, depth: 3 })).toBe(true);
    expect(deckWithinLimits({ width: 8.1, depth: 3 })).toBe(true);
    expect(deckWithinLimits({ width: 30, depth: 12 })).toBe(true);
    const q = deckExtra(premium({ width: 9, depth: 3 }), local);
    expect(q.quotable).toBe(true);
    expect(q.total).toBe(Math.round(27 * 130));
    // Un deck grande, techado y con barandas: 30 × 12 = 360 m² + 54 ml.
    const all = {
      width: 30,
      depth: 12,
      roofed: true,
      railFront: true,
      railLeft: true,
      railRight: true,
    };
    expect(deckExtra(esencial(all), local).total).toBe(360 * 195 + 54 * 40);
    expect(deckExtra(premium(all), local).total).toBe(360 * 225 + 54 * 50);
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
    const q = deckExtra(premium({ roofed: true }), local);
    expect(withExtras(42500, q)).toEqual({ vivienda: 42500, extras: 2700, totalConExtras: 45200 });
    const e = deckExtra(esencial({ roofed: true }), local);
    expect(withExtras(42500, e)).toEqual({ vivienda: 42500, extras: 2340, totalConExtras: 44840 });
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

  it("la etiqueta del deck dice la línea", () => {
    expect(deckLabel(esencial())).toBe("Deck línea Esencial de 4 × 3 m (12 m²)");
    expect(deckLabel(premium({ roofed: true, railFront: true, steps: true }))).toBe(
      "Deck techado línea Premium de 4 × 3 m (12 m²) con baranda en frente y escalones",
    );
  });

  it("el texto copiable separa los extras, dice la línea y no cambia si el deck está apagado", () => {
    const sin = buildSummary(areas, local, "woodframe", "rustica");
    expect(buildSummary(areas, local, "woodframe", "rustica", DEFAULT_DECK)).toBe(sin);
    // Apagado el deck, la línea elegida tampoco cambia el texto.
    expect(buildSummary(areas, local, "woodframe", "rustica", { ...DEFAULT_DECK, line: "premium" })).toBe(sin);
    const con = buildSummary(
      areas,
      medium,
      "woodframe",
      "rustica",
      premium({ roofed: true, railFront: true, railLeft: true, steps: true }),
    );
    expect(con).toContain("Extras opcionales (no incluidos en el presupuesto de la vivienda)");
    expect(con).toContain("Deck techado línea Premium de 4 × 3 m");
    expect(con).toContain("Deck techado Premium: 12 m² × USD 225/m² = USD 2.700");
    expect(con).toContain("Barandas Premium: 7 ml × USD 50/ml = USD 350");
    expect(con).toContain("Escalones: A cotizar");
    expect(con).toContain("Costo logístico extra (10%): USD 305");
    expect(con).toContain("Total del extra: USD 3.355");
    // Vivienda Rústica: 50 m² × 850 = 42.500, +10 % = 46.750; más el extra 3.355.
    expect(con).toContain("Total con extras: USD 50.105");
    expect(con).toContain("Precio estimado en dólares, sujeto a visita y medidas finales.");

    const ess = buildSummary(
      areas,
      medium,
      "woodframe",
      "rustica",
      esencial({ roofed: true, railFront: true, railLeft: true }),
    );
    expect(ess).toContain("Deck techado Esencial: 12 m² × USD 195/m² = USD 2.340");
    expect(ess).toContain("Barandas Esencial: 7 ml × USD 40/ml = USD 280");
    expect(ess).toContain("Total del extra: USD 2.882");
    expect(ess).toContain("Total con extras: USD 49.632");
  });
});
