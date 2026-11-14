import { describe, expect, it } from "vitest";
import { CATEGORIES, SYSTEMS, estimateFor, buildSummary, createAreas } from "@/lib/cotizador";
import { RATES, configBonus, configPrice, configRate, configWhatsAppText } from "@/config/pricing";
import { initialConfig } from "@/store/useConfigurator";
import { faqs } from "@/data/faqs";
import { TRADICIONAL_EXCLUIDO, TRADICIONAL_TEXTOS, incluyeFor, incluyeTexto, PRECIO_INCLUYE } from "./tradicional";

const base = { ...initialConfig(), extraOpenings: 0, logistics: { zoneId: "local", separateTrip: false } as const };
const tradicional = SYSTEMS.tradicional.categories;

describe("cotizador y diseñador 3D leen la misma tarifa", () => {
  it("las tarifas del diseñador son las de SYSTEMS", () => {
    expect(RATES.esencial).toBe(1200);
    expect(RATES.clasica).toBe(1400);
    expect([RATES.rustica, RATES.moderna, RATES.allwood]).toEqual([850, 900, 990]);
  });
  it.each([10, 35, 40, 48, 60, 64, 65, 70, 89, 90, 95, 150, 500])("%i m²: mismo precio de vivienda en el cotizador y en el diseñador, en las 5 terminaciones", (m2) => {
    for (const category of [...CATEGORIES, ...tradicional]) {
      const designer = configPrice({ ...base, finish: category.id, m2 }).total;
      expect(designer).toBe(estimateFor(category, m2));
      expect(configRate(category.id, m2) * m2).toBe(designer);
    }
  });
  it("tabla de referencia en el diseñador: 40, 60, 70 y 95 m²", () => {
    const total = (finish: "esencial" | "clasica", m2: number) => configPrice({ ...base, finish, m2 }).total;
    expect([total("esencial", 40), total("clasica", 40)]).toEqual([48000, 56000]);
    expect([total("esencial", 60), total("clasica", 60)]).toEqual([72000, 84000]);
    expect([total("esencial", 70), total("clasica", 70)]).toEqual([79800, 93100]);
    expect([total("esencial", 95), total("clasica", 95)]).toEqual([104880, 122360]);
  });
  it("al alternar techo liviano ↔ losa en el diseñador se aplican las mismas tarifas y descuentos", () => {
    for (const [m2, esencial, clasica] of [[60, 1200, 1400], [70, 1140, 1330], [95, 1104, 1288]] as const) {
      expect(configRate("esencial", m2)).toBe(esencial);
      expect(configRate("clasica", m2)).toBe(clasica);
    }
  });
  it("el diseñador informa la bonificación y el precio efectivo", () => {
    expect(configBonus("esencial", 64)).toBeNull();
    expect(configPrice({ ...base, finish: "esencial", m2: 70 })).toMatchObject({ rate: 1140, baseRate: 1200, bonus: { discount: 5, rate: 1140 } });
    expect(configPrice({ ...base, finish: "clasica", m2: 95 })).toMatchObject({ rate: 1288, baseRate: 1400, bonus: { discount: 8 } });
    expect(configPrice({ ...base, finish: "moderna", m2: 95 })).toMatchObject({ rate: 900, bonus: null });
  });
  it("woodframe en el diseñador no cambia con la superficie", () => {
    expect(configPrice({ ...base, finish: "rustica", m2: 100 }).total).toBe(85000);
    expect(configPrice({ ...base, finish: "allwood", m2: 100 }).total).toBe(99000);
  });
  it("la logística del diseñador se aplica sobre el total ya bonificado", () => {
    const p = configPrice({ ...base, finish: "esencial", m2: 70, logistics: { zoneId: "medium", separateTrip: false } });
    expect(p.obra).toBe(79800);
    expect(p.surcharge).toBe(7980);
    expect(p.total).toBe(87780);
  });
  it("el mensaje de WhatsApp del diseñador incluye la bonificación y las exclusiones solo en tradicional", () => {
    const send = (finish: "esencial" | "clasica" | "rustica", m2: number) => configWhatsAppText({ ...base, finish, m2, openings: 4 });
    const tradicionalText = send("esencial", 70);
    expect(tradicionalText).toContain("¡Bonificación por superficie aplicada! (-5% por optimización de escala de obra)");
    expect(tradicionalText).toContain("Precio por m² efectivo: USD 1.140/m² (tarifa base USD 1.200/m²)");
    expect(tradicionalText).toContain("El presupuesto cubre hasta la primera cámara sanitaria");
    expect(send("esencial", 60)).not.toContain("Bonificación por superficie");
    expect(send("clasica", 95)).toContain("(-8% por optimización de escala de obra)");
    expect(send("rustica", 95)).not.toContain("Bonificación por superficie");
    expect(send("rustica", 95)).not.toContain("El presupuesto cubre hasta la primera cámara sanitaria");
  });
});

