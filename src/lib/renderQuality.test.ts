import { describe, expect, it } from "vitest";
import {
  ALL_FX, PROFILES, QUALITY_IDS, createGovernor, defaultQuality, effectiveFx, fxParams, isQualityId, looksBlank, lowerQuality, samplePoints,
} from "./renderQuality";

describe("perfiles de calidad", () => {
  it("hay tres perfiles y Económico es el render simple de siempre", () => {
    expect(QUALITY_IDS).toEqual(["economico", "alto", "ultra"]);
    const e = PROFILES.economico;
    expect(e.post).toBe(false);
    expect(e.ao).toBeNull();
    expect(e.bloom).toBe(false);
    expect(e.reflections).toBe(false);
    expect(e.msaa).toBe(0);
  });
  it("Ultra es más exigente que Alto en cada punto que importa", () => {
    const a = PROFILES.alto, u = PROFILES.ultra;
    expect(u.shadowMap).toBeGreaterThan(a.shadowMap);
    expect(u.msaa).toBeGreaterThan(a.msaa);
    expect((u.ao?.samples ?? 0)).toBeGreaterThan(a.ao?.samples ?? 99);
    expect(u.reflectionRes).toBeGreaterThan(a.reflectionRes);
  });
  it("ningún perfil usa una densidad de píxeles que dispare el costo de la postproducción", () => {
    for (const id of QUALITY_IDS) {
      expect(PROFILES[id].dprMax).toBeLessThanOrEqual(2);
      expect(PROFILES[id].dprMax).toBeGreaterThanOrEqual(1);
    }
  });
  it("isQualityId reconoce solo los perfiles reales", () => {
    expect(isQualityId("ultra")).toBe(true);
    expect(isQualityId("maximo")).toBe(false);
    expect(isQualityId(3)).toBe(false);
  });
});

describe("calidad inicial según el equipo", () => {
  it.each([
    [{ mobile: true, cores: 8 }, "economico"],
    [{ mobile: false, cores: 4 }, "economico"],
    [{ mobile: false, cores: 8, saveData: true }, "economico"],
    [{ mobile: false, cores: 6 }, "alto"],
    [{ mobile: false, cores: 8 }, "ultra"],
    [{ mobile: false, cores: 16, memoryGB: 8 }, "ultra"],
    [{ mobile: false, cores: 16, memoryGB: 4 }, "alto"],
  ] as const)("%j → %s", (device, expected) => {
    expect(defaultQuality(device)).toBe(expected);
  });
  it("si el navegador no informa los núcleos, se asume un equipo modesto", () => {
    expect(defaultQuality({ mobile: false, cores: Number.NaN })).toBe("economico");
    expect(defaultQuality({ mobile: false, cores: 0 })).toBe("economico");
  });
  it("bajar de calidad va de a un escalón y se detiene en Económico", () => {
    expect(lowerQuality("ultra")).toBe("alto");
    expect(lowerQuality("alto")).toBe("economico");
    expect(lowerQuality("economico")).toBeNull();
  });
});

describe("efectos que quedan activos", () => {
  it("Económico nunca usa postproducción, aunque los interruptores estén prendidos", () => {
    const fx = effectiveFx("economico", ALL_FX, false);
    expect(fx.post).toBe(false);
    expect(fx.ao).toBeNull();
    expect(fx.bloom).toBe(false);
    expect(fx.cine).toBe(false);
    expect(fx.reflections).toBe(false);
    expect(fx.key).toBe("plain");
  });
  it("Alto y Ultra activan todo por defecto", () => {
    for (const id of ["alto", "ultra"] as const) {
      const fx = effectiveFx(id, ALL_FX, false);
      expect(fx.post).toBe(true);
      expect(fx.ao).not.toBeNull();
      expect(fx.bloom).toBe(true);
      expect(fx.cine).toBe(true);
      expect(fx.reflections).toBe(true);
    }
  });
  it("cada interruptor apaga solo su efecto", () => {
    const off = (patch: Partial<typeof ALL_FX>) => effectiveFx("ultra", { ...ALL_FX, ...patch }, false);
    expect(off({ ao: false }).ao).toBeNull();
    expect(off({ ao: false }).bloom).toBe(true);
    expect(off({ bloom: false }).bloom).toBe(false);
    expect(off({ bloom: false }).ao).not.toBeNull();
    expect(off({ reflections: false }).reflections).toBe(false);
    expect(off({ cine: false }).cine).toBe(false);
    expect(off({ cine: false }).post).toBe(true);
  });
  it("sin ningún efecto de imagen activo se dibuja como en Económico (no se paga la cadena vacía)", () => {
    const fx = effectiveFx("ultra", { ao: false, bloom: false, cine: false, reflections: true }, false);
    expect(fx.post).toBe(false);
    expect(fx.msaa).toBe(0);
    expect(fx.key).toBe("plain");
    expect(fx.reflections).toBe(true);
  });
  it("si la postproducción falló, todo vuelve al render simple", () => {
    const fx = effectiveFx("ultra", ALL_FX, true);
    expect(fx.quality).toBe("economico");
    expect(fx.post).toBe(false);
    expect(fx.reflections).toBe(false);
  });
  it("la clave de la cadena cambia al prender o apagar un efecto y no cambia si no hay diferencia", () => {
    const a = effectiveFx("alto", ALL_FX, false).key;
    expect(effectiveFx("alto", ALL_FX, false).key).toBe(a);
    expect(effectiveFx("alto", { ...ALL_FX, ao: false }, false).key === a).toBe(false);
    expect(effectiveFx("ultra", ALL_FX, false).key === a).toBe(false);
  });
});

