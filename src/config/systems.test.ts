import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINISH,
  FINISHES_BY_SYSTEM,
  FOUNDATIONS_BY_SYSTEM,
  PLATEA_HEIGHT,
  allowedRoofs,
  coherentSystem,
  systemOf,
  systemPatch,
} from "./systems";
import { SYSTEMS } from "@/lib/cotizador";

describe("sistema constructivo del diseñador 3D", () => {
  it("se deduce de la terminación y coincide con las categorías del cotizador", () => {
    for (const system of ["woodframe", "tradicional"] as const) {
      expect(FINISHES_BY_SYSTEM[system]).toEqual(SYSTEMS[system].categories.map((c) => c.id));
      for (const finish of FINISHES_BY_SYSTEM[system]) expect(systemOf(finish)).toBe(system);
    }
  });

  it("Woodframe va sobre pilotes y Tradicional sobre pilotes de hormigón o platea", () => {
    expect(FOUNDATIONS_BY_SYSTEM.woodframe).toEqual(["hormigon", "madera"]);
    expect(FOUNDATIONS_BY_SYSTEM.tradicional).toEqual(["hormigon", "platea"]);
    expect(PLATEA_HEIGHT).toBeGreaterThan(0);
  });

  it("Esencial lleva techo de chapa (una caída o doble agua) y Clásica, losa plana", () => {
    expect(allowedRoofs("esencial")).toEqual(["una", "dos"]);
    expect(allowedRoofs("clasica")).toEqual(["plano"]);
    for (const finish of FINISHES_BY_SYSTEM.woodframe) expect(allowedRoofs(finish)).toEqual(["una", "dos", "plano"]);
  });

  it("adapta base y techo a la terminación sin tocar lo que ya corresponde", () => {
    const ok = { finish: "rustica", foundation: "madera", roofType: "dos" } as const;
    expect(coherentSystem(ok)).toBe(ok);
    expect(coherentSystem({ finish: "clasica", foundation: "platea", roofType: "dos" })).toEqual({ finish: "clasica", foundation: "platea", roofType: "plano" });
    expect(coherentSystem({ finish: "esencial", foundation: "madera", roofType: "plano" })).toEqual({ finish: "esencial", foundation: "hormigon", roofType: "una" });
    expect(coherentSystem({ finish: "moderna", foundation: "platea", roofType: "plano" })).toEqual({ finish: "moderna", foundation: "hormigon", roofType: "plano" });
  });

  it("pasar a Tradicional elige Esencial y conserva lo compatible; volver a Woodframe elige Rústica", () => {
    const wood = { finish: "allwood", foundation: "madera", roofType: "dos" } as const;
    expect(systemPatch(wood, "woodframe")).toEqual({});
    expect(systemPatch(wood, "tradicional")).toEqual({ finish: DEFAULT_FINISH.tradicional, foundation: "hormigon", roofType: "dos" });
    const trad = { finish: "clasica", foundation: "platea", roofType: "plano" } as const;
    expect(systemPatch(trad, "tradicional")).toEqual({});
    expect(systemPatch(trad, "woodframe")).toEqual({ finish: DEFAULT_FINISH.woodframe, foundation: "hormigon", roofType: "plano" });
  });
});
