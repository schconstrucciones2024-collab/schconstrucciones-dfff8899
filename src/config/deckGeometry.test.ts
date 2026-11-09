import { describe, expect, it } from "vitest";
import { PLAN_CATALOG, type LayoutProposal } from "./layoutProposals";
import { DECK_3D, DECK_DESNIVEL_UMBRAL, DEFAULT_DECK, normalizeDeck } from "./deck";
import {
  DECK_WALL,
  deckFrontSpan,
  deckPlacement,
  deckRoofHeights,
  deckStepCount,
  deckTopY,
  resolveDeck,
} from "./deckGeometry";
import { OPENINGS_CATALOG } from "./openingsCatalog";
import { exteriorThickness, systemPatch } from "./systems";
import { exteriorSegments, inside, polygonArea, type Point } from "./geometry";
import {
  buildLayoutProposal,
  floorBase,
  initialConfig,
  type HouseConfig,
} from "@/store/useConfigurator";

const baseFor = (plan: LayoutProposal): HouseConfig => {
  const c = initialConfig();
  return { ...c, ...systemPatch(c, plan.system ?? "woodframe") };
};
const doorOffset = (c: HouseConfig) => {
  const o = c.openings.find(
    (v) => v.floor === 0 && v.wall === DECK_WALL && OPENINGS_CATALOG[v.type].door,
  );
  return o ? o.offset : null;
};
const plans = PLAN_CATALOG.filter((p) => p.version === 2);

