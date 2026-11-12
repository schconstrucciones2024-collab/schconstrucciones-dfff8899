import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DECK_LOOK } from "@/config/deck";
import { deckLayout, type DeckBox } from "@/config/deckLayout";
import { boxesGeometry, sheetGeometry } from "./deckMeshes";

const bounds = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

describe("deck 3D: mallas", () => {
  it("una caja biselada mide exactamente lo mismo que una común, pero con más caras", () => {
    const plain: DeckBox = { size: [1, 0.025, 0.14], pos: [2, 0.5, 3] };
    const beveled: DeckBox = { ...plain, bevel: 0.004 };
    const a = bounds(boxesGeometry([plain])!),
      b = bounds(boxesGeometry([beveled])!);
    for (const k of ["x", "y", "z"] as const) {
      expect(b.min[k]).toBeCloseTo(a.min[k], 5);
      expect(b.max[k]).toBeCloseTo(a.max[k], 5);
    }
    expect(boxesGeometry([beveled])!.getAttribute("position").count).toBeGreaterThan(
      boxesGeometry([plain])!.getAttribute("position").count,
    );
  });

  it("se pueden unir cajas comunes y biseladas en una sola geometría, con los UV en metros", () => {
    const g = boxesGeometry([
      { size: [1, 0.1, 0.1], pos: [0, 0, 0] },
      { size: [1, 0.1, 0.1], pos: [0, 1, 0], bevel: 0.01 },
    ])!;
    expect(g).not.toBeNull();
    expect(g.getAttribute("uv").count).toBe(g.getAttribute("position").count);
    expect(bounds(g).max.y).toBeCloseTo(1.05, 5);
  });

  it("una caja demasiado fina para el bisel se dibuja común y no se rompe", () => {
    const g = boxesGeometry([{ size: [1, 0.005, 1], pos: [0, 0, 0], bevel: 0.004 }])!;
    expect(bounds(g).max.y).toBeCloseTo(0.0025, 6);
  });

  it("el deck Premium completo (con tablas biseladas y techo) se arma en mallas válidas", () => {
    const L = deckLayout(
      { width: 6, depth: 3, roofed: true, railFront: true, railLeft: true, railRight: true, steps: true, line: "premium" },
      0.79,
      0,
    );
    for (const boxes of [L.boards, L.frame, L.piles, L.steps, L.rails, L.fascia, L.roof!.posts, L.roof!.planeBoxes, L.roof!.hardware, L.roof!.trim, L.roof!.planeTrim]) {
      const g = boxesGeometry(boxes)!;
      expect(g, "malla").not.toBeNull();
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
    }
  });

  it("la chapa trapezoidal y la acanalada tienen el ancho y la altura de su perfil", () => {
    const trap = bounds(sheetGeometry(4, -3, 0.12)!),
      acan = bounds(sheetGeometry(4, -3, 0.25, DECK_LOOK.premium.chapa)!);
    expect(trap.max.x - trap.min.x).toBeCloseTo(4, 4);
    expect(trap.max.y).toBeCloseTo(0.03, 5);
    expect(acan.max.y).toBeCloseTo(DECK_LOOK.premium.chapa.nervio, 5);
    expect(acan.max.x - acan.min.x).toBeGreaterThan(3.95);
    expect(acan.max.x - acan.min.x).toBeLessThan(4.05);
    expect(acan.max.z).toBeCloseTo(0.25, 5);
  });
});
