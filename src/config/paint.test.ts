import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAINT,
  EXTERIOR_SWATCHES,
  INTERIOR_SWATCHES,
  PAINT_BASE_COLOR,
  PAINT_COATS,
  PAINT_DESDE_USD,
  PAINT_FX,
  PAINT_PLAN,
  PAINT_SYSTEMS,
  PAINT_TARIFFS,
  PINE_REFERENCE,
  WOOD_STAINS,
  colorName,
  colorText,
  coatsLabel,
  estimatePaintSurfaces,
  formatRate,
  formatUyu,
  hexToRgb,
  normalizeHex,
  normalizePaint,
  paintLooks,
  paintPrice,
  paintRateUsd,
  paintTint,
  rgbToHex,
  type PaintConfig,
} from "./paint";
import {
  DEFAULT_LOGISTICS,
  LOGISTICS_ZONES,
  buildSummary,
  buildWhatsAppUrl,
  paintExtra,
  withExtras,
  deckExtra,
  type LogisticsSelection,
} from "@/lib/cotizador";
import { DEFAULT_DECK } from "./deck";
import { configWhatsAppText } from "./pricing";

const on = (patch: Partial<PaintConfig> = {}): PaintConfig => normalizePaint({ ...DEFAULT_PAINT, enabled: true, ...patch });
const local: LogisticsSelection = { ...DEFAULT_LOGISTICS };
const medium: LogisticsSelection = { zoneId: "medium", separateTrip: false };

describe("pintura: lista de precios", () => {
  it("los totales por m² son los que pasó SCH (pesos y dólares)", () => {
    const t = (id: (typeof PAINT_SYSTEMS)[number]) => PAINT_TARIFFS[id].totales;
    expect(t("yeso")).toEqual({ 1: { uyu: 170, usd: 4.25 }, 2: { uyu: 270, usd: 6.75 }, 3: { uyu: 370, usd: 9.25 } });
    expect(t("siding")).toEqual({ 1: { uyu: 210, usd: 5.25 }, 2: { uyu: 350, usd: 8.75 }, 3: { uyu: 490, usd: 12.25 } });
    expect(t("madera")).toEqual({ 1: { uyu: 270, usd: 6.75 }, 2: { uyu: 415, usd: 10.4 }, 3: { uyu: 560, usd: 14 } });
  });

  it("cada total en pesos es la preparación más las manos, y el dólar es el peso a 40 (con el redondeo de la lista)", () => {
    expect(PAINT_FX).toBe(40);
    for (const id of PAINT_SYSTEMS) {
      const t = PAINT_TARIFFS[id];
      for (const coats of PAINT_COATS) {
        const uyu = t.preparacion.uyu + t.manos.slice(0, coats).reduce((n, m) => n + m.uyu, 0);
        expect(t.totales[coats].uyu, `${id} ${coats}`).toBe(uyu);
        // Los dólares de la lista están redondeados a 5 centavos: nunca se alejan más de 2,5 centavos del peso a 40.
        expect(Math.abs(t.totales[coats].usd - uyu / PAINT_FX)).toBeLessThan(0.0251);
      }
    }
  });

  it("los renglones de cada ficha son los de la lista", () => {
    expect(PAINT_TARIFFS.yeso.preparacion).toEqual({ label: "Preparación (lijado + sellador)", uyu: 50, usd: 1.25 });
    expect(PAINT_TARIFFS.yeso.manos.map((m) => [m.uyu, m.usd])).toEqual([[120, 3], [100, 2.5], [100, 2.5]]);
    expect(PAINT_TARIFFS.siding.preparacion.uyu).toBe(55);
    expect(PAINT_TARIFFS.siding.manos.map((m) => m.uyu)).toEqual([155, 140, 140]);
    expect(PAINT_TARIFFS.madera.preparacion.uyu).toBe(75);
    expect(PAINT_TARIFFS.madera.manos.map((m) => m.uyu)).toEqual([195, 145, 145]);
    expect(PAINT_TARIFFS.yeso.producto).toBe("Látex premium (Belco Aqua)");
  });

  it("el «Desde» es el precio más bajo con las 2 manos por defecto", () => {
    expect(PAINT_DESDE_USD).toBe(6.75);
    expect(paintRateUsd("siding", 2)).toBe(8.75);
  });

  it("formatos: dólares con coma y pesos con punto de miles", () => {
    expect(formatRate(8.75)).toBe("USD 8,75");
    expect(formatRate(14)).toBe("USD 14,00");
    expect(formatUyu(1415)).toBe("$U 1.415");
    expect(coatsLabel(1)).toBe("1 mano");
    expect(coatsLabel(3)).toBe("3 manos");
  });
});