describe("deck: ubicación pegada al frente", () => {
  it("en la casa inicial el deck sale hacia el sur, a la derecha de quien mira la fachada es el este", () => {
    const c = initialConfig(),
      p = deckPlacement(c.contour, exteriorThickness(c.finish), { width: 4, depth: 3 }, null)!;
    expect(p.wallId).toBe(DECK_WALL);
    expect(p.outward.z).toBeCloseTo(1, 6);
    expect(p.right.x).toBeCloseTo(1, 6);
    const front = exteriorSegments(c.contour).find((s) => s.id === DECK_WALL)!;
    expect(front.a.z).toBeGreaterThan(0);
    expect(p.corners[3]!.x).toBeLessThan(p.corners[2]!.x);
    expect(p.corners[0]!.z).toBeCloseTo(front.a.z + exteriorThickness(c.finish) / 2, 6);
    expect(p.corners[2]!.z).toBeCloseTo(front.a.z + exteriorThickness(c.finish) / 2 + 3, 6);
  });

  it("si el deck es más ancho que el frente queda centrado y sobresale parejo; si es más corto, no se pasa de las esquinas", () => {
    const c = initialConfig(),
      front = exteriorSegments(c.contour).find((s) => s.id === DECK_WALL)!,
      length = Math.abs(front.b.x - front.a.x);
    const wide = deckPlacement(c.contour, 0.15, { width: length + 3, depth: 3 }, 1)!;
    expect(wide.centerOffset).toBe(0);
    const narrow = deckPlacement(c.contour, 0.15, { width: 2, depth: 3 }, length / 2 - 0.1)!;
    const span = deckFrontSpan(c.contour, 0.15)!;
    expect(narrow.centerOffset + 1).toBeLessThanOrEqual(span.end + 1e-9);
    expect(narrow.centerOffset - 1).toBeGreaterThanOrEqual(span.start - 1e-9);
  });

  // Esquinas exteriores del contorno: donde se cruzan las caras exteriores de dos muros seguidos.
  const outerCorner = (c: HouseConfig, i: number): Point => {
    const t = exteriorThickness(c.finish) / 2,
      p = c.contour,
      n = p.length,
      sign = polygonArea(p) > 0 ? 1 : -1;
    const line = (k: number) => {
      const a = p[k % n]!,
        b = p[(k + 1) % n]!,
        d = Math.hypot(b.x - a.x, b.z - a.z),
        dir = { x: (b.x - a.x) / d, z: (b.z - a.z) / d },
        out = { x: dir.z * sign, z: -dir.x * sign };
      return { o: { x: a.x + out.x * t, z: a.z + out.z * t }, dir };
    };
    const l1 = line(i + n - 1),
      l2 = line(i),
      cross = l1.dir.x * l2.dir.z - l1.dir.z * l2.dir.x,
      w = { x: l2.o.x - l1.o.x, z: l2.o.z - l1.o.z },
      s = (w.x * l2.dir.z - w.z * l2.dir.x) / cross;
    return { x: l1.o.x + l1.dir.x * s, z: l1.o.z + l1.dir.z * s };
  };

  it("«frente completo»: el deck va de esquina a esquina de la cara exterior del muro de la entrada, en todas las distribuciones", () => {
    for (const plan of plans) {
      const c = buildLayoutProposal(baseFor(plan), plan),
        thickness = exteriorThickness(c.finish),
        deck = resolveDeck(normalizeDeck({ enabled: true, depth: 3 }), c.contour, thickness),
        p = deckPlacement(c.contour, thickness, deck, doorOffset(c))!,
        a = outerCorner(c, 2),
        b = outerCorner(c, 3);
      expect(deck.width, plan.id).toBeCloseTo(Math.hypot(b.x - a.x, b.z - a.z), 2);
      const ends = [p.corners[0]!, p.corners[1]!],
        d = (u: Point, v: Point) => Math.hypot(u.x - v.x, u.z - v.z);
      const ok =
        (d(ends[0]!, a) < 0.01 && d(ends[1]!, b) < 0.01) ||
        (d(ends[0]!, b) < 0.01 && d(ends[1]!, a) < 0.01);
      expect(ok, `${plan.id}: el deck debe cubrir justo el frente`).toBe(true);
    }
  });

  it("resolveDeck solo toca el ancho cuando el deck está activo y cubre todo el frente", () => {
    const c = initialConfig(),
      t = exteriorThickness(c.finish),
      span = deckFrontSpan(c.contour, t)!;
    const full = resolveDeck(normalizeDeck({ enabled: true, width: 4 }), c.contour, t);
    expect(full.width).toBeCloseTo(span.length, 2);
    expect(
      resolveDeck(normalizeDeck({ enabled: true, width: 4, fullFront: false }), c.contour, t).width,
    ).toBe(4);
    const off = normalizeDeck({ enabled: false, width: 4 });
    expect(resolveDeck(off, c.contour, t)).toBe(off);
  });

  it("en las distribuciones del catálogo el deck queda afuera de la casa, pegado al frente y centrado en la puerta de entrada", () => {
    expect(plans.length).toBeGreaterThanOrEqual(40);
    for (const plan of plans) {
      const c = buildLayoutProposal(baseFor(plan), plan),
        thickness = exteriorThickness(c.finish),
        deck = normalizeDeck({ ...DEFAULT_DECK, enabled: true, width: 4, depth: 3 }),
        offset = doorOffset(c),
        p = deckPlacement(c.contour, thickness, deck, offset);
      expect(p, plan.id).not.toBeNull();
      if (!p) continue;
      const center: Point = {
        x: (p.corners[0]!.x + p.corners[2]!.x) / 2,
        z: (p.corners[0]!.z + p.corners[2]!.z) / 2,
      };
      expect(
        inside(center, c.contour),
        `${plan.id}: el centro del deck no puede caer dentro de la casa`,
      ).toBe(false);
      // Las dos esquinas exteriores no entran en la casa.
      expect(inside(p.corners[2]!, c.contour), plan.id).toBe(false);
      expect(inside(p.corners[3]!, c.contour), plan.id).toBe(false);
      // Cubre la puerta de entrada (con al menos medio metro de deck a cada lado de su eje).
      if (offset !== null)
        expect(
          Math.abs(offset - p.centerOffset),
          `${plan.id}: la puerta tiene que quedar sobre el deck`,
        ).toBeLessThanOrEqual(deck.width / 2 - 0.5 + 1e-9);
    }
  });

  it("doorX ubica el eje de la puerta en el marco del deck: es el punto de la fachada donde está la puerta", () => {
    for (const plan of plans) {
      const c = buildLayoutProposal(baseFor(plan), plan),
        offset = doorOffset(c),
        deck = normalizeDeck({ ...DEFAULT_DECK, enabled: true, width: 3, depth: 3 }),
        p = deckPlacement(c.contour, exteriorThickness(c.finish), deck, offset);
      if (!p) continue;
      if (offset === null) {
        expect(p.doorX, plan.id).toBeNull();
        continue;
      }
      const wall = exteriorSegments(c.contour, exteriorThickness(c.finish)).find(
          (w) => w.id === DECK_WALL,
        )!,
        len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z),
        dir = { x: (wall.b.x - wall.a.x) / len, z: (wall.b.z - wall.a.z) / len },
        door = {
          x: (wall.a.x + wall.b.x) / 2 + dir.x * offset,
          z: (wall.a.z + wall.b.z) / 2 + dir.z * offset,
        },
        // Punto del frente del deck (en el plano del muro) en x = doorX.
        fromDeck = { x: p.origin.x + p.right.x * p.doorX!, z: p.origin.z + p.right.z * p.doorX! },
        along = (fromDeck.x - door.x) * dir.x + (fromDeck.z - door.z) * dir.z;
      expect(Math.abs(along), `${plan.id}: doorX debe caer sobre la puerta`).toBeLessThan(1e-6);
    }
  });

  it("la cara superior del deck queda siempre por debajo del umbral de la puerta de entrada, en cada diseño", () => {
    for (const plan of plans) {
      const c = buildLayoutProposal(baseFor(plan), plan),
        threshold = floorBase(c),
        top = deckTopY(threshold);
      expect(top, plan.id).toBeLessThan(threshold);
      expect(threshold - top, plan.id).toBeCloseTo(DECK_DESNIVEL_UMBRAL, 6);
      expect(top, plan.id).toBeGreaterThan(0);
    }
    // Sobre pilotes de madera (woodframe) y sobre platea (tradicional).
    expect(deckTopY(0.85)).toBeCloseTo(0.79, 6);
    expect(deckTopY(0.3)).toBeCloseTo(0.24, 6);
  });

  it("escalones: alzada de 18 cm como máximo y ninguno si el deck está casi a nivel del suelo", () => {
    expect(deckStepCount(0.79)).toBe(5);
    expect(deckStepCount(0.24)).toBe(2);
    expect(deckStepCount(0.1)).toBe(1);
    for (const top of [0.24, 0.5, 0.79, 1.2])
      expect(top / deckStepCount(top)).toBeLessThanOrEqual(DECK_3D.escalonAlzada + 1e-9);
  });

  it("el techo del deck es más alto contra la casa, deja paso libre y queda bajo el borde de la losa de arriba", () => {
    for (const depth of [1, 2, 3, 6, 10]) {
      const h = deckRoofHeights(depth);
      expect(h.inner).toBeGreaterThanOrEqual(h.outer);
      expect(h.outer).toBeGreaterThanOrEqual(2.1);
      expect(h.inner).toBeLessThan(2.65);
    }
  });

  it("la superficie de la casa no cambia por el deck (m² de la vivienda intactos)", () => {
    const plan = plans[0]!,
      c = buildLayoutProposal(baseFor(plan), plan),
      area = polygonArea(c.contour);
    const withDeck = { ...c, deck: normalizeDeck({ enabled: true, roofed: true }) };
    expect(polygonArea(withDeck.contour)).toBe(area);
    expect(withDeck.m2).toBe(c.m2);
  });
});
