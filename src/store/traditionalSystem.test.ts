import { beforeEach, describe, expect, it } from "vitest";
import {
  decodeDesign,
  designWalls,
  encodeDesign,
  floorBase,
  initialConfig,
  useConfigurator,
} from "./useConfigurator";
import { configPrice, configWhatsAppText } from "@/config/pricing";
import { GEOMETRY } from "@/config/geometry";
import { PLATEA_HEIGHT, TRADICIONAL_MAX_PITCH, systemPatch } from "@/config/systems";

const reset = () =>
  useConfigurator.setState({
    config: initialConfig(),
    past: [],
    future: [],
    selectedId: null,
    error: null,
  });
const config = () => useConfigurator.getState().config;

describe("diseñador 3D con construcción tradicional", () => {
  beforeEach(reset);

  it("cambiar de sistema conserva el diseño y adapta terminación, base y techo", () => {
    const before = config();
    useConfigurator.getState().update(systemPatch(before, "tradicional"));
    const after = config();
    expect(after.finish).toBe("esencial");
    expect(after.foundation).toBe("platea"); // todo diseño tradicional arranca con platea
    expect(after.roofType).toBe("dos"); // la chapa de Esencial admite doble agua
    expect(after.roofPitch).toBe(TRADICIONAL_MAX_PITCH); // y con un techo de chapa bajo (en woodframe arranca en 20°)
    expect(JSON.stringify(after.walls)).toBe(JSON.stringify(before.walls));
    // las aberturas siguen en el mismo lugar (el store solo limpia ruido de decimales de las posiciones)
    expect(after.openings.map((o) => [o.id, o.wall, o.type, o.floor])).toEqual(
      before.openings.map((o) => [o.id, o.wall, o.type, o.floor]),
    );
    after.openings.forEach((o, i) =>
      expect(o.offset).toBeCloseTo(before.openings[i]?.offset ?? NaN, 6),
    );
    expect(JSON.stringify(after.counters)).toBe(JSON.stringify(before.counters));
    expect(after.m2).toBe(before.m2);
  });

  it("pasar a una terminación tradicional por cualquier camino deja la platea", () => {
    useConfigurator.getState().update({ finish: "clasica" });
    expect(config().foundation).toBe("platea");
    reset();
    useConfigurator.getState().update({ foundation: "hormigon" });
    useConfigurator.getState().update({ finish: "esencial" });
    expect(config().foundation).toBe("platea");
  });

  it("dentro de tradicional se puede elegir pilotes de hormigón y esa elección se respeta", () => {
    useConfigurator.getState().update({ finish: "esencial" });
    useConfigurator.getState().update({ foundation: "hormigon" });
    useConfigurator.getState().update({ finish: "clasica" });
    useConfigurator.getState().update({ m2: 60 });
    expect(config().foundation).toBe("hormigon");
  });

  it("el muro exterior es más grueso en tradicional y los interiores no cambian", () => {
    const wood = designWalls(config(), 0);
    useConfigurator.getState().update({ finish: "esencial" });
    const trad = designWalls(config(), 0);
    const edges = (walls: typeof wood) => walls.filter((w) => w.id.startsWith("edge-"));
    expect(edges(wood).every((w) => w.thickness === 0.15)).toBe(true);
    expect(edges(trad).every((w) => w.thickness === 0.2)).toBe(true);
    const inner = (walls: typeof wood) =>
      walls.filter((w) => !w.id.startsWith("edge-")).map((w) => w.thickness);
    expect(inner(trad)).toEqual(inner(wood));
  });

  it("la Clásica fuerza losa plana y volver a Esencial deja un techo de chapa", () => {
    useConfigurator.getState().update({ finish: "clasica" });
    expect(config().roofType).toBe("plano");
    useConfigurator.getState().update({ finish: "esencial" });
    expect(config().roofType).toBe("una");
  });

  it("no deja elegir un techo que la terminación no admite", () => {
    useConfigurator.getState().update({ finish: "clasica" });
    useConfigurator.getState().update({ roofType: "dos" });
    expect(config().roofType).toBe("plano");
  });

  it("la platea apoya casi al ras del terreno; los pilotes, a la altura elegida", () => {
    useConfigurator.getState().update({ finish: "esencial", foundation: "platea" });
    expect(floorBase(config())).toBeCloseTo(PLATEA_HEIGHT + GEOMETRY.slabThickness);
    useConfigurator.getState().update({ foundation: "hormigon" });
    expect(floorBase(config())).toBeCloseTo(config().pileHeight + GEOMETRY.slabThickness);
  });

  it("el precio sale de las tarifas del cotizador y no cambia con la base ni el techo", () => {
    const c = { ...initialConfig(), extraOpenings: 0 };
    expect(
      configPrice({ ...c, finish: "esencial", foundation: "platea", roofType: "una" }).total,
    ).toBe(48 * 1200);
    expect(
      configPrice({ ...c, finish: "clasica", foundation: "hormigon", roofType: "plano" }).total,
    ).toBe(48 * 1400);
  });

  it("el mensaje de WhatsApp describe la vivienda tradicional", () => {
    const text = configWhatsAppText({
      ...initialConfig(),
      finish: "clasica",
      foundation: "platea",
      roofType: "plano",
      extraOpenings: 0,
      openings: 5,
      logistics: { zoneId: "local", separateTrip: false },
    });
    for (const part of [
      "construcción tradicional",
      "CLÁSICA",
      "platea de hormigón",
      "Losa de hormigón",
      "USD 67.200",
    ])
      expect(text).toContain(part);
  });

  it("un diseño tradicional se guarda y se vuelve a abrir desde el link", () => {
    const c = {
      ...initialConfig(),
      finish: "clasica" as const,
      foundation: "platea" as const,
      roofType: "plano" as const,
    };
    const decoded = decodeDesign(encodeDesign(c));
    expect(decoded?.finish).toBe("clasica");
    expect(decoded?.foundation).toBe("platea");
    expect(decoded?.roofType).toBe("plano");
    expect(decoded?.m2).toBe(c.m2);
    expect(decoded?.contour).toEqual(c.contour);
    // abrirlo y volver a guardarlo no cambia nada
    expect(decoded && decodeDesign(encodeDesign(decoded))).toEqual(decoded);
  });

  it("un link con base o techo incompatibles se corrige en vez de descartarse", () => {
    const c = {
      ...initialConfig(),
      finish: "clasica" as const,
      foundation: "madera" as const,
      roofType: "dos" as const,
    };
    const decoded = decodeDesign(encodeDesign(c));
    expect(decoded?.finish).toBe("clasica");
    expect(decoded?.foundation).toBe("platea");
    expect(decoded?.roofType).toBe("plano");
  });

  it("los diseños viejos de woodframe se abren igual", () => {
    const c = { ...initialConfig(), finish: "allwood" as const };
    const decoded = decodeDesign(encodeDesign(c));
    expect(decoded?.finish).toBe("allwood");
    expect(decoded?.foundation).toBe(c.foundation);
    expect(decoded?.roofType).toBe(c.roofType);
    expect(decoded && decodeDesign(encodeDesign(decoded))).toEqual(decoded);
  });
});
