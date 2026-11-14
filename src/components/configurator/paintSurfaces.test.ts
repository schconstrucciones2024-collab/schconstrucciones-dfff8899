import { beforeEach, describe, expect, it } from "vitest";
import LZString from "lz-string";
import { decodeDesign, encodeDesign, initialConfig, resizeConfig, useConfigurator } from "@/store/useConfigurator";
import { estimatePaintSurfaces, paintIsActive } from "@/config/paint";
import { paintSurfaceDetail, paintSurfacesOf } from "./paintSurfaces";

describe("pintura: m² de pared medidos sobre el diseño", () => {
  it("el diseño inicial tiene pared exterior e interior para pintar", () => {
    const s = paintSurfacesOf(initialConfig());
    expect(s.exterior).toBeGreaterThan(20);
    expect(s.interior).toBeGreaterThan(s.exterior);
  });
  it("más metros, más pared; los huecos de aberturas se descuentan", () => {
    const small = paintSurfacesOf(resizeConfig(initialConfig(), { m2: 40 }));
    const big = paintSurfacesOf(resizeConfig(initialConfig(), { m2: 90 }));
    expect(big.exterior).toBeGreaterThan(small.exterior);
    expect(big.interior).toBeGreaterThan(small.interior);
    const detail = paintSurfaceDetail(initialConfig());
    expect(detail.openings).toBeGreaterThan(0);
  });
  it("la estimación del cotizador acompaña al diseño: exterior ±15%, interior ±15% con la distribución inicial y nunca menos que ella", () => {
    // El cotizador no conoce la distribución: estima una casa típica con sus tabiques. El diseño inicial trae pocos tabiques,
    // por eso el interior estimado puede ser mayor que el medido (nunca menor) cuando la casa crece.
    for (const [finish, system] of [["moderna", "woodframe"], ["esencial", "tradicional"]] as const) {
      for (const m2 of [48, 60, 90]) {
        const real = paintSurfacesOf(resizeConfig(initialConfig(system), { finish, m2 }));
        const est = estimatePaintSurfaces(m2, system);
        expect(Math.abs(est.exterior - real.exterior) / real.exterior).toBeLessThan(0.15);
        expect(est.interior).toBeGreaterThanOrEqual(real.interior * 0.9);
        if (m2 === 48) expect(Math.abs(est.interior - real.interior) / real.interior).toBeLessThan(0.15);
      }
    }
  });
});

describe("pintura: estado del diseño", () => {
  beforeEach(() => useConfigurator.setState({ config: initialConfig(), past: [], future: [], selectedId: null, error: null }));
  it("arranca apagada", () => {
    expect(paintIsActive(useConfigurator.getState().config.paint)).toBe(false);
  });
  it("setPaint normaliza el color y las manos, y se puede deshacer", () => {
    const s = useConfigurator.getState();
    s.setPaint({ enabled: true, exterior: true, interior: true, coats: 3, exteriorColor: "#AABBCC" });
    const p = useConfigurator.getState().config.paint;
    expect(p.coats).toBe(3);
    expect(p.exteriorColor).toBe("#aabbcc");
    expect(paintIsActive(p)).toBe(true);
    useConfigurator.getState().undo();
    expect(paintIsActive(useConfigurator.getState().config.paint)).toBe(false);
  });
  it("la pintura viaja en el link del diseño", () => {
    useConfigurator.getState().setPaint({ enabled: true, exterior: true, interior: true, coats: 1, exteriorColor: "#336699" });
    const c = useConfigurator.getState().config;
    const back = decodeDesign(encodeDesign(c));
    expect(back?.paint).toMatchObject({ enabled: true, exterior: true, interior: true, coats: 1, exteriorColor: "#336699" });
  });
  it("un link viejo sin pintura se abre con la pintura apagada", () => {
    const { paint: _omit, ...rest } = initialConfig();
    const back = decodeDesign(LZString.compressToEncodedURIComponent(JSON.stringify({ version: 2, config: rest })));
    expect(back).not.toBeNull();
    expect(back ? paintIsActive(back.paint) : true).toBe(false);
  });
});
