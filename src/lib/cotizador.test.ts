import { describe, expect, it } from "vitest";
import { CATEGORIES, SYSTEMS, EXTERIOR_REVESTIMIENTO, LOGISTICS_ZONES, buildSummary, buildWhatsAppUrl, calculateLogistics, clampArea, createAreas, updateAreas, estimate, estimateFor, formatUSD, nextBonusHint, rateFor, volumeBonus } from "./cotizador";
import { TRADICIONAL_TEXTOS, VOLUME_TIERS, volumeDiscount, volumeTierRows } from "@/config/tradicional";


const price = (id: string) => {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Categoría inexistente: ${id}`);
  return category.price;
};

describe("cotizador", () => {
  it("tarifas oficiales", () => {
    expect(CATEGORIES.map((c) => c.price)).toEqual([850, 900, 990]);
  });
  it.each([
    [40, "USD 34.000", "USD 36.000", "USD 39.600"],
    [65, "USD 55.250", "USD 58.500", "USD 64.350"],
    [100, "USD 85.000", "USD 90.000", "USD 99.000"],
  ])("%i m²", (a, r, m, w) => {
    expect(formatUSD(estimate(a, price("rustica")))).toBe(r);
    expect(formatUSD(estimate(a, price("moderna")))).toBe(m);
    expect(formatUSD(estimate(a, price("allwood")))).toBe(w);
  });
  it("límites 10–500 m²", () => {
    expect(clampArea(5)).toBe(10);
    expect(clampArea(250)).toBe(250);
    expect(clampArea(500)).toBe(500);
    expect(clampArea(900)).toBe(500);
    expect(clampArea("abc")).toBe(40);
    expect(clampArea(-3)).toBe(10);
  });
  it("resumen con valores actuales", () => {
    const s = buildSummary({ rustica: 65, moderna: 40, allwood: 100 });
    expect(s).toContain("Superficie: 65 m²\nPrecio: USD 850/m²\nInversión estimada: USD 55.250");
    expect(s).toContain("Inversión estimada: USD 99.000");
  });
  it("revestimientos interiores de cada categoría", () => {
    const interior = (id: string) => CATEGORIES.find((c) => c.id === id)?.interior;
    expect(interior("rustica")).toBe(
      "Pared y cielorraso de chapones cepillados de primera de eucalipto/pino. Piso de tablas machimbradas curadas/tratadas de pino de primera. Baños con piso de cerámica antideslizante y paredes de cerámica.",
    );
    expect(interior("moderna")).toBe(
      "Pared y cielorraso de drywall (yeso). Piso de tablas machimbradas curadas/tratadas de pino de primera. Baños con piso de cerámica antideslizante y paredes de cerámica.",
    );
    expect(interior("allwood")).toBe(
      "Pared de tablas machimbradas de madera de pino curadas/tratadas de primera. Cielorraso de lambriz de pino de primera. Piso de tablas machimbradas de pino curadas/tratadas de primera. Baños con piso de cerámica antideslizante y paredes de cerámica.",
    );
  });
  it("exterior de siding en las tres categorías", () => {
    expect(EXTERIOR_REVESTIMIENTO).toContain("siding");
    expect(buildSummary({ rustica: 40, moderna: 40, allwood: 40 })).toContain("Revestimiento exterior: siding");
  });

});

describe("logística", () => {
  it.each([
    ["near", 6, 6], ["medium", 10, 10], ["long", 15, 15], ["far", 19, 19],
  ] as const)("tramo %s con sus porcentajes oficiales", (zoneId, min, max) => {
    expect(LOGISTICS_ZONES.find((zone) => zone.id === zoneId)).toMatchObject({ min, max });
  });
  it.each([
    ["near", 6], ["medium", 10], ["long", 15], ["far", 19],
  ] as const)("aplica el porcentaje fijo de %s", (zoneId, expected) => {
    expect(calculateLogistics(32000, { zoneId, separateTrip: false }).percentage).toBe(expected);
  });
  it("no agrega logística en Punta del Diablo", () => {
    expect(calculateLogistics(32000, { zoneId: "local", separateTrip: true })).toMatchObject({ percentage: 0, surcharge: 0, total: 32000, separateTrip: false });
  });
  it("aplica el porcentaje al valor de la obra sin alterar tarifas", () => {
    expect(calculateLogistics(estimate(40, price("rustica")), { zoneId: "medium", separateTrip: false })).toMatchObject({ percentage: 10, surcharge: 3400, total: 37400 });
    expect(price("rustica")).toBe(850);
  });
  it("permite cotizar el viaje aparte solo a más de 300 km", () => {
    expect(calculateLogistics(32000, { zoneId: "far", separateTrip: true })).toMatchObject({ surcharge: null, total: null, separateTrip: true });
    expect(calculateLogistics(32000, { zoneId: "near", separateTrip: true })).toMatchObject({ surcharge: 1920, total: 33920, separateTrip: false });
  });
  it("incluye el desglose actual en el resumen", () => {
    expect(buildSummary({ rustica: 40, moderna: 40, allwood: 40 }, { zoneId: "medium", separateTrip: false })).toContain("Costo logístico extra (10%): USD 3.400\nTotal estimado con logística: USD 37.400");
    expect(buildSummary({ rustica: 40, moderna: 40, allwood: 40 }, { zoneId: "far", separateTrip: true })).toContain("Total final pendiente de cotización logística.");
  });
});

describe("sistemas compartidos", () => {
  it("tradicional tiene tarifas base 1200 (techo liviano) y 1400 (losa)", () => {
    expect(SYSTEMS.tradicional.categories.map((c) => c.price)).toEqual([1200, 1400]);
  });
  it.each([[0, 48000], [1, 56000]])("tradicional categoría %i a 40 m² en Punta del Diablo", (index, base) => {
    const category = SYSTEMS.tradicional.categories[index];
    expect(category).toBeDefined();
    expect(calculateLogistics(estimate(40, category?.price ?? 0), { zoneId: "local", separateTrip: false })).toMatchObject({ surcharge: 0, total: base });
  });
  it("Esencial 40 m² al 10% suma 4800 y totaliza 52800", () => {
    expect(calculateLogistics(48000, { zoneId: "medium", separateTrip: false })).toMatchObject({ surcharge: 4800, total: 52800 });
  });
  it("un cambio de porcentaje se refleja en ambos sistemas y mensajes", () => {
    const zone = LOGISTICS_ZONES.find((z) => z.id === "medium");
    if (!zone) throw new Error("Falta zona");
    const original = zone.max;
    try {
      Object.assign(zone, { max: 12 });
      const selection = { zoneId: "medium", separateTrip: false } as const;
      expect(calculateLogistics(34000, selection).surcharge).toBe(4080);
      expect(calculateLogistics(48000, selection).total).toBe(53760);
      expect(buildSummary(createAreas(), selection, "tradicional")).toContain("Costo logístico extra (12%): USD 5.760");
      expect(decodeURIComponent(buildWhatsAppUrl(createAreas(), selection, "woodframe"))).toContain("Costo logístico extra (12%): USD 4.080");
    } finally { Object.assign(zone, { max: original }); }
  });
  it("superficies independientes y sincronización aislada por sistema", () => {
    const initial = createAreas();
    const wood = updateAreas(initial, "woodframe", "rustica", 65, false);
    expect(wood).toMatchObject({ rustica: 65, moderna: 40, allwood: 40 });
    const traditional = updateAreas(wood, "tradicional", "esencial", 100, true);
    expect(traditional).toEqual({ rustica: 65, moderna: 40, allwood: 40, esencial: 100, clasica: 100 });
    expect(updateAreas(traditional, "tradicional", "clasica", 999, false).clasica).toBe(500);
  });
  it("tradicional incluye platea, estructura, instalaciones completas (UTE y primera cámara), terminaciones y operativa local", () => {
    const included = SYSTEMS.tradicional.included.join("\n");
    expect(SYSTEMS.tradicional.included).toHaveLength(5);
    expect(included).toContain("Platea de hormigón armado ejecutada in situ");
    expect(included).toContain("En opción Techo Liviano: estructura de madera 100% curada");
    expect(included).toContain("En opción Losa: estructura portante reforzada");
    expect(included).toContain("firma de UTE");
    expect(included).toContain("hasta la primera cámara sanitaria");
    expect(included).toContain("Aberturas completas y mesadas principales de cocina y baño");
    expect(included).toContain("sin sorpresas por fletes externos ni alquiler de maquinaria pesada");
    expect(SYSTEMS.woodframe.categories).toBe(CATEGORIES);
    expect(SYSTEMS.woodframe.excluded).toContain("Pintura.");
  });
  it("copia individual y WhatsApp usan el mismo desglose del sistema activo", () => {
    const selection = { zoneId: "medium", separateTrip: false } as const;
    const summary = buildSummary(createAreas(), selection, "tradicional", "esencial");
    expect(summary).toContain("Sistema: Construcción tradicional");
    expect(summary).toContain("Obra base: USD 48.000");
    expect(summary).toContain("Zona logística: 50–150 km (Rocha, La Paloma)");
    expect(summary).toContain("Costo logístico extra (10%): USD 4.800\nTotal estimado con logística: USD 52.800");
    expect(summary).toContain(TRADICIONAL_TEXTOS.exclusiones);
    expect(summary).not.toContain("Bonificación por superficie");
    expect(summary).not.toContain("CLÁSICA");
    expect(summary).not.toContain("siding");
    const url = new URL(buildWhatsAppUrl(createAreas(), selection, "tradicional", "esencial"));
    expect(url.pathname).toBe("/59895564068");
    expect(url.searchParams.get("text")).toBe(summary);
  });
});

describe("construcción tradicional: descuento por superficie", () => {
  const [esencial, clasica] = SYSTEMS.tradicional.categories as [(typeof CATEGORIES)[number], (typeof CATEGORIES)[number]];
  it("tramos: 0% hasta 64 m², 5% de 65 a 89 m², 8% desde 90 m²", () => {
    expect(VOLUME_TIERS.map((t) => [t.from, t.discount])).toEqual([[90, 8], [65, 5]]);
    for (const [area, pct] of [[10, 0], [35, 0], [64, 0], [64.9, 0], [65, 5], [89, 5], [89.9, 5], [90, 8], [150, 8], [500, 8]] as const) expect(volumeDiscount(area)).toBe(pct);
  });
  it("tabla de referencia: 40, 60, 70 y 95 m²", () => {
    const row = (area: number) => [esencial, clasica].map((c) => [formatUSD(estimateFor(c, area)), formatUSD(rateFor(c.id, c.price, area))]);
    expect(row(40)).toEqual([["USD 48.000", "USD 1.200"], ["USD 56.000", "USD 1.400"]]);
    expect(row(60)).toEqual([["USD 72.000", "USD 1.200"], ["USD 84.000", "USD 1.400"]]);
    expect(row(70)).toEqual([["USD 79.800", "USD 1.140"], ["USD 93.100", "USD 1.330"]]);
    expect(row(95)).toEqual([["USD 104.880", "USD 1.104"], ["USD 122.360", "USD 1.288"]]);
  });
  it("precios por m² efectivos enteros: 1.140 / 1.330 (5%) y 1.104 / 1.288 (8%)", () => {
    expect([esencial, clasica].map((c) => rateFor(c.id, c.price, 65))).toEqual([1140, 1330]);
    expect([esencial, clasica].map((c) => rateFor(c.id, c.price, 90))).toEqual([1104, 1288]);
  });
  it("el límite exacto de cada tramo cambia el precio total", () => {
    expect(estimateFor(esencial, 64)).toBe(64 * 1200);
    expect(estimateFor(esencial, 65)).toBe(65 * 1140);
    expect(estimateFor(esencial, 89)).toBe(89 * 1140);
    expect(estimateFor(esencial, 90)).toBe(90 * 1104);
    expect(estimateFor(clasica, 500)).toBe(500 * 1288);
  });
  it("woodframe no tiene descuento por superficie", () => {
    for (const c of CATEGORIES) {
      for (const area of [40, 65, 90, 100, 500]) {
        expect(rateFor(c.id, c.price, area)).toBe(c.price);
        expect(estimateFor(c, area)).toBe(estimate(area, c.price));
        expect(volumeBonus(c, area)).toBeNull();
        expect(nextBonusHint(c, area)).toBeNull();
      }
    }
  });
  it("bonificación: porcentaje, precio por m² efectivo y ahorro", () => {
    expect(volumeBonus(esencial, 64)).toBeNull();
    expect(volumeBonus(esencial, 70)).toEqual({ discount: 5, area: 70, baseRate: 1200, rate: 1140, saving: 70 * 60 });
    expect(volumeBonus(clasica, 95)).toEqual({ discount: 8, area: 95, baseRate: 1400, rate: 1288, saving: 95 * 112 });
  });
  it("pista del próximo tramo según los m²", () => {
    expect(nextBonusHint(esencial, 40)).toBe(TRADICIONAL_TEXTOS.pista({ from: 65, discount: 5 }));
    expect(nextBonusHint(esencial, 70)).toBe(TRADICIONAL_TEXTOS.pista({ from: 90, discount: 8 }));
    expect(nextBonusHint(esencial, 95)).toBeNull();
  });
  it("mensaje de bonificación", () => {
    expect(TRADICIONAL_TEXTOS.bonificacion(5)).toBe("¡Bonificación por superficie aplicada! (-5% por optimización de escala de obra)");
    expect(TRADICIONAL_TEXTOS.bonificacion(8)).toBe("¡Bonificación por superficie aplicada! (-8% por optimización de escala de obra)");
  });
  it("etiquetas de tramos para la web", () => {
    expect(volumeTierRows().map((r) => r.etiqueta)).toEqual(["35 a 64 m²: tarifa base", "65 a 89 m²: -5%", "90 m² o más: -8%"]);
  });
  it("la logística se calcula sobre el total ya bonificado", () => {
    expect(calculateLogistics(estimateFor(esencial, 70), { zoneId: "medium", separateTrip: false })).toMatchObject({ percentage: 10, surcharge: 7980, total: 87780 });
  });
  it("el resumen muestra el precio por m² efectivo, la bonificación y las exclusiones", () => {
    const s = buildSummary({ ...createAreas(), esencial: 70, clasica: 95 }, undefined, "tradicional");
    expect(s).toContain("ESENCIAL\nSuperficie: 70 m²\nPrecio: USD 1.140/m² (tarifa base USD 1.200/m²)\n¡Bonificación por superficie aplicada! (-5% por optimización de escala de obra)\nInversión estimada: USD 79.800");
    expect(s).toContain("CLÁSICA\nSuperficie: 95 m²\nPrecio: USD 1.288/m² (tarifa base USD 1.400/m²)\n¡Bonificación por superficie aplicada! (-8% por optimización de escala de obra)\nInversión estimada: USD 122.360");
    expect(s).toContain("El presupuesto cubre hasta la primera cámara sanitaria");
    expect(s).toContain("terreno firme y nivelado");
  });
  it("no queda ninguna tarifa vieja de tradicional", () => {
    expect(SYSTEMS.tradicional.categories.some((c) => c.price === 1300 || c.price === 1500)).toBe(false);
  });
});
