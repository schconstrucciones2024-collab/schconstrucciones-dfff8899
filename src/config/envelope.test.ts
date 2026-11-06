import { describe, expect, it } from "vitest";
import { ENVELOPE, buildEnvelope, type EnvelopeInput, type EnvelopePart } from "./envelope";
import { presetPolygon } from "./geometry";

const base: EnvelopeInput = {
  contour: presetPolygon("rectangular", 48),
  finish: "clasica",
  thickness: 0.2,
  floors: 1,
  groundTop: 0.1,
  floorBase: 0.3,
  floorStep: 2.85,
  wallHeight: 2.65,
  slabThickness: 0.2,
  roofType: "plano",
  roofPitch: 8,
  roofDirection: "x",
  overhang: 0.25,
};
const ids = (parts: EnvelopePart[]) => parts.map((p) => p.id).sort();
const box = (p: EnvelopePart | undefined) => {
  p?.geometry.computeBoundingBox();
  return p?.geometry.boundingBox;
};
const part = (parts: EnvelopePart[], id: string) => parts.find((p) => p.id === id);
const top = base.floorBase + base.wallHeight;

describe("envolvente de la construcción tradicional", () => {
  it("la Clásica es una losa plana con antepecho, remate, membrana y bajada, sin techo de chapa", () => {
    const parts = buildEnvelope(base);
    expect(ids(parts)).toEqual(["antepecho", "bajadas", "losa", "membrana", "remate", "zocalo"]);
    const E = ENVELOPE;
    expect(box(part(parts, "remate"))?.max.y).toBeCloseTo(
      top + E.slab + E.parapetHeight + E.copingHeight,
    );
    // el antepecho está por encima de la membrana, que es plana
    const deck = box(part(parts, "membrana"));
    expect(deck?.max.y).toBeCloseTo(deck?.min.y ?? NaN);
    expect(box(part(parts, "antepecho"))?.max.y).toBeGreaterThan(deck?.max.y ?? Infinity);
  });

  it("el zócalo va de la base al piso terminado más unos centímetros y sobresale del muro", () => {
    const z = box(part(buildEnvelope(base), "zocalo"));
    expect(z?.min.y).toBeCloseTo(base.groundTop);
    expect(z?.max.y).toBeCloseTo(base.floorBase + ENVELOPE.plinthHeight);
    const b = box(part(buildEnvelope({ ...base, contour: base.contour }), "losa"));
    const xs = base.contour.map((p) => p.x);
    // la cornisa de la losa sobresale de la cara exterior del muro (eje + 0,10 m)
    expect((b?.max.x ?? 0) - Math.max(...xs)).toBeCloseTo(0.1 + ENVELOPE.slabProjection);
  });

  it("la Esencial lleva chapa con frontones, cenefa, canaleta y bajada; sin losa ni antepecho", () => {
    for (const roofType of ["una", "dos"] as const) {
      const parts = buildEnvelope({ ...base, finish: "esencial", roofType });
      expect(ids(parts)).toEqual(["bajadas", "canaleta", "cenefa", "chapa", "frontones", "zocalo"]);
      expect(box(part(parts, "chapa"))?.max.y).toBeGreaterThan(top);
    }
  });

  it("la doble agua también se arma en una planta en L", () => {
    const parts = buildEnvelope({
      ...base,
      finish: "esencial",
      roofType: "dos",
      contour: presetPolygon("L", 60),
    });
    expect(ids(parts)).toContain("chapa");
    expect(ids(parts)).toContain("cenefa");
    expect(box(part(parts, "chapa"))?.max.y).toBeGreaterThan(top);
  });

  it("las cintas entre plantas aparecen solo con más de una planta y a la altura del entrepiso", () => {
    expect(ids(buildEnvelope(base))).not.toContain("cintas");
    const parts = buildEnvelope({ ...base, floors: 2 });
    const cintas = box(part(parts, "cintas"));
    expect(cintas?.max.y).toBeCloseTo(base.floorBase + base.floorStep);
    expect(cintas?.min.y).toBeCloseTo(base.floorBase + base.floorStep - base.slabThickness);
    // con dos plantas el techo sube una planta
    expect(box(part(parts, "remate"))?.max.y).toBeGreaterThan(
      (box(part(buildEnvelope(base), "remate"))?.max.y ?? 0) + 2.8,
    );
  });

  it("todas las geometrías son válidas: posición, normal y UV, sin valores NaN", () => {
    const cases: EnvelopeInput[] = [
      base,
      { ...base, floors: 3, contour: presetPolygon("U", 80) },
      { ...base, finish: "esencial", roofType: "una", roofDirection: "z" },
      { ...base, finish: "esencial", roofType: "dos", contour: presetPolygon("T", 70), floors: 2 },
    ];
    for (const input of cases)
      for (const p of buildEnvelope(input)) {
        for (const name of ["position", "normal", "uv"])
          expect(p.geometry.getAttribute(name), `${p.id}:${name}`).toBeDefined();
        const pos = p.geometry.getAttribute("position").array as ArrayLike<number>;
        expect(pos.length).toBeGreaterThan(0);
        expect(Array.from(pos).every(Number.isFinite), p.id).toBe(true);
      }
  });
});
