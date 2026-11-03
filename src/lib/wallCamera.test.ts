import { describe, expect, it } from "vitest";
import { EL_MAX, EL_MIN, VIEW_POSES, cameraPosition, clampDistance, clampElevation, fitDistance, shortestAngle } from "./wallCamera";
import { VIEWS } from "./wallState";
import { buildWall, explodedBounds } from "./wallModel";

describe("cámara del visor de paredes", () => {
  it("hay una pose para cada vista del selector", () => {
    for (const v of VIEWS) expect(VIEW_POSES[v.id] !== undefined).toBe(true);
  });

  it("la cámara nunca queda por debajo del piso, en ninguna vista ni con elevaciones extremas", () => {
    for (const v of VIEWS) {
      const p = cameraPosition([0, 1, 0], VIEW_POSES[v.id].az, VIEW_POSES[v.id].el, 6);
      expect(p[1]).toBeGreaterThan(1);
    }
    expect(clampElevation(-1)).toBe(EL_MIN);
    expect(clampElevation(5)).toBe(EL_MAX);
    expect(cameraPosition([0, 1, 0], 0.3, -2, 5)[1]).toBeGreaterThan(1);
  });

  it("las vistas miran desde el lado correcto (frente: exterior +z; interior: −z; lateral: +x)", () => {
    const at = (id: keyof typeof VIEW_POSES) => cameraPosition([0, 1, 0], VIEW_POSES[id].az, VIEW_POSES[id].el, 8);
    expect(at("frente")[2]).toBeGreaterThan(7);
    expect(at("interior")[2]).toBeLessThan(-7);
    expect(at("lateral")[0]).toBeGreaterThan(7);
    expect(at("planta")[1]).toBeGreaterThan(8);
  });

  it("la distancia de cámara es la pedida", () => {
    const p = cameraPosition([1, 2, 3], 0.7, 0.3, 5);
    expect(Math.hypot(p[0] - 1, p[1] - 2, p[2] - 3)).toBeCloseTo(5, 9);
  });

  it("el encuadre crece con el radio y en pantallas angostas se aleja más", () => {
    expect(fitDistance(3, 32, 1.6)).toBeGreaterThan(fitDistance(2, 32, 1.6));
    expect(fitDistance(3, 32, 0.5)).toBeGreaterThan(fitDistance(3, 32, 1.6));
  });

  it("un objeto del radio pedido entra en el cuadro a la distancia calculada", () => {
    const d = fitDistance(2, 32, 1.5);
    expect(Math.asin(2 / d)).toBeLessThanOrEqual((32 * Math.PI) / 180 / 2 + 1e-9);
  });

  it("el giro entre vistas toma el camino más corto", () => {
    expect(shortestAngle(0.1, 6.2)).toBeCloseTo(6.2 - 0.1 - Math.PI * 2, 9);
    expect(shortestAngle(3, -3)).toBeCloseTo(2 * Math.PI - 6, 9);
    expect(Math.abs(shortestAngle(0, Math.PI))).toBeCloseTo(Math.PI, 9);
  });

  it("el zoom se limita entre un mínimo y un máximo", () => {
    expect(clampDistance(0.1, 1.2, 16)).toBe(1.2);
    expect(clampDistance(99, 1.2, 16)).toBe(16);
    expect(clampDistance(5, 1.2, 16)).toBe(5);
  });

  it("explotada, la pared ocupa más espacio que armada (la cámara debe alejarse)", () => {
    for (const system of ["woodframe", "tradicional"] as const) {
      const m = buildWall(system);
      const a = explodedBounds(m, 0), b = explodedBounds(m, 1);
      expect(b.max[2] - b.min[2] + b.max[1] - b.min[1] + b.max[0] - b.min[0]).toBeGreaterThan(a.max[2] - a.min[2] + a.max[1] - a.min[1] + a.max[0] - a.min[0] + 0.5);
      expect(Math.abs(a.min[0] - m.min[0])).toBeLessThan(1e-9);
      expect(Math.abs(a.max[2] - m.max[2])).toBeLessThan(1e-9);
    }
  });
});
