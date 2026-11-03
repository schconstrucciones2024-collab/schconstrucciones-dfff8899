import { describe, it, expect } from "vitest";
import { HOUR_DAY, HOUR_NIGHT, SKY_KEYS, formatHour, hexToRgb, isDay, lerpHex, moonDirection, rgbToHex, skyAt, sunDirection, transitionHour, wrapHour } from "./skyModel";

describe("hora del día", () => {
  it("normaliza horas fuera de rango", () => {
    expect(wrapHour(25)).toBe(1);
    expect(wrapHour(-1)).toBe(23);
    expect(wrapHour(24)).toBe(0);
  });
  it("formatea HH:MM", () => {
    expect(formatHour(13.5)).toBe("13:30");
    expect(formatHour(0)).toBe("00:00");
    expect(formatHour(23.999)).toBe("00:00");
  });
  it("convierte colores y mezcla", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
    expect(rgbToHex([255, 128, 0])).toBe("#ff8000");
    expect(lerpHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
  it("el sol está arriba a mediodía y abajo a medianoche", () => {
    expect(sunDirection(12)[1]).toBeGreaterThan(0.85);
    expect(sunDirection(0)[1]).toBeLessThan(0);
    expect(isDay(HOUR_DAY)).toBe(true);
    expect(isDay(HOUR_NIGHT)).toBe(false);
  });
  it("la luna está arriba cuando el sol está abajo", () => {
    expect(moonDirection(0)[1]).toBeGreaterThan(0.85);
  });
});

describe("estado del cielo", () => {
  it("modo día: luz fuerte, sin estrellas, ventanas apagadas", () => {
    const d = skyAt(HOUR_DAY);
    expect(d.lightI).toBeGreaterThanOrEqual(2.4);
    expect(d.stars).toBe(0);
    expect(d.glow).toBe(0);
    expect(d.day).toBeGreaterThan(0.95);
    expect(d.sunWeight).toBeGreaterThan(0.95);
  });
  it("modo noche: luz tenue de luna, estrellas, ventanas encendidas", () => {
    const n = skyAt(HOUR_NIGHT);
    expect(n.lightI).toBeLessThan(0.4);
    expect(n.stars).toBeGreaterThan(0.5);
    expect(n.glow).toBe(1);
    expect(n.day).toBeLessThan(0.01);
    expect(n.sunWeight).toBeLessThan(0.01);
  });
  it("la luz principal siempre queda por encima del horizonte (las sombras no se invierten)", () => {
    for (let h = 0; h < 24; h += 0.25) expect(skyAt(h).lightPos[1]).toBeGreaterThan(0);
  });
  it("las transiciones son continuas: no hay saltos de intensidad entre cuartos de hora", () => {
    let prev = skyAt(0);
    for (let h = 0.25; h <= 24; h += 0.25) {
      const s = skyAt(h);
      expect(Math.abs(s.lightI - prev.lightI)).toBeLessThan(0.7);
      expect(Math.abs(s.ambientI - prev.ambientI)).toBeLessThan(0.2);
      prev = s;
    }
  });
  it("el ciclo cierra: 0 h y 24 h son iguales", () => {
    expect(skyAt(24)).toEqual(skyAt(0));
  });
  it("cada cuadro clave es válido y los cuadros están ordenados", () => {
    for (let i = 0; i < SKY_KEYS.length; i++) {
      const k = SKY_KEYS[i]!;
      expect(k.zenith).toMatch(/^#[0-9a-f]{6}$/);
      expect(k.horizon).toMatch(/^#[0-9a-f]{6}$/);
      if (i > 0) expect(k.hour).toBeGreaterThan(SKY_KEYS[i - 1]!.hour);
    }
  });
  it("el atardecer es más cálido que el mediodía (más rojo que azul en el horizonte)", () => {
    const [r, , b] = hexToRgb(skyAt(19.7).horizon);
    expect(r).toBeGreaterThan(b);
  });
});

describe("transición", () => {
  it("arranca en el origen y termina en el destino", () => {
    expect(transitionHour(13, 23, 0, 2.4)).toBe(13);
    expect(transitionHour(13, 23, 2.4, 2.4)).toBe(23);
    expect(transitionHour(13, 23, 9, 2.4)).toBe(23);
  });
  it("es progresiva y monótona", () => {
    let prev = 13;
    for (let t = 0.1; t <= 2.4; t += 0.1) {
      const h = transitionHour(13, 23, t, 2.4);
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
    expect(transitionHour(13, 23, 1.2, 2.4)).toBeCloseTo(18, 5);
  });
  it("con duración 0 es instantánea (movimiento reducido)", () => {
    expect(transitionHour(13, 23, 0, 0)).toBe(23);
  });
});
