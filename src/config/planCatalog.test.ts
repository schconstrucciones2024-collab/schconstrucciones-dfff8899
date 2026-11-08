import { describe, expect, it } from "vitest";
import { PLAN_CATALOG, planFloors, planShape, plansFor, recommendedPlan } from "./layoutProposals";
import { issuesFor } from "./planChecks";

describe("catálogo de distribuciones", () => {
  it("tiene propuestas para cada sistema, cantidad de plantas y forma", () => {
    for (const system of ["woodframe", "tradicional"] as const)
      for (const floors of [1, 2, 3])
        for (const shape of ["rectangular", "L"] as const) {
          expect(
            plansFor(system, floors, shape).length,
            `${system} ${floors} plantas ${shape}`,
          ).toBeGreaterThan(0);
          expect(recommendedPlan(system, floors, shape)).toBeDefined();
        }
  });
  it("los identificadores son únicos y cada sistema tiene más de cuatro propuestas", () => {
    expect(new Set(PLAN_CATALOG.map((p) => p.id)).size).toBe(PLAN_CATALOG.length);
    expect(plansFor("woodframe").length).toBeGreaterThan(4);
    expect(plansFor("tradicional").length).toBeGreaterThan(4);
  });
  it("cada sistema ofrece al menos veinte distribuciones, con variedad de plantas y formas", () => {
    for (const system of ["woodframe", "tradicional"] as const) {
      expect(plansFor(system).length, system).toBeGreaterThanOrEqual(20);
      expect(plansFor(system, 1).length, `${system} 1 planta`).toBeGreaterThanOrEqual(10);
      expect(plansFor(system, 2).length, `${system} 2 plantas`).toBeGreaterThanOrEqual(5);
      expect(plansFor(system, undefined, "L").length, `${system} en L`).toBeGreaterThanOrEqual(5);
    }
  });
  it("las propuestas tradicionales son distintas de las de woodframe", () => {
    const wood = new Set(plansFor("woodframe").map((p) => p.id));
    expect(plansFor("tradicional").every((p) => !wood.has(p.id))).toBe(true);
  });
  for (const plan of PLAN_CATALOG.filter((p) => p.version === 2))
    it(`${plan.name} (${plan.system}, ${planFloors(plan)} pl., ${planShape(plan)}): proyecto válido`, () => {
      expect(issuesFor(plan)).toEqual([]);
    });
});
