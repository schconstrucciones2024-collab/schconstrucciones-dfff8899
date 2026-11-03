import { describe, expect, it } from "vitest";
import { CATEGORIES, SYSTEMS, EXTERIOR_REVESTIMIENTO, LOGISTICS_ZONES, buildSummary, buildWhatsAppUrl, calculateLogistics, clampArea, createAreas, updateAreas, estimate, formatUSD } from "./cotizador";


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
  it("límites 10–200 m²", () => {
    expect(clampArea(5)).toBe(10);
    expect(clampArea(500)).toBe(200);
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
      "Pared y cielorraso de chapones cepillados de primera de eucalipto/pino. Piso de tablas machimbradas curadas/tratadas de pino de primera.",
    );
    expect(interior("moderna")).toBe(
      "Pared y cielorraso de drywall (yeso). Piso de tablas machimbradas curadas/tratadas de pino de primera.",
    );
    expect(interior("allwood")).toBe(
      "Pared de tablas machimbradas de madera de pino curadas/tratadas de primera. Cielorraso de lambriz de pino de primera. Piso de tablas machimbradas de pino curadas/tratadas de primera.",
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
  it("tradicional tiene tarifas 1300 y 1500", () => {
    expect(SYSTEMS.tradicional.categories.map((c) => c.price)).toEqual([1300, 1500]);
  });
  it.each([[0, 52000], [1, 60000]])("tradicional categoría %i a 40 m² en Punta del Diablo", (index, base) => {
    const category = SYSTEMS.tradicional.categories[index];
    expect(category).toBeDefined();
    expect(calculateLogistics(estimate(40, category?.price ?? 0), { zoneId: "local", separateTrip: false })).toMatchObject({ surcharge: 0, total: base });
  });
  it("Esencial 40 m² al 10% suma 5200 y totaliza 57200", () => {
    expect(calculateLogistics(52000, { zoneId: "medium", separateTrip: false })).toMatchObject({ surcharge: 5200, total: 57200 });
  });
  it("un cambio de porcentaje se refleja en ambos sistemas y mensajes", () => {
    const zone = LOGISTICS_ZONES.find((z) => z.id === "medium");
    if (!zone) throw new Error("Falta zona");
    const original = zone.max;
    try {
      Object.assign(zone, { max: 12 });
      const selection = { zoneId: "medium", separateTrip: false } as const;
      expect(calculateLogistics(34000, selection).surcharge).toBe(4080);
      expect(calculateLogistics(52000, selection).total).toBe(58240);
      expect(buildSummary(createAreas(), selection, "tradicional")).toContain("Costo logístico extra (12%): USD 6.240");
      expect(decodeURIComponent(buildWhatsAppUrl(createAreas(), selection, "woodframe"))).toContain("Costo logístico extra (12%): USD 4.080");
    } finally { Object.assign(zone, { max: original }); }
  });
  it("superficies independientes y sincronización aislada por sistema", () => {
    const initial = createAreas();
    const wood = updateAreas(initial, "woodframe", "rustica", 65, false);
    expect(wood).toMatchObject({ rustica: 65, moderna: 40, allwood: 40 });
    const traditional = updateAreas(wood, "tradicional", "esencial", 100, true);
    expect(traditional).toEqual({ rustica: 65, moderna: 40, allwood: 40, esencial: 100, clasica: 100 });
    expect(updateAreas(traditional, "tradicional", "clasica", 999, false).clasica).toBe(200);
  });
  it("incluye firma UTE y sanitaria hasta primera cámara en tradicional", () => {
    expect(SYSTEMS.tradicional.included).toEqual(["Instalación eléctrica interior completa con firma de UTE.", "Instalación sanitaria completa hasta la primera cámara."]);
    expect(SYSTEMS.woodframe.categories).toBe(CATEGORIES);
  });
  it("copia individual y WhatsApp usan el mismo desglose del sistema activo", () => {
    const selection = { zoneId: "medium", separateTrip: false } as const;
    const summary = buildSummary(createAreas(), selection, "tradicional", "esencial");
    expect(summary).toContain("Sistema: Construcción tradicional");
    expect(summary).toContain("Obra base: USD 52.000");
    expect(summary).toContain("Zona logística: 50–150 km (Rocha, La Paloma)");
    expect(summary).toContain("Costo logístico extra (10%): USD 5.200\nTotal estimado con logística: USD 57.200");
    expect(summary).not.toContain("CLÁSICA");
    expect(summary).not.toContain("siding");
    const url = new URL(buildWhatsAppUrl(createAreas(), selection, "tradicional", "esencial"));
    expect(url.pathname).toBe("/59895564068");
    expect(url.searchParams.get("text")).toBe(summary);
  });
});
