import { describe, it, expect, beforeEach } from "vitest";
import { useEntorno, modeOf } from "./useEntorno";
import { HOUR_DAY, HOUR_NIGHT } from "@/lib/skyModel";
import type { HouseFrame } from "@/lib/vegetation";

const frame: HouseFrame = { contour: [{ x: -3, z: -2 }, { x: 3, z: -2 }, { x: 3, z: 2 }, { x: -3, z: 2 }], position: { x: 0, z: 0 }, rotation: 0 };
const fresh = () => useEntorno.getState().reset(frame);
const st = () => useEntorno.getState();

describe("modo día / noche", () => {
  beforeEach(fresh);
  it("arranca de día", () => {
    expect(st().hour).toBe(HOUR_DAY);
    expect(modeOf(st().hour)).toBe("dia");
  });
  it("modo noche y modo día cambian la hora objetivo con transición", () => {
    st().setNight();
    expect(st().hour).toBe(HOUR_NIGHT);
    expect(st().animate).toBe(true);
    expect(modeOf(st().hour)).toBe("noche");
    st().setDay();
    expect(modeOf(st().hour)).toBe("dia");
  });
  it("el control de hora puede saltar sin transición y normaliza la hora", () => {
    st().setHour(26.5, false);
    expect(st().hour).toBe(2.5);
    expect(st().animate).toBe(false);
    st().setHour(Number.NaN);
    expect(st().hour).toBe(HOUR_DAY);
  });
  it("la exposición se limita a su rango", () => {
    st().setExposure(9); expect(st().exposure).toBe(1.6);
    st().setExposure(0); expect(st().exposure).toBe(0.6);
  });
});

describe("vegetación", () => {
  beforeEach(fresh);
  it("empieza con vegetación de ejemplo que se puede quitar toda", () => {
    expect(st().trees.length).toBeGreaterThan(0);
    st().removeAll();
    expect(st().trees).toHaveLength(0);
  });
  it("planta solo si hay un tipo elegido", () => {
    st().removeAll();
    expect(st().plant({ x: 12, z: 0 }, frame).ok).toBe(false);
    st().setPlacing("pino");
    expect(st().plant({ x: 12, z: 0 }, frame).ok).toBe(true);
    expect(st().trees).toHaveLength(1);
    expect(st().selectedTree).toBe(st().trees[0]!.id);
  });
  it("no planta sobre la casa y avisa por qué", () => {
    st().removeAll(); st().setPlacing("pino");
    const r = st().plant({ x: 0, z: 0 }, frame);
    expect(r.ok).toBe(false);
    expect(st().trees).toHaveLength(0);
    expect(st().notice).toMatch(/casa/);
  });
  it("mueve un árbol y rechaza mover sobre la casa", () => {
    st().removeAll(); st().setPlacing("eucalipto"); st().plant({ x: 12, z: 0 }, frame);
    const id = st().trees[0]!.id;
    expect(st().move(id, { x: 15, z: 4 }, frame).ok).toBe(true);
    expect(st().trees[0]).toMatchObject({ x: 15, z: 4 });
    expect(st().move(id, { x: 0, z: 0 }, frame).ok).toBe(false);
    expect(st().trees[0]).toMatchObject({ x: 15, z: 4 });
  });
  it("quita un árbol y limpia la selección", () => {
    st().removeAll(); st().setPlacing("palmera"); st().plant({ x: 12, z: 0 }, frame);
    const id = st().trees[0]!.id;
    st().remove(id);
    expect(st().trees).toHaveLength(0);
    expect(st().selectedTree).toBeNull();
  });
  it("ocultar la vegetación cancela la colocación", () => {
    st().setPlacing("pino");
    st().setShowVegetation(false);
    expect(st().placing).toBeNull();
    expect(st().showVegetation).toBe(false);
  });
  it("elegir un tipo vuelve a mostrar la vegetación", () => {
    st().setShowVegetation(false);
    st().setPlacing("arbusto");
    expect(st().showVegetation).toBe(true);
  });
  it("seleccionar un árbol cancela la colocación; deseleccionar cancela el movimiento", () => {
    const id = st().trees[0]!.id;
    st().setPlacing("pino");
    st().selectTree(id);
    expect(st().placing).toBeNull();
    st().setMoving(id);
    st().selectTree(null);
    expect(st().movingTree).toBeNull();
  });
  it("seed solo siembra una vez", () => {
    useEntorno.setState({ trees: [], seeded: false });
    st().seed(frame); const n = st().trees.length;
    st().removeAll(); st().seed(frame);
    expect(n).toBeGreaterThan(0);
    expect(st().trees).toHaveLength(0);
  });
});

describe("vistas de cámara", () => {
  beforeEach(fresh);
  it("cada pedido incrementa el contador (así se reaplica aunque sea la misma vista)", () => {
    const n = st().preset.n;
    st().goTo("frontal"); st().goTo("frontal");
    expect(st().preset).toEqual({ n: n + 2, id: "frontal" });
  });
});
