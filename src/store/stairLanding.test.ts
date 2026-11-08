import { describe, expect, it } from "vitest";
import { presetPolygon } from "@/config/geometry";
import { initialConfig, stairLanding, suggestedLayout, type HouseConfig } from "./useConfigurator";

const house = (floors: number, m2: number, elongated: boolean): HouseConfig => ({
  ...initialConfig(),
  floors,
  shape: elongated ? "alargada" : "compacta",
  contour: presetPolygon("rectangular", m2 / floors, elongated),
  m2,
  walls: [],
  fixtures: [],
  counters: [],
  stairs: [],
  openings: [],
});

describe("las escaleras de la distribución sugerida no suben de cara a una pared", () => {
  for (const floors of [2, 3])
    for (const m2 of [60, 90, 120, 160, 200, 300, 400, 500])
      for (const elongated of [false, true])
        it(`${floors} plantas, ${m2} m², ${elongated ? "alargada" : "compacta"}`, () => {
          const c = suggestedLayout(house(floors, m2, elongated));
          const stairs = c.stairs.filter((s) => !s.exterior);
          expect(stairs).toHaveLength(floors - 1);
          for (const s of stairs) {
            const l = stairLanding(c, s);
            // La entrada y la salida tienen al menos 1 m libre (una caracol sale en cualquier dirección).
            expect(l.entry, `entrada de ${s.id}`).toBeGreaterThanOrEqual(1);
            expect(l.exit, `salida de ${s.id}`).toBeGreaterThanOrEqual(1);
          }
        });

  it("una escalera con el extremo contra una pared da un descanso casi nulo", () => {
    const c = suggestedLayout(house(2, 120, false)),
      s = c.stairs.find((v) => !v.exterior)!;
    // Girada media vuelta contra el muro más cercano: la entrada queda pegada a la pared.
    const bad = { ...s, rotation: s.rotation + Math.PI, x: s.x, z: s.z };
    const l1 = stairLanding(c, s),
      l2 = stairLanding(c, bad);
    expect(Math.min(l1.entry, l1.exit)).toBeGreaterThanOrEqual(1);
    expect(Math.min(l2.entry, l2.exit)).toBeLessThan(1.6);
  });
});
