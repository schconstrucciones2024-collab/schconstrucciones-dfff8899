import { describe, expect, it } from "vitest";
import { activeNavId, HOME_SECTION_ORDER, MAIN_NAV, TOOL_NAV } from "./navLinks";

describe("navegación del sitio", () => {
  it("respeta el orden del menú pedido", () => {
    expect(MAIN_NAV.map((l) => l.label)).toEqual([
      "Inicio", "Nosotros", "Sistemas constructivos", "Servicios", "Proyectos", "Nuestro proceso", "Contacto",
    ]);
  });

  it("todo enlace apunta a una sección de la home y sigue su orden", () => {
    const ids = [...MAIN_NAV, ...TOOL_NAV].map((l) => l.id);
    for (const id of ids) expect(HOME_SECTION_ORDER as readonly string[], id).toContain(id);
    const positions = MAIN_NAV.map((l) => (HOME_SECTION_ORDER as readonly string[]).indexOf(l.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("marca la sección activa; las herramientas cuentan como Servicios y las redes como Proyectos", () => {
    expect(activeNavId(null)).toBe(null);
    expect(activeNavId("sistemas")).toBe("sistemas");
    expect(activeNavId("disenar")).toBe("servicios");
    expect(activeNavId("cotizar")).toBe("servicios");
    expect(activeNavId("pilares")).toBe("servicios");
    expect(activeNavId("redes")).toBe("proyectos");
    expect(activeNavId("otra-cosa")).toBe(null);
  });
});