describe("pintura: qué se pinta en cada opción", () => {
  it("Moderna: siding afuera y yeso adentro; Rústica y Allwood: siding afuera y madera adentro", () => {
    expect(PAINT_PLAN.moderna.exterior).toMatchObject({ system: "siding", kind: "color" });
    expect(PAINT_PLAN.moderna.interior).toMatchObject({ system: "yeso", kind: "color" });
    for (const f of ["rustica", "allwood"] as const) {
      expect(PAINT_PLAN[f].exterior).toMatchObject({ system: "siding", kind: "color" });
      expect(PAINT_PLAN[f].interior).toMatchObject({ system: "madera", kind: "madera" });
    }
  });

  it("la construcción tradicional elige color pero no tiene precio en la lista", () => {
    for (const f of ["esencial", "clasica"] as const) {
      for (const z of ["exterior", "interior"] as const) expect(PAINT_PLAN[f][z]).toMatchObject({ system: null, kind: "color" });
    }
  });
});

describe("pintura: precio", () => {
  const surfaces = { exterior: 80, interior: 100 };

  it("Moderna con 2 manos: siding exterior + yeso interior", () => {
    const p = paintPrice(on(), "moderna", surfaces);
    expect(p.active).toBe(true);
    expect(p.lines.map((l) => [l.zone, l.system, l.area, l.rate, l.subtotal])).toEqual([
      ["exterior", "siding", 80, 8.75, 700],
      ["interior", "yeso", 100, 6.75, 675],
    ]);
    expect(p.subtotal).toBe(1375);
    expect(p.pending).toBe(false);
  });

  it("Rústica y Allwood: la madera interior se cobra con el protector de madera", () => {
    for (const f of ["rustica", "allwood"] as const) {
      const p = paintPrice(on(), f, surfaces);
      expect(p.lines[1]).toMatchObject({ system: "madera", rate: 10.4, subtotal: 1040 });
      expect(p.subtotal).toBe(700 + 1040);
    }
  });

  it("1 y 3 manos cambian el precio por m²", () => {
    expect(paintPrice(on({ coats: 1 }), "moderna", surfaces).subtotal).toBe(80 * 5.25 + 100 * 4.25);
    expect(paintPrice(on({ coats: 3 }), "moderna", surfaces).subtotal).toBe(80 * 12.25 + 100 * 9.25);
    expect(paintPrice(on({ coats: 3 }), "rustica", surfaces).subtotal).toBe(80 * 12.25 + 100 * 14);
    expect(paintPrice(on({ coats: 1 }), "rustica", surfaces).subtotal).toBe(80 * 5.25 + 100 * 6.75);
  });

  it("se puede pintar solo el exterior o solo el interior", () => {
    expect(paintPrice(on({ interior: false }), "moderna", surfaces).subtotal).toBe(700);
    expect(paintPrice(on({ exterior: false }), "moderna", surfaces).subtotal).toBe(675);
    const none = paintPrice(on({ interior: false, exterior: false }), "moderna", surfaces);
    expect(none.active).toBe(false);
    expect(none.lines).toEqual([]);
    expect(none.subtotal).toBe(0);
  });

  it("apagada no cobra nada, aunque haya superficie", () => {
    const p = paintPrice(normalizePaint(DEFAULT_PAINT), "moderna", surfaces);
    expect(p).toMatchObject({ active: false, lines: [], subtotal: 0, pending: false });
  });

  it("las superficies se redondean al m² que se muestra y se cobra", () => {
    const p = paintPrice(on(), "moderna", { exterior: 77.6, interior: 92.4 });
    expect(p.lines.map((l) => l.area)).toEqual([78, 92]);
    expect(p.subtotal).toBe(Math.round(78 * 8.75) + 92 * 6.75);
    // Una cara sin paredes no genera renglón.
    expect(paintPrice(on(), "moderna", { exterior: 0, interior: 50 }).lines).toHaveLength(1);
  });

  it("construcción tradicional: queda «A cotizar» y no suma", () => {
    const p = paintPrice(on(), "esencial", surfaces);
    expect(p.pending).toBe(true);
    expect(p.subtotal).toBe(0);
    expect(p.lines.every((l) => l.subtotal === null && l.rate === null)).toBe(true);
  });
});

