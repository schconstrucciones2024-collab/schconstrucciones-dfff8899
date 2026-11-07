import { describe, expect, it } from "vitest";
import { buildEnvelope } from "./envelope";
import { bounds, isOrthogonal, polygonArea, roofFaces } from "./geometry";
import { PLAN_CATALOG, planFloors } from "./layoutProposals";

/** Contorno de cada propuesta, centrado como lo deja el store. */
const contours = (plans: typeof PLAN_CATALOG) =>
  plans.map((p) => {
    const outline = p.contour ?? [
      { x: 0, z: 0 },
      { x: p.width, z: 0 },
      { x: p.width, z: p.depth },
      { x: 0, z: p.depth },
    ];
    return {
      id: p.id,
      contour: outline.map((v) => ({ x: v.x - p.width / 2, z: v.z - p.depth / 2 })),
    };
  });

describe("envolvente tradicional sobre los contornos de las distribuciones", () => {
  for (const { id, contour } of contours(PLAN_CATALOG.filter((p) => p.system === "tradicional"))) {
    const plan = PLAN_CATALOG.find((p) => p.id === id)!;
    it(`${id}: techo, losa y muros se arman para cada terminación y dirección`, () => {
      const b = bounds(contour);
      const cases = [
        { finish: "esencial" as const, roofType: "una" as const },
        { finish: "esencial" as const, roofType: "dos" as const },
        { finish: "clasica" as const, roofType: "plano" as const },
      ];
      for (const k of cases)
        for (const roofDirection of ["x", "z"] as const) {
          const parts = buildEnvelope({
            contour,
            finish: k.finish,
            thickness: 0.2,
            floors: planFloors(plan),
            groundTop: 0.1,
            floorBase: 0.3,
            floorStep: 2.85,
            wallHeight: 2.65,
            slabThickness: 0.2,
            roofType: k.roofType,
            roofPitch: 8,
            roofDirection,
            overhang: 0.25,
          });
          expect(parts.length).toBeGreaterThan(0);
          for (const p of parts) {
            const pos = p.geometry.getAttribute("position");
            expect(pos.count).toBeGreaterThan(0);
            for (let i = 0; i < pos.array.length; i++)
              expect(Number.isFinite(pos.array[i])).toBe(true);
          }
          const cover = parts.find((p) => p.id === "chapa" || p.id === "losa");
          cover?.geometry.computeBoundingBox();
          const bb = cover?.geometry.boundingBox;
          // la cubierta cubre toda la huella de la casa
          expect(bb?.min.x ?? Infinity).toBeLessThan(b.minX + 1e-6);
          expect(bb?.max.x ?? -Infinity).toBeGreaterThan(b.maxX - 1e-6);
          expect(bb?.min.z ?? Infinity).toBeLessThan(b.minZ + 1e-6);
          expect(bb?.max.z ?? -Infinity).toBeGreaterThan(b.maxZ - 1e-6);
        }
    });
  }
});

describe("techo a dos aguas sobre los contornos de todas las distribuciones", () => {
  for (const { id, contour } of contours(PLAN_CATALOG))
    it(`${id}: las caras del techo cubren la huella en las dos direcciones`, () => {
      expect(isOrthogonal(contour)).toBe(true);
      for (const direction of ["x", "z"] as const) {
        const faces = roofFaces(contour, direction, Math.tan((20 * Math.PI) / 180));
        expect(faces.length).toBeGreaterThan(0);
        let area = 0;
        for (const f of faces) {
          expect(Object.values(f.plane).every(Number.isFinite)).toBe(true);
          for (const ring of f.rings) expect(ring.length).toBeGreaterThan(2);
          area += polygonArea(f.rings[0] ?? []);
        }
        // las aguas se reparten la planta sin dejar huecos ni solaparse
        expect(area).toBeCloseTo(polygonArea(contour), 3);
      }
    });
});
