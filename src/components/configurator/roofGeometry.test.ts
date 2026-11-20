import { describe, expect, it } from "vitest";
import { PLAN_CATALOG } from "@/config/layoutProposals";
import { distance, offsetContour, project } from "@/config/geometry";
import { exteriorThickness } from "@/config/systems";
import { buildLayoutProposal, initialConfig } from "@/store/useConfigurator";
import { buildRoofGeometry } from "./roofGeometry";

const ROOFS = ["una", "dos", "plano"] as const;

describe("techo de chapa y frontones de las casas livianas", () => {
  const plans = PLAN_CATALOG.filter((p) => p.version === 2 && (p.system ?? "woodframe") === "woodframe");

  it("hay faldones válidos en las tres formas de techo, en todas las distribuciones", () => {
    for (const plan of plans)
      for (const roofType of ROOFS)
        for (const roofDirection of ["x", "z"] as const) {
          const c = { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType, roofDirection },
            { g } = buildRoofGeometry(c),
            pos = g.getAttribute("position");
          expect(pos.count, `${plan.id} ${roofType}/${roofDirection}`).toBeGreaterThan(0);
          expect(pos.count % 3).toBe(0);
          for (let i = 0; i < pos.count; i++) {
            expect(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i))).toBe(true);
            // el alero baja un poco por debajo del borde del muro, pero nunca medio metro
            expect(pos.getY(i)).toBeGreaterThan(-0.5);
          }
        }
  });

  it("el muro bajo el techo (frontón) queda a ras de la cara exterior del muro de la casa: no se nota una pared más angosta", () => {
    const bad: string[] = [];
    for (const plan of plans)
      for (const roofType of ROOFS) {
        const c = { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType },
          half = exteriorThickness(c.finish) / 2,
          outer = offsetContour(c.contour, half),
          { ends } = buildRoofGeometry(c),
          pos = ends.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const p = { x: pos.getX(i), z: pos.getZ(i) },
            onFace = outer.some((a, k) => {
              const b = outer[(k + 1) % outer.length]!;
              return distance(project(p, a, b).point, p) < 1e-4;
            });
          if (!onFace) {
            bad.push(`${plan.id} ${roofType}: un vértice del frontón está fuera de la cara exterior del muro`);
            break;
          }
        }
      }
    expect(bad).toEqual([]);
  });

  it("a dos aguas hay frontones en los dos extremos de una casa rectangular", () => {
    const plan = plans.find((p) => p.footprint === "rectangular")!,
      c = { ...buildLayoutProposal(initialConfig("woodframe"), plan), roofType: "dos" as const, roofDirection: "x" as const },
      { ends } = buildRoofGeometry(c);
    // un frontón es un triángulo (3 vértices) por cada extremo
    expect(ends.getAttribute("position").count).toBeGreaterThanOrEqual(6);
  });
});