describe("pintura: valores válidos", () => {
  it("por defecto está apagada, con 2 manos, las dos caras y el tono Natural", () => {
    expect(DEFAULT_PAINT).toMatchObject({ enabled: false, coats: 2, exterior: true, interior: true, woodColor: "natural" });
    expect(normalizePaint()).toEqual(DEFAULT_PAINT);
    expect(normalizePaint(null)).toEqual(DEFAULT_PAINT);
  });

  it("corrige manos, colores y tonos inválidos sin romper", () => {
    const p = normalizePaint({ coats: 7 as never, exteriorColor: "rojo", interiorColor: "#ABC", woodColor: "pino" as never, enabled: true });
    expect(p).toMatchObject({ coats: 2, exteriorColor: DEFAULT_PAINT.exteriorColor, interiorColor: "#aabbcc", woodColor: "natural", enabled: true });
    expect(normalizePaint({ coats: 1 }).coats).toBe(1);
    expect(normalizePaint({ coats: 3 }).coats).toBe(3);
    expect(normalizePaint({ exterior: false }).exterior).toBe(false);
    expect(normalizePaint({ enabled: "si" as never }).enabled).toBe(false);
  });

  it("los 8 tonos de madera son los pedidos, en ese orden", () => {
    expect(WOOD_STAINS.map((s) => s.nombre)).toEqual([
      "Cristal", "Natural", "Cedro", "Caoba", "Roble claro", "Roble oscuro", "Nogal", "Ébano",
    ]);
    expect(WOOD_STAINS.filter((s) => s.transparente).map((s) => s.nombre)).toEqual(["Cristal"]);
  });

  it("colores: hex, RGB y nombres", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex(" 1a2B3c ")).toBe("#1a2b3c");
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex(12)).toBeNull();
    expect(hexToRgb("#cfd3d6")).toEqual([207, 211, 214]);
    expect(rgbToHex(207, 211, 214)).toBe("#cfd3d6");
    expect(rgbToHex(300, -5, 12.4)).toBe("#ff000c");
    expect(colorText("#cfd3d6")).toBe("#CFD3D6 · RGB 207, 211, 214");
    expect(colorName("#cfd3d6", "exterior")).toBe("Gris perla");
    expect(colorName("#123456", "interior")).toBe("Color personalizado");
    expect(new Set(EXTERIOR_SWATCHES.map((s) => s.hex)).size).toBe(EXTERIOR_SWATCHES.length);
    expect(new Set(INTERIOR_SWATCHES.map((s) => s.hex)).size).toBe(INTERIOR_SWATCHES.length);
  });
});

describe("pintura: cómo se ve en el visor", () => {
  it("apagada, o sin esa cara, no cambia nada", () => {
    expect(paintLooks(undefined, "moderna")).toEqual({ interior: null, exterior: null });
    expect(paintLooks(normalizePaint(), "moderna")).toEqual({ interior: null, exterior: null });
    const soloExterior = paintLooks(on({ interior: false }), "moderna");
    expect(soloExterior.interior).toBeNull();
    expect(soloExterior.exterior).not.toBeNull();
  });

  it("el color de la textura base queda igual y el blanco aclara el siding gris", () => {
    expect(paintTint("#ced1d5", "#ced1d5")).toEqual([1, 1, 1]);
    const [r, g, b] = paintTint("#ffffff", PAINT_BASE_COLOR.sidingModerno!);
    expect(r).toBeGreaterThan(1.3);
    expect(g).toBeGreaterThan(1.3);
    expect(b).toBeGreaterThan(1.3);
    expect(Math.max(r, g, b)).toBeLessThan(2.3);
    // Un color oscuro oscurece.
    expect(paintTint("#1d1e20", "#ced1d5").every((v) => v < 0.1)).toBe(true);
  });

  it("Cristal deja la madera como está; Ébano la oscurece; Caoba la vuelve rojiza", () => {
    const wood = (id: string) => paintLooks(on({ woodColor: id as never }), "rustica").interior!;
    expect(wood("cristal").tint).toEqual([1, 1, 1]);
    expect(wood("cristal").roughness).toBeLessThan(wood("natural").roughness);
    const natural = wood("natural").tint;
    expect(Math.max(...natural.map((v) => Math.abs(v - 1)))).toBeLessThan(0.2);
    expect(wood("ebano").tint.every((v) => v < 0.1)).toBe(true);
    const caoba = wood("caoba").tint;
    expect(caoba[0]).toBeGreaterThan(caoba[1]! * 2);
    expect(PINE_REFERENCE).toBe(PAINT_BASE_COLOR.machimbre);
  });

  it("en Moderna el interior se pinta con el color elegido; en Rústica con el tono de madera", () => {
    const moderna = paintLooks(on({ interiorColor: "#a8b79f" }), "moderna");
    const rustica = paintLooks(on({ interiorColor: "#a8b79f", woodColor: "ebano" }), "rustica");
    expect(moderna.interior!.tint).toEqual(paintTint("#a8b79f", PAINT_BASE_COLOR.drywall!));
    expect(rustica.interior!.tint).not.toEqual(moderna.interior!.tint);
    expect(rustica.exterior!.tint).toEqual(moderna.exterior!.tint);
  });
});

