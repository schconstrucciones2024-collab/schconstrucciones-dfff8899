import { beforeEach, describe, expect, it } from "vitest";
import { NO_LIMITS } from "@/lib/renderQuality";
import { fxOf, useRenderFx } from "./useRenderFx";

const st = () => useRenderFx.getState();
const fresh = () => useRenderFx.setState({ quality: "economico", auto: true, failed: null, initialized: false, limits: NO_LIMITS, notice: null, ao: true, bloom: true, reflections: true, cine: true });

describe("calidad de render (estado)", () => {
  beforeEach(fresh);
  it("arranca en Económico y init lo sube según el equipo, una sola vez", () => {
    expect(st().quality).toBe("economico");
    st().init({ mobile: false, cores: 8 });
    expect(st().quality).toBe("ultra");
    st().setQuality("alto");
    st().init({ mobile: true, cores: 2 });
    expect(st().quality).toBe("alto");
  });
  it("un celular se queda en Económico", () => {
    st().init({ mobile: true, cores: 8 });
    expect(st().quality).toBe("economico");
  });
  it("setQuality cambia el perfil, avisa y limpia una falla anterior", () => {
    st().fail("prueba");
    st().setQuality("ultra");
    expect(st().quality).toBe("ultra");
    expect(st().failed).toBeNull();
    expect(st().notice).toContain("Ultra");
  });
  it("cada interruptor cambia solo su efecto", () => {
    st().setAo(false);
    expect(st().ao).toBe(false);
    expect(st().bloom).toBe(true);
    st().setBloom(false);
    st().setReflections(false);
    st().setCine(false);
    expect([st().ao, st().bloom, st().reflections, st().cine]).toEqual([false, false, false, false]);
  });
  it("degrade baja de a un escalón, avisa, y en Económico devuelve null sin cambiar nada", () => {
    st().setQuality("ultra");
    expect(st().degrade()).toBe("alto");
    expect(st().notice).toContain("Alto");
    expect(st().degrade()).toBe("economico");
    expect(st().degrade()).toBeNull();
    expect(st().quality).toBe("economico");
  });
  it("fail apaga los efectos y retry los vuelve a permitir", () => {
    st().setQuality("ultra");
    expect(fxOf(st()).post).toBe(true);
    st().fail("este dispositivo no los soporta.");
    expect(st().failed).toContain("dispositivo");
    expect(fxOf(st()).post).toBe(false);
    expect(fxOf(st()).quality).toBe("economico");
    st().retry();
    expect(st().failed).toBeNull();
    expect(fxOf(st()).post).toBe(true);
  });
  it("el ajuste automático se puede apagar", () => {
    expect(st().auto).toBe(true);
    st().setAuto(false);
    expect(st().auto).toBe(false);
  });
  it("una calidad inválida cae en Económico en lugar de romper el visor", () => {
    st().setQuality("inexistente" as never);
    expect(st().quality).toBe("economico");
  });
  it("init guarda los límites del equipo y fxOf los aplica (celular: sin MSAA, con sombras en Ultra)", () => {
    st().init({ mobile: true, cores: 8 });
    expect(st().limits.limited).toBe(true);
    st().setQuality("ultra");
    const fx = fxOf(st());
    expect(fx.msaa).toBe(0);
    expect(fx.fxaa).toBe(true);
    expect(fx.shadows).toEqual({ enabled: true, size: 2048 });
  });
});