describe("textos de valor de la construcción tradicional", () => {
  it("son los cinco puntos que justifican el precio, en el orden pedido", () => {
    expect(PRECIO_INCLUYE.map((i) => i.titulo)).toEqual([
      "Cimentación incluida",
      "Estructura y cubierta adaptada al clima marino",
      "Instalaciones completas",
      "Terminaciones clave incluidas",
      "Operativa local resuelta",
    ]);
  });
  it("cada opción muestra el detalle de su cubierta", () => {
    const estructura = (option: "esencial" | "clasica") => incluyeFor(option).find((i) => i.id === "estructura")?.texto ?? "";
    expect(estructura("esencial")).toContain("Techo Liviano: estructura de madera 100% curada, aislación térmica/hidrófuga reforzada y cubierta de chapa con zinguería completa.");
    expect(estructura("esencial")).not.toContain("losa llena");
    expect(estructura("clasica")).toContain("Losa: estructura portante reforzada, losa llena de hormigón armado ejecutada en obra, aislación térmica e impermeabilización de azotea (planta baja).");
    expect(estructura("clasica")).not.toContain("madera 100% curada");
    const both = incluyeTexto(PRECIO_INCLUYE[1] as (typeof PRECIO_INCLUYE)[number]);
    expect(both).toContain("En opción Techo Liviano:");
    expect(both).toContain("En opción Losa:");
  });
  it("exclusiones: primera cámara sanitaria, grifería, artefactos, muebles, calefón y obras exteriores", () => {
    for (const part of ["primera cámara sanitaria", "grifería", "artefactos sanitarios", "muebles de cocina/placares", "calefón", "parrilleros, decks, pérgolas o balcones", "terreno firme y nivelado", "opción losa corresponde a planta baja no transitable"])
      expect(TRADICIONAL_TEXTOS.exclusiones).toContain(part);
    expect(SYSTEMS.tradicional.excluded).toBe(TRADICIONAL_EXCLUIDO);
  });
  it("el resumen del cotizador de tradicional lleva las exclusiones; el de woodframe no", () => {
    expect(buildSummary(createAreas(), undefined, "tradicional")).toContain(TRADICIONAL_TEXTOS.exclusiones);
    expect(buildSummary(createAreas(), undefined, "woodframe")).not.toContain(TRADICIONAL_TEXTOS.exclusiones);
  });
});

describe("preguntas frecuentes de tradicional", () => {
  const faq = (id: string) => {
    const found = faqs.find((f) => f.id === id);
    if (!found) throw new Error(`Falta la pregunta ${id}`);
    return found;
  };
  it("mantiene las preguntas que ya estaban", () => {
    for (const id of ["faq-plazos", "faq-pago", "faq-incluye", "faq-no-incluye", "faq-deck", "faq-fundacion"]) expect(faq(id)).toBeDefined();
  });
  it("tiene ids únicos", () => {
    expect(new Set(faqs.map((f) => f.id)).size).toBe(faqs.length);
  });
  it("precio: tabla por tramos con los valores de las tarifas", () => {
    const table = faq("faq-precio-tradicional").blocks.find((b) => b.type === "table");
    if (!table || table.type !== "table") throw new Error("Falta la tabla de tramos");
    expect(table.rows).toEqual([
      ["35 a 64 m²", "USD 1.200/m²", "USD 1.400/m²"],
      ["65 a 89 m² · -5%", "USD 1.140/m²", "USD 1.330/m²"],
      ["90 m² o más · -8%", "USD 1.104/m²", "USD 1.288/m²"],
    ]);
  });
  it("incluye: los cinco puntos y la nota de exclusiones", () => {
    const blocks = faq("faq-incluye-tradicional").blocks;
    const list = blocks.find((b) => b.type === "list");
    expect(list && list.type === "list" ? list.items : []).toHaveLength(5);
    expect(JSON.stringify(blocks)).toContain("primera cámara sanitaria");
  });
  it("ninguna pregunta nombra las tarifas viejas", () => {
    expect(JSON.stringify(faqs)).not.toMatch(/1\.?300|1\.?500/);
  });
  it("pintura: la pregunta del extra opcional está en el listado", () => {
    expect(faq("faq-pintura").question).toContain("pintura");
  });
});
