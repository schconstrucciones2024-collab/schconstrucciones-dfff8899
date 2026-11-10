import { describe, expect, it } from "vitest";
import { INSTITUTIONAL_PHRASE, PILLAR_DEFS } from "./pillars";
import { PROJECT_STORIES } from "./projectStories";
import { HOME_SECTION_ORDER } from "./navLinks";

describe("pilares de SCH", () => {
  it("usa la frase institucional exacta", () => {
    expect(INSTITUTIONAL_PHRASE).toBe("Materiales de calidad + planificación + cumplimiento = resultados que perduran.");
  });

  it("son los cuatro pilares pedidos", () => {
    expect(PILLAR_DEFS.map((p) => p.title)).toEqual(["Confianza", "Experiencia", "Profesionalismo", "Eficiencia"]);
  });

  it("cada pilar apunta a una evidencia real del sitio (una sección o una obra publicada)", () => {
    for (const p of PILLAR_DEFS) {
      const to = p.evidence.to;
      if ("slug" in to) expect(PROJECT_STORIES.map((s) => s.slug), p.id).toContain(to.slug);
      else expect(HOME_SECTION_ORDER as readonly string[], p.id).toContain(to.id);
    }
  });
});
