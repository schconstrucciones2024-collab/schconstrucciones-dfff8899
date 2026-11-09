import { describe, expect, it } from "vitest";
import { DECK_3D } from "./deck";
import { deckLayout, roofLayout, sheetProfile, type DeckBox } from "./deckLayout";
import { deckStepCount } from "./deckGeometry";

const base = { roofed: false, railFront: false, railLeft: false, railRight: false, steps: false };
const extent = (b: DeckBox) => ({
  x: [b.pos[0] - b.size[0] / 2, b.pos[0] + b.size[0] / 2] as const,
  y: [b.pos[1] - b.size[1] / 2, b.pos[1] + b.size[1] / 2] as const,
  z: [b.pos[2] - b.size[2] / 2, b.pos[2] + b.size[2] / 2] as const,
});
const EPS = 1e-6;

describe("deck 3D: piezas", () => {
  for (const topY of [0.24, 0.5, 0.79, 0.99]) {
    it(`con la cara superior a ${topY} m, las tablas llegan justo a esa altura y nada queda bajo el suelo`, () => {
      const L = deckLayout(
        { width: 4, depth: 3, ...base, roofed: true, railFront: true, steps: true },
        topY,
      );
      const tops = L.boards.map((b) => extent(b).y[1]);
      expect(Math.max(...tops)).toBeCloseTo(topY, 6);
      expect(Math.min(...tops)).toBeCloseTo(topY, 6);
      for (const b of [...L.boards, ...L.frame, ...L.piles, ...L.steps, ...L.rails])
        expect(extent(b).y[0]).toBeGreaterThanOrEqual(-EPS);
      // Nada de la estructura sobresale por arriba de las tablas.
      for (const b of [...L.frame, ...L.piles])
        expect(extent(b).y[1]).toBeLessThanOrEqual(topY + EPS);
    });
  }

  it("las tablas cubren el frente y la profundidad sin salirse, y no entran en el muro", () => {
    for (const [W, D] of [
      [4, 3],
      [8, 3],
      [1, 1],
      [6.5, 2.4],
    ] as const) {
      const L = deckLayout({ width: W, depth: D, ...base }, 0.79);
      const xs = L.boards.flatMap((b) => [extent(b).x[0], extent(b).x[1]]),
        zs = L.boards.flatMap((b) => [extent(b).z[0], extent(b).z[1]]);
      expect(Math.min(...xs)).toBeCloseTo(-W / 2, 2);
      expect(Math.max(...xs)).toBeCloseTo(W / 2, 2);
      expect(Math.min(...zs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...zs)).toBeCloseTo(D, 3);
    }
  });

  it("las maderas del comercio no pasan de 3,30 m: se empalman", () => {
    const L = deckLayout({ width: 8, depth: 3, ...base }, 0.79);
    for (const b of [...L.boards, ...L.frame])
      expect(Math.max(...b.size)).toBeLessThanOrEqual(DECK_3D.largoMadera + EPS);
  });

  it("sin barandas, sin escalones y sin techo no hay esas piezas; el techo solo aparece si está activado", () => {
    const L = deckLayout({ width: 4, depth: 3, ...base }, 0.79);
    expect(L.rails).toHaveLength(0);
    expect(L.steps).toHaveLength(0);
    expect(L.roof).toBeNull();
    expect(deckLayout({ width: 4, depth: 3, ...base, roofed: true }, 0.79).roof).not.toBeNull();
  });

  it("las barandas van solo en los lados elegidos y nunca del lado de la casa", () => {
    const only = (k: "railFront" | "railLeft" | "railRight") =>
      deckLayout({ width: 6, depth: 3, ...base, [k]: true }, 0.79).rails;
    for (const b of only("railFront")) expect(extent(b).z[0]).toBeGreaterThan(2.5);
    for (const b of only("railLeft")) expect(extent(b).x[1]).toBeLessThan(-6 / 2 + 0.2);
    for (const b of only("railRight")) expect(extent(b).x[0]).toBeGreaterThan(6 / 2 - 0.2);
    for (const k of ["railFront", "railLeft", "railRight"] as const) {
      for (const b of only(k)) expect(extent(b).z[0]).toBeGreaterThanOrEqual(0.01 - EPS);
    }
    // Altura de baranda: 1 m sobre las tablas.
    const top = Math.max(...only("railFront").map((b) => extent(b).y[1]));
    expect(top).toBeCloseTo(0.79 + DECK_3D.barandaAltura, 6);
  });

  it("la baranda del frente deja libre el paso de los escalones", () => {
    const L = deckLayout({ width: 6, depth: 3, ...base, railFront: true, steps: true }, 0.79);
    const L2 = deckLayout({ width: 6, depth: 3, ...base, railFront: true }, 0.79);
    for (const b of L.rails) {
      const [a, c] = extent(b).x;
      // Queda libre el ancho de los escalones (hasta el eje de los postes que los flanquean).
      expect(a >= DECK_3D.escalonAncho / 2 - 0.05 || c <= -DECK_3D.escalonAncho / 2 + 0.05).toBe(
        true,
      );
    }
    expect(L.rails.length).toBeGreaterThan(0);
    expect(L2.rails.length).toBeGreaterThan(0);
  });

  it("los escalones bajan del deck al suelo con alzada de a lo sumo 18 cm", () => {
    for (const topY of [0.24, 0.79, 0.99]) {
      const L = deckLayout({ width: 4, depth: 3, ...base, steps: true }, topY),
        n = deckStepCount(topY);
      expect(topY / n).toBeLessThanOrEqual(DECK_3D.escalonAlzada + EPS);
      const treads = L.steps.filter((b) => b.size[1] === 0.04);
      expect(treads).toHaveLength(n - 1);
      expect(Math.max(...treads.map((b) => extent(b).y[1]))).toBeCloseTo(topY - topY / n, 6);
      expect(Math.min(...treads.map((b) => extent(b).y[1]))).toBeCloseTo(topY / n, 6);
      for (const b of treads) expect(extent(b).z[0]).toBeGreaterThanOrEqual(3 - EPS);
    }
  });

  it("un deck bajo (sobre platea) no tiene vigas ni pilotes: apoya en soleras", () => {
    const L = deckLayout({ width: 4, depth: 3, ...base }, 0.24);
    expect(L.piles.every((b) => b.size[1] < 0.1)).toBe(true);
    expect(L.frame.every((b) => b.size[1] <= DECK_3D.tiranteAlto + EPS)).toBe(true);
  });

  it("un deck alto lleva pilotes cada 1,65 m como máximo", () => {
    const L = deckLayout({ width: 8, depth: 3, ...base }, 0.99);
    const line = L.piles
      .filter((b) => Math.abs(b.pos[2] - L.piles[0]!.pos[2]) < 1e-6)
      .map((b) => b.pos[0])
      .sort((a, b) => a - b);
    for (let i = 1; i < line.length; i++)
      expect(line[i]! - line[i - 1]!).toBeLessThanOrEqual(DECK_3D.pilotesCada + EPS);
  });
});

