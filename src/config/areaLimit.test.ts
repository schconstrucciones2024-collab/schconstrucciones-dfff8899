import { describe, expect, it } from "vitest";
import {
  AREA_CONSULT_TEXT,
  AREA_CONSULT_URL,
  AREA_MAX,
  AREA_MIN,
  clampArea,
} from "@/lib/cotizador";
import { configPrice, RATES } from "./pricing";
import { GEOMETRY, presetPolygon, validateContour } from "./geometry";
import { initialConfig, resizeConfig, suggestedLayout, placedRooms } from "@/store/useConfigurator";

describe("límite de superficie de 500 m²", () => {
  it("el cotizador y el visor usan el mismo límite", () => {
    expect(AREA_MAX).toBe(500);
    expect(GEOMETRY.maxArea).toBe(AREA_MAX);
    expect(GEOMETRY.minArea).toBe(AREA_MIN);
  });

  it("acepta hasta 500 m² y rechaza más, avisando que se consulte a SCH", () => {
    expect(validateContour(presetPolygon("rectangular", 500, false), 1)).toBeNull();
    expect(validateContour(presetPolygon("rectangular", 166, false), 3)).toBeNull();
    const over = validateContour(presetPolygon("rectangular", 501, false), 1);
    expect(over).toMatch(/500/);
    expect(over).toMatch(/SCH/);
  });

  it("el precio no recorta la superficie por debajo de 500 m²", () => {
    const base = initialConfig();
    const p = configPrice({ ...base, m2: 480, extraOpenings: 0 });
    expect(p.base).toBe(480 * RATES[base.finish]);
    expect(configPrice({ ...base, m2: 900, extraOpenings: 0 }).base).toBe(500 * RATES[base.finish]);
  });

  it("el aviso invita a consultar con SCH por WhatsApp", () => {
    expect(AREA_CONSULT_TEXT).toContain("500 m²");
    expect(AREA_CONSULT_TEXT).toContain("SCH");
    expect(AREA_CONSULT_URL.startsWith("https://wa.me/59895564068?text=")).toBe(true);
    expect(clampArea(700)).toBe(500);
  });

  for (const floors of [1, 2, 3])
    for (const m2 of [300, 420, 500])
      it(`el visor arma una casa de ${m2} m² en ${floors} planta(s)`, () => {
        const c = suggestedLayout(resizeConfig(initialConfig(), { m2, floors }));
        expect(c.m2).toBeCloseTo(m2, 3);
        expect(c.floors).toBe(floors);
        expect(validateContour(c.contour, c.floors)).toBeNull();
        expect(placedRooms(c).bedrooms).toBeGreaterThanOrEqual(1);
      });
});
