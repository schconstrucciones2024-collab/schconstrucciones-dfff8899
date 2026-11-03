import { describe, expect, it } from "vitest";
import { addBox, newSolid, solidBounds, solidFromSpec, triangleCount, type Solid, type SolidSpec } from "./wallGeometry";

/** Cada triángulo debe mirar hacia donde dicen sus normales (si no, la cara se vería “al revés”). */
function facingErrors(s: Solid): number {
  let bad = 0;
  for (let t = 0; t < s.indices.length; t += 3) {
    const [a, b, c] = [s.indices[t]!, s.indices[t + 1]!, s.indices[t + 2]!];
    const p = (i: number) => [s.positions[i * 3]!, s.positions[i * 3 + 1]!, s.positions[i * 3 + 2]!] as const;
    const n = (i: number) => [s.normals[i * 3]!, s.normals[i * 3 + 1]!, s.normals[i * 3 + 2]!] as const;
    const pa = p(a), pb = p(b), pc = p(c);
    const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const g = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const na = n(a), nb = n(b), nc = n(c);
    const avg = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
    const d = g[0]! * avg[0]! + g[1]! * avg[1]! + g[2]! * avg[2]!;
    if (d <= 0) bad++;
  }
  return bad;
}

const specs: [string, SolidSpec][] = [
  ["caja", { k: "box", s: [0.4, 0.2, 0.1] }],
  ["ladrillo hueco", { k: "hollow", L: 0.25, H: 0.18, D: 0.12, t: 0.012, ny: 3, nz: 2 }],
  ["tabla de siding", { k: "lap", w: 2.4, h: 0.16, tb: 0.014, tt: 0.005 }],
  ["chapa acanalada", { k: "corr", w: 2.4, h: 2, waves: 29, amp: 0.0145, th: 0.002 }],
  ["barra", { k: "bar", axis: "x", len: 1, r: 0.005 }],
  ["estribo", { k: "stirrup", axis: "y", a: 0.07, b: 0.06, r: 0.003 }],
];

describe("geometría de paredes", () => {
  for (const [name, spec] of specs) {
    it(`${name}: todas las caras miran hacia afuera`, () => {
      const s = solidFromSpec(spec);
      expect(triangleCount(s)).toBeGreaterThan(0);
      expect(facingErrors(s)).toBe(0);
    });
    it(`${name}: índices y atributos consistentes`, () => {
      const s = solidFromSpec(spec);
      const verts = s.positions.length / 3;
      expect(s.normals.length).toBe(s.positions.length);
      expect(s.uvs.length / 2).toBe(verts);
      expect(Math.max(...s.indices)).toBeLessThan(verts);
      for (const v of s.positions) expect(Number.isFinite(v)).toBe(true);
    });
  }

  it("en piezas convexas las normales apuntan hacia afuera del centro (no hacia adentro)", () => {
    for (const spec of [specs[0]![1], specs[2]![1], specs[4]![1]]) {
      const s = solidFromSpec(spec);
      const b = solidBounds(s);
      const c = [0, 1, 2].map((k) => (b.min[k]! + b.max[k]!) / 2);
      for (let i = 0; i < s.positions.length; i += 3) {
        const d = [0, 1, 2].reduce((acc, k) => acc + (s.positions[i + k]! - c[k]!) * s.normals[i + k]!, 0);
        expect(d).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it("la caja tiene 12 triángulos y mide lo pedido", () => {
    const s = solidFromSpec({ k: "box", s: [0.4, 0.2, 0.1] });
    expect(triangleCount(s)).toBe(12);
    const b = solidBounds(s);
    expect(b.min).toEqual([-0.2, -0.1, -0.05]);
    expect(b.max).toEqual([0.2, 0.1, 0.05]);
  });

  it("las UV son planas y en metros (1 repetición = 1 m)", () => {
    const s = newSolid();
    addBox(s, [1, 2, 0.1], [0, 0, 0]);
    // cara +z: u = x, v = y
    const i = 0;
    expect(s.uvs[i * 2]).toBe(s.positions[i * 3]);
    expect(s.uvs[i * 2 + 1]).toBe(s.positions[i * 3 + 1]);
  });

  it("`o` desplaza las UV para que la textura continúe entre piezas vecinas", () => {
    const a = solidFromSpec({ k: "box", s: [1, 1, 0.1], o: [0.5, 0, 0] });
    const b = solidFromSpec({ k: "box", s: [1, 1, 0.1] });
    expect(a.uvs[0]! - b.uvs[0]!).toBeCloseTo(0.5, 6);
  });

  it("`rot` intercambia u y v (veta en el otro sentido)", () => {
    const a = solidFromSpec({ k: "box", s: [1, 2, 0.1], rot: true });
    const b = solidFromSpec({ k: "box", s: [1, 2, 0.1] });
    expect(a.uvs[0]).toBe(b.uvs[1]);
    expect(a.uvs[1]).toBe(b.uvs[0]);
  });

  it("el ladrillo hueco mide L×H×D y tiene celdas pasantes (no es una caja maciza)", () => {
    const spec: SolidSpec = { k: "hollow", L: 0.25, H: 0.18, D: 0.12, t: 0.012, ny: 3, nz: 2 };
    const b = solidBounds(solidFromSpec(spec));
    expect(b.max[0]! - b.min[0]!).toBeCloseTo(0.25, 6);
    expect(b.max[1]! - b.min[1]!).toBeCloseTo(0.18, 6);
    expect(b.max[2]! - b.min[2]!).toBeCloseTo(0.12, 6);
    // 4 losas + 3 filas × 3 costillas = 13 cajas
    expect(triangleCount(solidFromSpec(spec))).toBe(13 * 12);
  });

  it("la chapa acanalada ondula en z y no se sale de su alto ni de su ancho", () => {
    const b = solidBounds(solidFromSpec({ k: "corr", w: 2.4, h: 2, waves: 29, amp: 0.0145, th: 0.002 }));
    expect(b.min[0]).toBeCloseTo(-1.2, 6);
    expect(b.max[0]).toBeCloseTo(1.2, 6);
    expect(b.min[1]).toBe(0);
    expect(b.max[1]).toBe(2);
    expect(b.max[2]! - b.min[2]!).toBeCloseTo(2 * 0.0145 + 0.002, 4);
  });

  it("la tabla de siding es más gruesa abajo que arriba y apoya en z = 0", () => {
    const b = solidBounds(solidFromSpec({ k: "lap", w: 2.4, h: 0.16, tb: 0.014, tt: 0.005 }));
    expect(b.min[2]).toBe(0);
    expect(b.max[2]).toBeCloseTo(0.014, 6);
    expect(b.min[1]).toBe(0);
    expect(b.max[1]).toBeCloseTo(0.16, 6);
  });

  it("el estribo abraza el rectángulo interior sin cerrarlo", () => {
    const b = solidBounds(solidFromSpec({ k: "stirrup", axis: "y", a: 0.07, b: 0.06, r: 0.003 }));
    expect(b.max[0]! - b.min[0]!).toBeCloseTo(0.07 + 2 * 2 * 0.003, 4);
    expect(b.max[2]! - b.min[2]!).toBeCloseTo(0.06 + 2 * 2 * 0.003, 4);
  });

  it("la misma descripción devuelve la misma malla (cache)", () => {
    const a = solidFromSpec({ k: "box", s: [1, 1, 1] });
    const b = solidFromSpec({ k: "box", s: [1, 1, 1] });
    expect(a === b).toBe(true);
  });
});
