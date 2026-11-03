import { describe, it, expect } from "vitest";
import { MIN_CAMERA_Y, PRESETS, WALL_MARGIN, constrainCamera, fitDistance, frameAll, presetPose, type HouseVolume, type PresetId } from "./cameraViews";
import { footprintWorld, makeTree, signedDistance } from "./vegetation";

const house: HouseVolume = { contour: [{ x: -4, z: -3 }, { x: 4, z: -3 }, { x: 4, z: 3 }, { x: -4, z: 3 }], position: { x: 0, z: 0 }, rotation: 0, height: 3.7 };
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe("encuadre", () => {
  it("la distancia crece con el tamaño y disminuye en pantallas más anchas", () => {
    expect(fitDistance(10, 5, 1.6)).toBeGreaterThan(fitDistance(5, 5, 1.6));
    expect(fitDistance(20, 5, 0.6)).toBeGreaterThan(fitDistance(20, 5, 1.8));
  });
});

describe("vistas predefinidas", () => {
  const ids = PRESETS.map((p) => p.id);
  it("hay cinco vistas y cada una con nombre", () => {
    expect(ids).toEqual(["frontal", "lateral", "aerea", "fachada", "auto"]);
    expect(PRESETS.every((p) => p.name.length > 0 && p.hint.length > 0)).toBe(true);
  });
  for (const rot of [0, Math.PI / 2, 1.1]) {
    for (const aspect of [0.5, 1, 1.8]) {
      it(`ninguna vista queda dentro de la casa ni bajo el suelo (rotación ${rot.toFixed(2)}, aspecto ${aspect})`, () => {
        const h = { ...house, rotation: rot, position: { x: 3, z: -2 } };
        for (const id of ids as PresetId[]) {
          const p = presetPose(id, h, aspect, [makeTree("pino", { x: 15, z: 5 }, "a")]);
          expect(p.position[1]).toBeGreaterThanOrEqual(MIN_CAMERA_Y - 1e-9);
          const d = signedDistance({ x: p.position[0], z: p.position[2] }, footprintWorld(h)).d;
          expect(d).toBeGreaterThanOrEqual(WALL_MARGIN - 1e-6);
          expect(p.position.every(Number.isFinite) && p.target.every(Number.isFinite)).toBe(true);
        }
      });
    }
  }
  it("frontal mira desde +z y lateral desde +x", () => {
    const f = presetPose("frontal", house, 1.6), l = presetPose("lateral", house, 1.6);
    expect(f.position[2]).toBeGreaterThan(f.target[2] + 5);
    expect(Math.abs(f.position[0] - f.target[0])).toBeLessThan(0.01);
    expect(l.position[0]).toBeGreaterThan(l.target[0] + 5);
    expect(Math.abs(l.position[2] - l.target[2])).toBeLessThan(0.01);
  });
  it("al rotar la casa 90° la vista frontal rota con ella", () => {
    const f = presetPose("frontal", { ...house, rotation: Math.PI / 2 }, 1.6);
    expect(Math.abs(f.position[2] - f.target[2])).toBeLessThan(0.01);
    expect(Math.abs(f.position[0] - f.target[0])).toBeGreaterThan(5);
  });
  it("la aérea está más alta que la frontal y la fachada está a la altura de los ojos", () => {
    expect(presetPose("aerea", house, 1.6).position[1]).toBeGreaterThan(presetPose("frontal", house, 1.6).position[1] * 2);
    expect(presetPose("fachada", house, 1.6).position[1]).toBeCloseTo(1.6, 6);
  });
  it("el encuadre automático se aleja cuando hay vegetación lejos", () => {
    const solo = presetPose("auto", house, 1.6), con = presetPose("auto", house, 1.6, [makeTree("eucalipto", { x: 30, z: 25 }, "far")]);
    expect(dist(con.position, con.target)).toBeGreaterThan(dist(solo.position, solo.target));
  });
  it("el encuadre automático incluye a todos los árboles dentro del cono de la cámara", () => {
    const trees = [makeTree("pino", { x: -20, z: -15 }, "a"), makeTree("palmera", { x: 22, z: 18 }, "b")];
    const f = frameAll(house, trees, 1.6);
    const toTarget = f.target.map((v, i) => v - f.position[i]!);
    const n = Math.hypot(...toTarget);
    for (const t of trees) {
      const v = [t.x - f.position[0], 1 - f.position[1], t.z - f.position[2]];
      const cos = (v[0]! * toTarget[0]! + v[1]! * toTarget[1]! + v[2]! * toTarget[2]!) / (Math.hypot(...v) * n);
      expect(Math.acos(cos)).toBeLessThan(Math.atan(Math.tan((45 * Math.PI) / 360) * 1.6)); // dentro de la mitad del campo visual horizontal
    }
  });
});

describe("restricciones de cámara", () => {
  it("no toca una posición válida y devuelve la misma referencia", () => {
    const p: [number, number, number] = [20, 5, 20];
    const r = constrainCamera(p, house, "exterior");
    expect(r.changed).toBe(false);
    expect(r.position).toBe(p);
  });
  it("sube la cámara que quedó bajo el suelo", () => {
    expect(constrainCamera([20, -3, 20], house, "exterior").position[1]).toBe(MIN_CAMERA_Y);
  });
  it("saca hacia afuera la cámara que quedó dentro de la casa", () => {
    const r = constrainCamera([0, 1.5, 0], house, "exterior");
    expect(r.changed).toBe(true);
    expect(signedDistance({ x: r.position[0], z: r.position[2] }, footprintWorld(house)).d).toBeGreaterThanOrEqual(WALL_MARGIN);
  });
  it("mantiene a distancia de la pared si se pega a ella", () => {
    const r = constrainCamera([4.1, 1.5, 0], house, "exterior");
    expect(signedDistance({ x: r.position[0], z: r.position[2] }, footprintWorld(house)).d).toBeGreaterThanOrEqual(WALL_MARGIN);
  });
  it("por encima del techo se puede pasar sobre la casa", () => {
    const p: [number, number, number] = [0, 12, 0];
    expect(constrainCamera(p, house, "exterior").changed).toBe(false);
  });
  it("en el interior se puede estar dentro pero no bajo el piso", () => {
    const r = constrainCamera([0, 0.1, 0], house, "interior", 0.9);
    expect(r.position[1]).toBeCloseTo(1.15, 9);
    expect(r.position[0]).toBe(0);
  });
  it("debajo de la casa se permite estar dentro de la huella", () => {
    expect(constrainCamera([0, 0.45, 0], house, "under").changed).toBe(false);
  });
  it("sigue a la casa rotada y desplazada", () => {
    const h = { ...house, position: { x: 10, z: 0 }, rotation: Math.PI / 2 };
    const r = constrainCamera([10, 1.5, 0], h, "exterior");
    expect(signedDistance({ x: r.position[0], z: r.position[2] }, footprintWorld(h)).d).toBeGreaterThanOrEqual(WALL_MARGIN);
  });
});