describe("deck 3D: medidas libres", () => {
  it("los escalones quedan enfrente de la puerta, sin salirse del deck, y la baranda del frente los deja pasar", () => {
    for (const [W, doorX] of [
      [8, 0],
      [8, 2.5],
      [8, -3],
      [3, 2],
      [1, 0],
    ] as const) {
      const L = deckLayout(
        { width: W, depth: 3, ...base, steps: true, railFront: true },
        0.79,
        doorX,
      );
      expect(L.steps.length).toBeGreaterThan(0);
      for (const b of L.steps) {
        expect(extent(b).x[0], `W=${W}`).toBeGreaterThanOrEqual(-W / 2 - EPS);
        expect(extent(b).x[1], `W=${W}`).toBeLessThanOrEqual(W / 2 + EPS);
      }
      const treads = L.steps.filter((b) => b.size[1] === 0.04),
        xs = treads.map((b) => b.pos[0]);
      // Si el ancho del deck lo permite, los escalones quedan justo frente a la puerta.
      const expected = Math.max(-(W - 1.2) / 2, Math.min((W - 1.2) / 2, doorX));
      if (W >= 1.8) expect(xs[0]).toBeCloseTo(expected, 6);
    }
  });

  it("un deck muy grande (100 × 50 m, techado y con barandas) se calcula sin pasarse de las maderas de 3,30 m", () => {
    const L = deckLayout(
      {
        width: 100,
        depth: 50,
        roofed: true,
        railFront: true,
        railLeft: true,
        railRight: true,
        steps: true,
      },
      0.99,
      0,
    );
    const total =
      L.boards.length +
      L.frame.length +
      L.piles.length +
      L.rails.length +
      L.steps.length +
      (L.roof ? L.roof.posts.length + L.roof.planeBoxes.length : 0);
    expect(total).toBeLessThan(80000);
    for (const b of [...L.boards, ...L.frame, ...(L.roof?.planeBoxes ?? [])])
      expect(
        Math.max(...b.size),
        "ninguna madera pasa de 3,30 m + el pie de la junta",
      ).toBeLessThanOrEqual(DECK_3D.largoMadera + 0.1);
    for (const b of L.rails)
      expect(Math.max(...b.size)).toBeLessThanOrEqual(DECK_3D.barandaCada + 0.2);
  });

  it("un techo muy profundo lleva más filas de postes, cada 3,30 m como máximo", () => {
    const shallow = roofLayout(4, 3, 0.79),
      deep = roofLayout(4, 10, 0.79);
    const rows = (r: typeof shallow) =>
      new Set(r.posts.map((p) => Math.round(p.pos[2] * 100))).size;
    expect(rows(shallow)).toBe(1);
    expect(rows(deep)).toBeGreaterThanOrEqual(3);
    const zs = [...new Set(deep.posts.map((p) => p.pos[2]))].sort((a, b) => b - a);
    for (let i = 1; i < zs.length; i++)
      expect(zs[i - 1]! - zs[i]!).toBeLessThanOrEqual(DECK_3D.largoMadera + 1e-6);
  });
});

