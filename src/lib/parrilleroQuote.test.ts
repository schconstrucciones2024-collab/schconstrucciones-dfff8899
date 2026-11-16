import { describe, expect, it } from "vitest";
import { EXTRA_CARDS } from "@/config/extras";
import { configPrice, configWhatsAppText } from "@/config/pricing";
import { DEFAULT_DECK } from "@/config/deck";
import {
  DEFAULT_PARRILLERO,
  PARRILLERO_PRECIOS,
  formatUSDRef,
  formatUYU,
  parrilleroSummaryLines,
  type ParrilleroConfig,
} from "@/config/parrillero";
import {
  DEFAULT_LOGISTICS,
  buildSummary,
  buildWhatsAppUrl,
  createAreas,
  deckExtra,
  parrilleroExtra,
  parrilleroQuoteLines,
  withExtras,
} from "./cotizador";

const on = (patch: Partial<ParrilleroConfig> = {}): ParrilleroConfig => ({ ...DEFAULT_PARRILLERO, enabled: true, ...patch });
const areas = createAreas();

describe("parrillero · precios fijos", () => {
  it("las dos terminaciones tienen el precio pedido, en pesos y con su referencia en dólares", () => {
    expect(PARRILLERO_PRECIOS.ladrillo).toEqual({ uyu: 108000, usd: 2665 });
    expect(PARRILLERO_PRECIOS.revoque).toEqual({ uyu: 122000, usd: 3010 });
    expect(formatUYU(108000)).toBe("$U 108.000");
    expect(formatUYU(122000)).toBe("$U 122.000");
    expect(formatUSDRef(2665)).toBe("USD 2.665");
    expect(formatUSDRef(3010)).toBe("USD 3.010");
  });

  it("la tarjeta de Extras figura junto al deck y a la pintura, con el «desde» más bajo", () => {
    expect(EXTRA_CARDS.map((c) => c.id)).toEqual(["deck", "pintura", "parrillero"]);
    const card = EXTRA_CARDS.find((c) => c.id === "parrillero");
    expect(card?.titulo).toBe("Parrilleros SCH");
    expect(card?.desde).toBe("Desde $U 108.000 (ref. USD 2.665)");
  });
});

describe("parrillero · cotización", () => {
  it("en Punta del Diablo el total del extra es el precio fijo, sin logística", () => {
    const l = parrilleroExtra(on({ finish: "ladrillo" }), DEFAULT_LOGISTICS);
    expect(l).toMatchObject({ active: true, uyu: 108000, usd: 2665, surcharge: 0, total: 2665, totalUyu: 108000, separateTrip: false });
    const r = parrilleroExtra(on({ finish: "revoque" }), DEFAULT_LOGISTICS);
    expect(r).toMatchObject({ uyu: 122000, usd: 3010, total: 3010, totalUyu: 122000 });
  });

  it("fuera de la zona se aplica el porcentaje logístico, como al deck y a la pintura", () => {
    const q = parrilleroExtra(on({ finish: "ladrillo" }), { zoneId: "long", separateTrip: false });
    expect(q.percentage).toBe(15);
    expect(q.surcharge).toBe(Math.round(2665 * 0.15));
    expect(q.total).toBe(2665 + Math.round(2665 * 0.15));
    expect(q.totalUyu).toBe(Math.round(108000 * 1.15));
    const trip = parrilleroExtra(on(), { zoneId: "far", separateTrip: true });
    expect(trip.separateTrip).toBe(true);
    expect(trip.total).toBeNull();
    expect(trip.totalUyu).toBeNull();
  });

  it("no cambia el precio de la vivienda y no se suma si está apagado", () => {
    const off = parrilleroExtra(DEFAULT_PARRILLERO, DEFAULT_LOGISTICS);
    expect(off.active).toBe(false);
    const dq = deckExtra(DEFAULT_DECK, DEFAULT_LOGISTICS);
    const sin = withExtras(50000, dq, undefined, off);
    expect(sin).toEqual({ vivienda: 50000, extras: 0, totalConExtras: 50000 });
    const con = withExtras(50000, dq, undefined, parrilleroExtra(on(), DEFAULT_LOGISTICS));
    expect(con).toEqual({ vivienda: 50000, extras: 2665, totalConExtras: 52665 });
  });

  it("cambiar la terminación reemplaza el precio: nunca se cobra dos veces", () => {
    const a = withExtras(10000, deckExtra(DEFAULT_DECK, DEFAULT_LOGISTICS), undefined, parrilleroExtra(on({ finish: "ladrillo" }), DEFAULT_LOGISTICS));
    const b = withExtras(10000, deckExtra(DEFAULT_DECK, DEFAULT_LOGISTICS), undefined, parrilleroExtra(on({ finish: "revoque" }), DEFAULT_LOGISTICS));
    expect(a.extras).toBe(2665);
    expect(b.extras).toBe(3010);
    // Ubicación y mesada son del diseño: no cuestan nada más.
    const c = withExtras(10000, deckExtra(DEFAULT_DECK, DEFAULT_LOGISTICS), undefined, parrilleroExtra(on({ finish: "revoque", side: "derecho", sink: false }), DEFAULT_LOGISTICS));
    expect(c.extras).toBe(3010);
  });

  it("se suma al deck sin pisarlo", () => {
    const deck = { ...DEFAULT_DECK, enabled: true };
    const dq = deckExtra(deck, DEFAULT_LOGISTICS);
    const solo = withExtras(80000, dq);
    const ambos = withExtras(80000, dq, undefined, parrilleroExtra(on(), DEFAULT_LOGISTICS));
    expect(ambos.extras).toBe((solo.extras ?? 0) + 2665);
  });
});

