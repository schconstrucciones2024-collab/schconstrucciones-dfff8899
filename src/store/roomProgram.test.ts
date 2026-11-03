import { describe, it, expect, beforeEach } from "vitest";
import { initialConfig, resizeConfig, useConfigurator, placedRooms, decodeDesign, encodeDesign } from "./useConfigurator";

const reset = (m2 = 40, floors = 1, shape?: "compacta" | "alargada") =>
  useConfigurator.setState({ config: resizeConfig(initialConfig(), { m2, floors, ...(shape ? { shape } : {}) }), past: [], future: [], selectedId: null, error: null, activeFloor: 0 });

describe("programa de ambientes", () => {
  beforeEach(() => reset());
  it("cada diseño nuevo trae 1 dormitorio y 1 baño", () => {
    const c = initialConfig();
    expect(placedRooms(c)).toEqual({ bedrooms: 1, bathrooms: 1 });
  });
  it("el baño tiene WC, ducha y lavamanos sobre mesada de pino", () => {
    const c = initialConfig();
    expect(c.fixtures.filter((f) => f.kind === "wc")).toHaveLength(1);
    expect(c.fixtures.filter((f) => f.kind === "ducha")).toHaveLength(1);
    const vanity = c.counters.filter((v) => v.kind === "bano");
    expect(vanity).toHaveLength(1);
    expect(vanity[0]!.material).toBe("pino");
  });
  it("el dormitorio tiene solo una cama matrimonial (1,40 m)", () => {
    const camas = initialConfig().fixtures.filter((f) => f.kind === "cama");
    expect(camas).toHaveLength(1);
  });
  it("permite 3 dormitorios y 2 baños con superficie suficiente", () => {
    reset(100, 1, "compacta");
    useConfigurator.getState().setRooms({ bedrooms: 3, bathrooms: 2 });
    expect(placedRooms(useConfigurator.getState().config)).toEqual({ bedrooms: 3, bathrooms: 2 });
  });
  it("limita dormitorios a 1–3 y baños a 1–2", () => {
    useConfigurator.getState().setRooms({ bedrooms: 5, bathrooms: 4 });
    const c = useConfigurator.getState().config;
    expect(c.bedrooms).toBe(3);
    expect(c.bathrooms).toBe(2);
  });
  it("en 40 m² informa que entran menos ambientes de los pedidos", () => {
    useConfigurator.getState().setRooms({ bedrooms: 3, bathrooms: 2 });
    const p = placedRooms(useConfigurator.getState().config);
    expect(p.bedrooms).toBeLessThan(3);
  });
  it("los muebles se mueven y se guardan en el diseño compartido", () => {
    const cama = useConfigurator.getState().config.fixtures.find((f) => f.kind === "cama")!;
    useConfigurator.getState().editFixture(cama.id, { x: cama.x + 0.5 });
    const c = useConfigurator.getState().config;
    expect(c.fixtures.find((f) => f.id === cama.id)!.x).toBeCloseTo(cama.x + 0.5);
    expect(decodeDesign(encodeDesign(c))).toEqual(c);
  });
});
