import { describe, expect, it } from "vitest";
import { ALL_SERVICES, SERVICE_GROUPS } from "./serviceCatalog";

describe("catálogo de servicios SCH", () => {
  it("tiene los once servicios pedidos, en tres grupos", () => {
    expect(SERVICE_GROUPS.map((g) => g.id)).toEqual(["obra-nueva", "ampliaciones", "renovar"]);
    expect(ALL_SERVICES.map((s) => s.title)).toEqual([
      "Construcción de viviendas", "Wood Frame", "Construcción tradicional", "Obra nueva",
      "Ampliaciones", "Remodelaciones", "Reformas integrales",
      "Drywall y yeso", "Pintura", "Instalaciones eléctricas completas", "Instalaciones sanitarias completas",
    ]);
  });

  it("cada servicio explica el problema que resuelve y el valor que aporta, con un mensaje propio de WhatsApp", () => {
    for (const s of ALL_SERVICES) {
      expect(s.problem.trim().length, s.id).toBeGreaterThan(20);
      expect(s.value.trim().length, s.id).toBeGreaterThan(20);
      expect(s.message.startsWith("Hola SCH"), s.id).toBe(true);
    }
    expect(new Set(ALL_SERVICES.map((s) => s.message)).size).toBe(ALL_SERVICES.length);
    expect(new Set(ALL_SERVICES.map((s) => s.id)).size).toBe(ALL_SERVICES.length);
  });

  it("cada grupo tiene su pregunta, su botón y su mensaje", () => {
    for (const g of SERVICE_GROUPS) {
      expect(g.question.startsWith("¿") && g.question.endsWith("?"), g.id).toBe(true);
      expect(g.cta.length, g.id).toBeGreaterThan(5);
      expect(g.message.startsWith("Hola SCH"), g.id).toBe(true);
    }
  });

  it("solo enlaza a las páginas de detalle que existen", () => {
    expect(ALL_SERVICES.filter((s) => s.to).map((s) => [s.id, s.to])).toEqual([
      ["wood-frame", "/woodframe"], ["construccion-tradicional", "/construccion-tradicional"],
    ]);
  });

  it("no promete plazos, precios ni garantías que no estén documentados", () => {
    const text = ALL_SERVICES.map((s) => `${s.problem} ${s.value}`).join(" ");
    expect(text).not.toMatch(/USD|US\$|\$\s?\d|garant[ií]a|\d+\s*(d[ií]as|semanas|meses)/i);
  });
});