describe("pintura: extra con logística y total con extras", () => {
  const surfaces = { exterior: 80, interior: 100 };

  it("el costo logístico del tramo también se aplica sobre la pintura", () => {
    const q = paintExtra(on(), "moderna", surfaces, medium);
    expect(q).toMatchObject({ percentage: 10, subtotal: 1375, surcharge: 138, total: 1513, separateTrip: false });
    expect(paintExtra(on(), "moderna", surfaces, local)).toMatchObject({ percentage: 0, surcharge: 0, total: 1375 });
  });

  it("en el tramo con viaje aparte no hay total calculable", () => {
    const far = paintExtra(on(), "moderna", surfaces, { zoneId: "far", separateTrip: true });
    expect(far.total).toBeNull();
    expect(withExtras(42500, deckExtra(DEFAULT_DECK, local), far).totalConExtras).toBeNull();
  });

  it("suma al total junto con el deck, y sin pintura el total no cambia", () => {
    const deck = deckExtra({ ...DEFAULT_DECK, enabled: true, roofed: true }, local),
      paint = paintExtra(on(), "moderna", surfaces, local);
    expect(withExtras(42500, deck).totalConExtras).toBe(42500 + (deck.total ?? 0));
    expect(withExtras(42500, deckExtra(DEFAULT_DECK, local), paint)).toEqual({ vivienda: 42500, extras: 1375, totalConExtras: 43875 });
    expect(withExtras(42500, deck, paint)).toEqual({
      vivienda: 42500,
      extras: (deck.total ?? 0) + 1375,
      totalConExtras: 42500 + (deck.total ?? 0) + 1375,
    });
    expect(withExtras(42500, deckExtra(DEFAULT_DECK, local))).toEqual({ vivienda: 42500, extras: 0, totalConExtras: 42500 });
  });

  it("la pintura «A cotizar» de la construcción tradicional no suma al total", () => {
    const q = paintExtra(on(), "esencial", surfaces, local);
    expect(q.pending).toBe(true);
    expect(withExtras(30000, deckExtra(DEFAULT_DECK, local), q)).toEqual({ vivienda: 30000, extras: 0, totalConExtras: 30000 });
  });
});

describe("pintura: la superficie se estima con los m²", () => {
  it("más m² más pared, y sin m² no hay nada que pintar", () => {
    expect(estimatePaintSurfaces(0)).toEqual({ exterior: 0, interior: 0 });
    const a = estimatePaintSurfaces(40),
      b = estimatePaintSurfaces(100);
    expect(b.exterior).toBeGreaterThan(a.exterior);
    expect(b.interior).toBeGreaterThan(a.interior * 2);
    // El perímetro crece con la raíz de los m²: duplicar la casa no duplica el exterior.
    expect(estimatePaintSurfaces(200).exterior).toBeLessThan(estimatePaintSurfaces(100).exterior * 2);
  });
});

