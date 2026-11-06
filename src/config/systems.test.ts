import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINISH,
  DEFAULT_FOUNDATION,
  FINISHES_BY_SYSTEM,
  FOUNDATIONS_BY_SYSTEM,
  PLATEA_HEIGHT,
  TRADICIONAL_MAX_PITCH,
  allowedRoofs,
  coherentSystem,
  exteriorThickness,
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

  it("Woodframe va sobre pilotes y Tradicional sobre platea (por defecto) o pilotes de hormigón", () => {
    expect(FOUNDATIONS_BY_SYSTEM.woodframe).toEqual(["hormigon", "madera"]);
    expect(FOUNDATIONS_BY_SYSTEM.tradicional).toEqual(["platea", "hormigon"]);
    expect(DEFAULT_FOUNDATION.tradicional).toBe("platea");
    expect(FOUNDATIONS_BY_SYSTEM.tradicional[0]).toBe(DEFAULT_FOUNDATION.tradicional);
    expect(PLATEA_HEIGHT).toBeGreaterThan(0);
  });

  it("el muro exterior de mampostería es más grueso que el de woodframe", () => {
    expect(exteriorThickness("rustica")).toBe(0.15);
    expect(exteriorThickness("esencial")).toBe(0.2);
    expect(exteriorThickness("clasica")).toBe(0.2);
  });

  it("Esencial lleva techo de chapa (una caída o doble agua) y Clásica, losa plana", () => {
    expect(allowedRoofs("esencial")).toEqual(["una", "dos"]);
    expect(allowedRoofs("clasica")).toEqual(["plano"]);
    for (const finish of FINISHES_BY_SYSTEM.woodframe)
      expect(allowedRoofs(finish)).toEqual(["una", "dos", "plano"]);
  });

  it("adapta base y techo a la terminación sin tocar lo que ya corresponde", () => {
    const ok = { finish: "rustica", foundation: "madera", roofType: "dos" } as const;
    expect(coherentSystem(ok)).toBe(ok);
    expect(coherentSystem({ finish: "clasica", foundation: "platea", roofType: "dos" })).toEqual({
      finish: "clasica",
      foundation: "platea",
      roofType: "plano",
    });
    expect(coherentSystem({ finish: "esencial", foundation: "madera", roofType: "plano" })).toEqual(
      { finish: "esencial", foundation: "platea", roofType: "una" },
    );
    // Los pilotes de hormigón también valen en tradicional: no se pisan.
    const pilotes = { finish: "clasica", foundation: "hormigon", roofType: "plano" } as const;
    expect(coherentSystem(pilotes)).toBe(pilotes);
    expect(coherentSystem({ finish: "moderna", foundation: "platea", roofType: "plano" })).toEqual({
      finish: "moderna",
      foundation: "hormigon",
      roofType: "plano",
    });
  });

  it("pasar a Tradicional elige Esencial y conserva lo compatible; volver a Woodframe elige Rústica", () => {
    const wood = { finish: "allwood", foundation: "madera", roofType: "dos" } as const;
    expect(systemPatch(wood, "woodframe")).toEqual({});
    expect(systemPatch(wood, "tradicional")).toEqual({
      finish: DEFAULT_FINISH.tradicional,
      foundation: "platea",
      roofType: "dos",
    });
    // Todo diseño tradicional arranca con platea, aunque venga de pilotes de hormigón, y con un techo de chapa bajo.
    const pilotes = {
      finish: "moderna",
      foundation: "hormigon",
      roofType: "una",
      roofPitch: 20,
    } as const;
    expect(systemPatch(pilotes, "tradicional")).toEqual({
      finish: DEFAULT_FINISH.tradicional,
      foundation: "platea",
      roofType: "una",
      roofPitch: TRADICIONAL_MAX_PITCH,
    });
    expect(systemPatch({ ...pilotes, roofPitch: 6 }, "tradicional")).not.toHaveProperty(
      "roofPitch",
    );
    const trad = { finish: "clasica", foundation: "platea", roofType: "plano" } as const;
    expect(systemPatch(trad, "tradicional")).toEqual({});
    expect(systemPatch(trad, "woodframe")).toEqual({
      finish: DEFAULT_FINISH.woodframe,
      foundation: "hormigon",
      roofType: "plano",
    });
    expect(systemPatch({ ...trad, foundation: "hormigon" }, "woodframe").foundation).toBe(
      "hormigon",
    );
  });
});
