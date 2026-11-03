import { describe, it, expect } from "vitest";
import { initialConfig, useConfigurator } from "./useConfigurator";

describe("agregar plantas conserva la planta baja", () => {
  it("al pasar a 2 plantas la planta baja queda igual y se suma otra", () => {
    const c = initialConfig();
    useConfigurator.setState({ config: c, past: [], future: [], selectedId: null, error: null, activeFloor: 0 });
    useConfigurator.getState().update({ floors: 2 });
    const n = useConfigurator.getState().config;
    expect(n.floors).toBe(2);
    expect(n.contour).toEqual(c.contour);
    expect(n.m2).toBeCloseTo(96);
    expect(n.walls[0]).toEqual(c.walls[0]);
    expect(n.fixtures.filter((f) => f.floor === 0)).toEqual(c.fixtures);
  });
});