describe("deck 3D: techo", () => {
  it("cae hacia afuera: libre 2,30 m en el borde exterior y más alto contra la casa", () => {
    const R = roofLayout(4, 3, 0.79);
    expect(R.plane.origin[1]).toBeCloseTo(0.79 + DECK_3D.techoAlturaExterior, 6);
    expect(R.plane.angle).toBeGreaterThan(0);
    const inner = R.plane.origin[1] + Math.sin(R.plane.angle) * R.plane.length;
    expect(inner - 0.79).toBeLessThanOrEqual(DECK_3D.techoAlturaMax + 0.01);
    // La puerta de entrada (2,10 m, con el umbral 6 cm más arriba que el deck) pasa por debajo de las vigas contra la casa.
    expect(inner - 0.79).toBeGreaterThan(2.1 + 0.06);
  });

  it("lleva postes dobles en las esquinas exteriores y ninguno enfrente de la puerta", () => {
    for (const [W, doorX] of [
      [4, 0],
      [6, 0],
      [8, 0],
      [8, 1.2],
      [5, -0.6],
    ] as const) {
      const R = roofLayout(W, 3, 0.79, doorX);
      const xs = [...new Set(R.posts.map((p) => Math.round(p.pos[0] * 1000) / 1000))];
      const corner = W / 2 - 0.1;
      expect(R.posts.some((p) => Math.abs(Math.abs(p.pos[0]) - corner) < 0.1)).toBe(true);
      expect(R.posts.length % 2).toBe(0); // son dobles
      for (const p of R.posts) {
        const interior = Math.abs(Math.abs(p.pos[0]) - corner) > 0.1;
        if (interior) expect(Math.abs(p.pos[0] - doorX), `W=${W}`).toBeGreaterThanOrEqual(0.7);
      }
      expect(xs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("la chapa es trapezoidal: paso de 10 cm y nervio de 3 cm", () => {
    const p = sheetProfile(4);
    expect(Math.max(...p.map(([, h]) => h))).toBeCloseTo(0.03, 6);
    expect(Math.min(...p.map(([, h]) => h))).toBe(0);
    const tops = p.filter(([, h]) => h > 0.02),
      starts = tops.filter((_, i) => i % 2 === 0).map(([x]) => x);
    expect(starts[1]! - starts[0]!).toBeCloseTo(0.1, 6);
  });
});