describe("parrillero · resumen y WhatsApp", () => {
  it("el resumen lleva nombre, terminación, ubicación, mesada y precio en pesos con su referencia", () => {
    const lines = parrilleroSummaryLines(on({ finish: "revoque", side: "derecho" }));
    expect(lines).toEqual([
      "PARRILLERO SCH",
      "Terminación: Revoque fino",
      "Ubicación: Lateral derecho",
      "Mesada con bacha integrada",
      "Precio: $U 122.000 (ref. USD 3.010)",
    ]);
    expect(parrilleroSummaryLines(on({ sink: false }))).not.toContain("Mesada con bacha integrada");
  });

  it("el resumen del cotizador lo incluye solo si está agregado", () => {
    const con = buildSummary(areas, DEFAULT_LOGISTICS, "woodframe", undefined, undefined, undefined, on());
    expect(con).toContain("PARRILLERO SCH");
    expect(con).toContain("Terminación: Ladrillo visto");
    expect(con).toContain("Ubicación: Lateral izquierdo");
    expect(con).toContain("$U 108.000");
    expect(con).toContain("USD 2.665");
    expect(con).toContain("no incluidos en el presupuesto de la vivienda");
    const sin = buildSummary(areas, DEFAULT_LOGISTICS, "woodframe", undefined, undefined, undefined, DEFAULT_PARRILLERO);
    expect(sin).not.toContain("PARRILLERO");
    expect(sin).not.toContain("$U");
    expect(buildSummary(areas, DEFAULT_LOGISTICS, "woodframe")).toBe(sin);
  });

  it("con logística, el resumen muestra el recargo; con viaje aparte, deja el total pendiente", () => {
    const lines = parrilleroQuoteLines(on(), { zoneId: "medium", separateTrip: false }).join("\n");
    expect(lines).toContain("Costo logístico extra (10%)");
    const trip = parrilleroQuoteLines(on(), { zoneId: "far", separateTrip: true }).join("\n");
    expect(trip).toContain("Viaje a cotizar aparte");
  });

  it("el link de WhatsApp lleva el parrillero", () => {
    const url = buildWhatsAppUrl(areas, DEFAULT_LOGISTICS, "woodframe", undefined, undefined, undefined, on({ finish: "revoque" }));
    const text = decodeURIComponent(url.split("?text=")[1] ?? "");
    expect(text).toContain("PARRILLERO SCH");
    expect(text).toContain("Revoque fino");
    expect(text).toContain("$U 122.000");
    const off = buildWhatsAppUrl(areas, DEFAULT_LOGISTICS, "woodframe");
    expect(decodeURIComponent(off)).not.toContain("PARRILLERO");
  });

  it("el diseñador: el texto de WhatsApp incluye el parrillero y el precio de la vivienda no cambia", () => {
    const base = {
      m2: 60,
      finish: "rustica" as const,
      foundation: "pilotes" as const,
      roofType: "dos" as const,
      floors: 1,
      logistics: DEFAULT_LOGISTICS,
      openings: 4,
      extraOpenings: 0,
      roomsCount: 3,
      stairsCount: 0,
      countersCount: 0,
    };
    const input = base as unknown as Parameters<typeof configPrice>[0];
    const sin = configPrice(input);
    const con = configPrice({ ...input, parrillero: on() });
    expect(con.total).toBe(sin.total);
    const text = configWhatsAppText({ ...input, openings: 4, parrillero: on({ side: "derecho" }) } as never);
    expect(text).toContain("PARRILLERO SCH");
    expect(text).toContain("Lateral derecho");
    expect(text).toContain("Total con extras");
    const textoSin = configWhatsAppText({ ...input, openings: 4 } as never);
    expect(textoSin).not.toContain("PARRILLERO");
  });
});
