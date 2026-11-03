import { describe, it, expect } from "vitest";
import { LOT_HALF, MAX_TREES, addTree, canPlaceTree, defaultTrees, footprintWorld, houseClearance, keepClear, makeTree, moveTree, removeTree, signedDistance, toWorld, type HouseFrame, type Tree } from "./vegetation";

const square = [{ x: -3, z: -2 }, { x: 3, z: -2 }, { x: 3, z: 2 }, { x: -3, z: 2 }];
const frame: HouseFrame = { contour: square, position: { x: 0, z: 0 }, rotation: 0 };

describe("sistema de coordenadas de la casa", () => {
  it("sin rotación solo suma la posición", () => {
    expect(toWorld({ x: 1, z: 2 }, { position: { x: 5, z: -3 }, rotation: 0 })).toEqual({ x: 6, z: -1 });
  });
  it("a 90° el eje x de la casa pasa al eje z del mundo", () => {
    const w = toWorld({ x: 1, z: 0 }, { position: { x: 0, z: 0 }, rotation: Math.PI / 2 });
    expect(w.x).toBeCloseTo(0, 9);
    expect(w.z).toBeCloseTo(1, 9);
  });
  it("la huella en el mundo sigue a la casa", () => {
    const f = footprintWorld({ ...frame, position: { x: 10, z: 0 } });
    expect(f[0]).toEqual({ x: 7, z: -2 });
  });
});

describe("distancia con signo", () => {
  it("es negativa adentro y positiva afuera", () => {
    expect(signedDistance({ x: 0, z: 0 }, square).d).toBeCloseTo(-2, 9);
    expect(signedDistance({ x: 5, z: 0 }, square).d).toBeCloseTo(2, 9);
  });
});

describe("colocar", () => {
  it("acepta un punto libre", () => {
    const r = addTree([], "pino", { x: 10, z: 0 }, frame);
    expect(r.check.ok).toBe(true);
    expect(r.trees).toHaveLength(1);
  });
  it("rechaza sobre la casa y pegado a la casa", () => {
    expect(canPlaceTree([], { x: 0, z: 0 }, "pino", frame)).toEqual({ ok: false, reason: "sobre-la-casa" });
    expect(canPlaceTree([], { x: 3 + houseClearance("pino") - 0.1, z: 0 }, "pino", frame)).toEqual({ ok: false, reason: "sobre-la-casa" });
    expect(canPlaceTree([], { x: 3 + houseClearance("pino") + 0.1, z: 0 }, "pino", frame).ok).toBe(true);
  });
  it("respeta la casa rotada y desplazada", () => {
    const f: HouseFrame = { ...frame, position: { x: 20, z: 0 }, rotation: Math.PI / 2 };
    expect(canPlaceTree([], { x: 20, z: 0 }, "arbusto", f).ok).toBe(false);
    expect(canPlaceTree([], { x: 0, z: 0 }, "arbusto", f).ok).toBe(true);
  });
  it("rechaza fuera del terreno y valores inválidos", () => {
    expect(canPlaceTree([], { x: LOT_HALF + 1, z: 0 }, "pino", frame)).toEqual({ ok: false, reason: "fuera-del-terreno" });
    expect(canPlaceTree([], { x: Number.NaN, z: 0 }, "pino", frame).ok).toBe(false);
  });
  it("rechaza dos árboles encimados", () => {
    const a = addTree([], "pino", { x: 10, z: 0 }, frame).trees;
    expect(canPlaceTree(a, { x: 10.5, z: 0 }, "pino", frame)).toEqual({ ok: false, reason: "muy-cerca-de-otro" });
    expect(canPlaceTree(a, { x: 14, z: 0 }, "pino", frame).ok).toBe(true);
  });
  it("tiene un máximo", () => {
    const many: Tree[] = Array.from({ length: MAX_TREES }, (_, i) => makeTree("arbusto", { x: -30 + (i % 10) * 6, z: -30 + Math.floor(i / 10) * 6 }, `t${i}`));
    expect(canPlaceTree(many, { x: 30, z: 30 }, "pino", frame)).toEqual({ ok: false, reason: "limite" });
  });
});

describe("mover y quitar", () => {
  const base = addTree([], "pino", { x: 10, z: 0 }, frame);
  const id = base.id!;
  it("mueve a un punto válido", () => {
    const r = moveTree(base.trees, id, { x: 12, z: 5 }, frame);
    expect(r.check.ok).toBe(true);
    expect(r.trees[0]).toMatchObject({ x: 12, z: 5 });
  });
  it("no mueve a un punto inválido y deja todo igual", () => {
    const r = moveTree(base.trees, id, { x: 0, z: 0 }, frame);
    expect(r.check.ok).toBe(false);
    expect(r.trees).toEqual(base.trees);
  });
  it("un árbol no choca consigo mismo al moverse un poco", () => {
    expect(moveTree(base.trees, id, { x: 10.2, z: 0.1 }, frame).check.ok).toBe(true);
  });
  it("quita por id y no falla con ids que no existen", () => {
    expect(removeTree(base.trees, id)).toHaveLength(0);
    expect(removeTree(base.trees, "no-existe")).toHaveLength(1);
  });
  it("mover uno inexistente no cambia nada", () => {
    expect(moveTree(base.trees, "x", { x: 1, z: 1 }, frame).trees).toEqual(base.trees);
  });
});

describe("variación y vegetación inicial", () => {
  it("la variación por id es estable", () => {
    expect(makeTree("pino", { x: 1, z: 1 }, "a")).toEqual(makeTree("pino", { x: 1, z: 1 }, "a"));
    const t = makeTree("pino", { x: 1, z: 1 }, "b");
    expect(t.scale).toBeGreaterThanOrEqual(0.85);
    expect(t.scale).toBeLessThanOrEqual(1.15);
  });
  it("la vegetación inicial queda a distancia de la casa", () => {
    for (const t of defaultTrees(frame)) expect(signedDistance(t, footprintWorld(frame)).d).toBeGreaterThanOrEqual(houseClearance(t.kind) - 1e-9);
  });
  it("si la casa crece sobre un árbol, se aleja hasta la distancia mínima", () => {
    const t = [makeTree("pino", { x: 5, z: 0 }, "p")];
    const big: HouseFrame = { ...frame, contour: [{ x: -8, z: -4 }, { x: 8, z: -4 }, { x: 8, z: 4 }, { x: -8, z: 4 }] };
    const out = keepClear(t, big)[0]!;
    expect(signedDistance(out, footprintWorld(big)).d).toBeGreaterThanOrEqual(houseClearance("pino"));
  });
  it("si nada molesta, devuelve la misma lista", () => {
    const t = [makeTree("pino", { x: 15, z: 0 }, "p")];
    expect(keepClear(t, frame)).toBe(t);
  });
});