describe("ajustes según la hora", () => {
  const fx = effectiveFx("ultra", ALL_FX, false);
  it("de noche el brillo es más fuerte y el umbral más bajo que de día", () => {
    const day = fxParams(fx, { day: 1, glow: 0 }), night = fxParams(fx, { day: 0, glow: 1 });
    expect(night.bloomStrength).toBeGreaterThan(day.bloomStrength);
    expect(night.bloomThreshold).toBeLessThan(day.bloomThreshold);
  });
  it("los valores se mantienen en rangos razonables aunque el cielo mande datos fuera de rango", () => {
    for (const sky of [{ day: -3, glow: 9 }, { day: 7, glow: -2 }, { day: Number.NaN, glow: Number.NaN }]) {
      const p = fxParams(fx, sky);
      expect(p.bloomStrength).toBeGreaterThanOrEqual(0);
      expect(p.bloomStrength).toBeLessThanOrEqual(0.7);
      expect(p.bloomThreshold).toBeGreaterThanOrEqual(0.72);
      expect(p.bloomThreshold).toBeLessThanOrEqual(1);
    }
  });
  it("sin efecto, su valor es neutro", () => {
    const none = fxParams(effectiveFx("ultra", { ao: false, bloom: false, cine: false, reflections: true }, false), { day: 1, glow: 0 });
    expect(none.aoIntensity).toBe(0);
    expect(none.bloomStrength).toBe(0);
    expect(none.vignette).toBe(0);
    expect(none.saturation).toBe(1);
    expect(none.contrast).toBe(1);
  });
  it("la viñeta es sutil (nunca oscurece más de un tercio en el borde)", () => {
    expect(fxParams(fx, { day: 1, glow: 0 }).vignette).toBeLessThanOrEqual(0.33);
  });
});

describe("ajuste automático por fluidez", () => {
  const feed = (g: ReturnType<typeof createGovernor>, ms: number, n: number) => {
    let last: "down" | null = null;
    for (let i = 0; i < n; i++) last = g.push(ms) ?? last;
    return last;
  };
  it("un visor fluido (60 cuadros por segundo) nunca pide bajar", () => {
    expect(feed(createGovernor(), 16.7, 500)).toBeNull();
  });
  it("un visor lento (15 cuadros por segundo) pide bajar un escalón", () => {
    expect(feed(createGovernor(), 66, 200)).toBe("down");
  });
  it("ignora los primeros cuadros (compilar shaders los hace lentos)", () => {
    const g = createGovernor({ warmup: 12, window: 45 });
    for (let i = 0; i < 12; i++) expect(g.push(200)).toBeNull();
    expect(feed(g, 16, 100)).toBeNull();
  });
  it("las pausas largas (el visor dibuja solo cuando hace falta) no cuentan como lentitud", () => {
    const g = createGovernor();
    expect(feed(g, 5000, 300)).toBeNull();
    expect(feed(g, 16, 200)).toBeNull();
  });
  it("ignora valores inválidos", () => {
    const g = createGovernor();
    expect(g.push(Number.NaN)).toBeNull();
    expect(g.push(-5)).toBeNull();
    expect(g.push(0)).toBeNull();
  });
  it("después de pedir bajar vuelve a empezar la medición", () => {
    const g = createGovernor({ warmup: 0, window: 10 });
    let downs = 0;
    for (let i = 0; i < 35; i++) if (g.push(80) === "down") downs++;
    expect(downs).toBe(3);
  });
  it("reset vuelve a ignorar los cuadros de arranque", () => {
    const g = createGovernor({ warmup: 5, window: 5 });
    feed(g, 100, 5);
    g.reset();
    for (let i = 0; i < 5; i++) expect(g.push(100)).toBeNull();
  });
});

describe("detección de cuadro negro", () => {
  it("nueve puntos de muestra, dentro de la imagen y sin repetirse", () => {
    const pts = samplePoints(1920, 1080);
    expect(pts).toHaveLength(9);
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(9);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(1920);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(1080);
    }
  });
  it("con una imagen de 1 píxel los puntos igual quedan adentro", () => {
    for (const p of samplePoints(1, 1)) expect(p).toEqual({ x: 0, y: 0 });
  });
  it("todo negro es un cuadro vacío", () => {
    expect(looksBlank(new Uint8Array(36))).toBe(true);
    expect(looksBlank([0, 0, 0, 255, 1, 1, 1, 255])).toBe(true);
  });
  it("un cielo nocturno muy oscuro pero con color NO es un cuadro vacío", () => {
    expect(looksBlank([5, 7, 15, 255, 0, 0, 0, 255, 0, 0, 0, 255])).toBe(false);
  });
  it("un solo píxel con color alcanza para considerar que dibuja", () => {
    expect(looksBlank([0, 0, 0, 255, 0, 0, 0, 255, 120, 90, 60, 255])).toBe(false);
  });
  it("sin datos no se puede afirmar que esté vacío", () => {
    expect(looksBlank([])).toBe(false);
  });
});
