import { describe, expect, it } from "vitest";
import { SYSTEMS, type SystemId } from "./wallSystems";

/** Todas las combinaciones de opciones de un sistema. */
function combos(system: SystemId): Record<string, string>[] {
  return SYSTEMS[system].options.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.key]: v.value }))),
    [{}],
  );
}

describe("fichas de capas de los sistemas constructivos", () => {
  for (const id of ["woodframe", "tradicional"] as SystemId[]) {
    it(`${id}: toda capa, con cualquier opción, explica qué es, para qué sirve y qué aporta`, () => {
      for (const options of combos(id)) {
        for (const layer of SYSTEMS[id].layers(options)) {
          for (const field of ["name", "short", "description", "role", "benefit", "material", "texture"] as const) {
            expect(layer[field].trim().length, `${layer.id}.${field}`).toBeGreaterThan(field === "name" ? 3 : 10);
          }
          expect(layer.benefit, layer.id).not.toBe(layer.role);
        }
      }
    });

    it(`${id}: las fichas no prometen cifras ni prestaciones técnicas`, () => {
      const text = combos(id).flatMap((o) => SYSTEMS[id].layers(o)).map((l) => l.benefit).join(" ");
      expect(text).not.toMatch(/\d|mm\b|cm\b|kg\b|R-?\d|norma|certific/i);
    });
  }

  it("el beneficio de la terminación cambia con la opción elegida", () => {
    const interior = (value: string) => SYSTEMS.woodframe.layers({ interior: value }).find((l) => l.id === "interior")!.benefit;
    expect(new Set(["yeso", "chaponPino", "chaponEucalipto", "machimbre"].map(interior)).size).toBe(4);
    const exterior = (value: string) => SYSTEMS.woodframe.layers({ exterior: value }).find((l) => l.id === "exterior")!.benefit;
    expect(new Set(["siding", "tablas", "chapa"].map(exterior)).size).toBe(3);
  });
});
