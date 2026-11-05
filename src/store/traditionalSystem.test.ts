import { beforeEach, describe, expect, it } from "vitest";
import {
  decodeDesign,
  encodeDesign,
  floorBase,
  initialConfig,
  useConfigurator,
} from "./useConfigurator";
import { configPrice, configWhatsAppText } from "@/config/pricing";
import { GEOMETRY } from "@/config/geometry";
import { PLATEA_HEIGHT, systemPatch } from "@/config/systems";

const reset = () => useConfigurator.setState({ config: initialConfig(), past: [], future: [], selectedId: null, error: null });
const config = () => useConfigurator.getState().config;

describe("diseñador 3D con construcción tradicional", () => {
  beforeEach(reset);

  it("cambiar de sistema conserva el diseño y adapta terminación, base y techo", () => {
    const before = config();
    useConfigurator.getState().update(systemPatch(before, "tradicional"));
    const after = config();
    expect(after.finish).toBe("esencial");
    expect(after.foundation).toBe("hormigon"); // los pilotes de madera son solo de woodframe
    expect(after.roofType).toBe("dos"); // la chapa de Esencial admite doble agua
    expect(JSON.stringify(after.walls)).toBe(JSON.stringify(before.walls));
    expect(JSON.stringify(after.openings)).toBe(JSON.stringify(before.openings));
    expect(JSON.stringify(after.counters)).toBe(JSON.stringify(before.counters));
    expect(after.m2).toBe(before.m2);
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
    expect(configPrice({ ...c, finish: "esencial", foundation: "platea", roofType: "una" }).total).toBe(48 * 1300);
    expect(configPrice({ ...c, finish: "clasica", foundation: "hormigon", roofType: "plano" }).total).toBe(48 * 1500);
  });

  it("el mensaje de WhatsApp describe la vivienda tradicional", () => {
    const text = configWhatsAppText({
      ...initialConfig(), finish: "clasica", foundation: "platea", roofType: "plano", extraOpenings: 0, openings: 5,
      logistics: { zoneId: "local", separateTrip: false },
    });
    for (const part of ["construcción tradicional", "CLÁSICA", "platea de hormigón", "Losa de hormigón", "USD 72.000"]) expect(text).toContain(part);
  });

  it("un diseño tradicional se guarda y se vuelve a abrir desde el link", () => {
    const c = { ...initialConfig(), finish: "clasica" as const, foundation: "platea" as const, roofType: "plano" as const };
    expect(decodeDesign(encodeDesign(c))).toEqual(c);
  });

  it("un link con base o techo incompatibles se corrige en vez de descartarse", () => {
    const c = { ...initialConfig(), finish: "clasica" as const, foundation: "madera" as const, roofType: "dos" as const };
    const decoded = decodeDesign(encodeDesign(c));
    expect(decoded?.finish).toBe("clasica");
    expect(decoded?.foundation).toBe("hormigon");
    expect(decoded?.roofType).toBe("plano");
  });

  it("los diseños viejos de woodframe se abren igual", () => {
    const c = { ...initialConfig(), finish: "allwood" as const };
    expect(decodeDesign(encodeDesign(c))).toEqual(c);
  });
});