describe("pintura: resumen copiable y WhatsApp del cotizador", () => {
  const areas = { rustica: 50, moderna: 50, allwood: 50, esencial: 50, clasica: 50 };

  it("sin pintura el texto es el de siempre", () => {
    const sin = buildSummary(areas, medium, "woodframe", "moderna");
    expect(buildSummary(areas, medium, "woodframe", "moderna", undefined, normalizePaint())).toBe(sin);
    expect(buildSummary(areas, medium, "woodframe", "moderna", undefined, on({ interior: false, exterior: false }))).toBe(sin);
  });

  it("Moderna: lista siding exterior y yeso interior con los precios y los colores", () => {
    const text = buildSummary(areas, medium, "woodframe", "moderna", undefined, on({ exteriorColor: "#4b5e4c", interiorColor: "#a8b79f" }));
    expect(text).toContain("Extras opcionales (no incluidos en el presupuesto de la vivienda)");
    expect(text).toContain("Pintura: 2 manos (mano de obra y materiales incluidos)");
    expect(text).toContain("Exterior · siding (acrílico exterior): 78 m² × USD 8,75/m² = USD 683");
    expect(text).toContain("Interior · yeso/drywall (látex premium): 93 m² × USD 6,75/m² = USD 628");
    expect(text).toContain("Color exterior: Verde bosque (#4B5E4C · RGB 75, 94, 76)");
    expect(text).toContain("Color interior (yeso/drywall o revoque): Verde salvia (#A8B79F · RGB 168, 183, 159)");
    expect(text).not.toContain("Tono de la madera");
    // 683 + 628 = 1.311, más 10 % de logística (131) = 1.442. Vivienda: 50 × 900 = 45.000 + 10 % = 49.500.
    expect(text).toContain("Total de los extras: USD 1.442 (incluye logística 10%)");
    expect(text).toContain("Total con extras: USD 50.942");
    expect(text).toContain("USD 1 = $U 40");
  });

  it("Rústica: la madera interior dice el tono y cobra el protector de madera; 3 manos", () => {
    const text = buildSummary(areas, local, "woodframe", "rustica", undefined, on({ coats: 3, woodColor: "roble-oscuro" }));
    expect(text).toContain("Pintura: 3 manos");
    expect(text).toContain("Interior · madera (protector de madera): 93 m² × USD 14,00/m² = USD 1.302");
    expect(text).toContain("Tono de la madera interior: Roble oscuro");
    expect(text).not.toContain("Color interior");
  });

  it("con las tres opciones juntas cada una lleva su pintura y su total", () => {
    const text = buildSummary(areas, local, "woodframe", undefined, undefined, on());
    expect(text).toContain("RÚSTICA — Exterior · siding");
    expect(text).toContain("MODERNA — Interior · yeso/drywall");
    expect(text).toContain("ALLWOOD — Interior · madera");
    expect(text).toContain("Total con extras (RÚSTICA): USD 44.150");
    expect(text).toContain("Total con extras (MODERNA): USD 46.311");
    expect(text).toContain("Total con extras (ALLWOOD): USD 51.150");
  });

  it("junto con el deck suma las dos cosas", () => {
    const deck = { ...DEFAULT_DECK, enabled: true };
    const text = buildSummary(areas, local, "woodframe", "moderna", deck, on());
    expect(text).toContain("Deck línea Esencial de 4 × 3 m (12 m²)");
    expect(text).toContain("Pintura: 2 manos");
    const deckTotal = deckExtra(deck, local).total ?? 0;
    expect(text).toContain(`Total de los extras: USD ${(683 + 628 + deckTotal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`);
  });

  it("construcción tradicional: dice A cotizar y no la suma", () => {
    const text = buildSummary(areas, local, "tradicional", "esencial", undefined, on());
    expect(text).toContain("A cotizar");
    expect(text).toContain("se presupuesta aparte y no está sumada");
    expect(text).toContain("Total de los extras: USD 0");
  });

  it("el link de WhatsApp lleva la pintura", () => {
    const url = buildWhatsAppUrl(areas, local, "woodframe", "moderna", undefined, on());
    expect(decodeURIComponent(url)).toContain("Pintura: 2 manos");
  });
});

describe("pintura: mensaje del diseñador", () => {
  const base = {
    m2: 48, floors: 1, finish: "moderna" as const, foundation: "hormigon" as const, roofType: "dos" as const,
    extraOpenings: 0, logistics: local, openings: 6,
  };
  it("sin pintura ni deck no agrega extras", () => {
    expect(configWhatsAppText(base)).not.toContain("Extras opcionales");
  });
  it("con pintura mide sobre el diseño y suma al total", () => {
    const text = configWhatsAppText({ ...base, paint: on({ coats: 3 }), paintSurfaces: { exterior: 74, interior: 84.4 } });
    expect(text).toContain("Extras opcionales (no incluidos en el presupuesto de la vivienda)");
    expect(text).toContain("Pintura (3 manos, mano de obra y materiales incluidos)");
    expect(text).toContain("Exterior · siding (acrílico exterior): 74 m² × USD 12,25/m² = USD 907");
    expect(text).toContain("Interior · yeso/drywall (látex premium): 84 m² × USD 9,25/m² = USD 777");
    expect(text).toContain("Total del extra: USD 1.684");
    // 48 m² × 900 = 43.200 + 1.684.
    expect(text).toContain("Total con extras: USD 44.884");
  });
  it("el deck solo sigue diciendo lo de siempre", () => {
    const text = configWhatsAppText({ ...base, deck: { ...DEFAULT_DECK, enabled: true } });
    expect(text).toContain("Total del extra: USD 1.260");
    expect(text).not.toContain("Pintura");
  });
});

describe("zonas logísticas (referencia de las pruebas)", () => {
  it("existen las zonas que usan estas pruebas", () => {
    expect(LOGISTICS_ZONES.map((z) => z.id)).toContain("medium");
  });
});
