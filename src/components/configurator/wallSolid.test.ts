import { describe, expect, it } from "vitest";
import polygonClipping from "polygon-clipping";
import type * as THREE from "three";
import { PLAN_CATALOG } from "@/config/layoutProposals";
import { exteriorSegments, isOrthogonal, miterPolygon, polygonArea, type Point } from "@/config/geometry";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { buildLayoutProposal, designWalls, initialConfig, resolveWall, FLOOR_STEP } from "@/store/useConfigurator";
import { buildContinuousSolid, buildSlabSolid, buildWallSolid, exteriorSolidHeight, floorsToDraw, innerFaceSpan, interiorSide, JOINT_OVERLAP, wallFrame, wallLocalRing } from "./wallSolid";

const rect = (w: number, d: number): Point[] => [
  { x: 0, z: 0 },
  { x: w, z: 0 },
  { x: w, z: d },
  { x: 0, z: d },
];

/** Volumen de una malla cerrada (suma de volúmenes con signo de los tetraedros desde el origen). */
function volume(g: THREE.BufferGeometry): number {
  const p = g.getAttribute("position"),
    index = g.getIndex();
  const tri = (i: number, j: number, k: number) => {
    const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i),
      bx = p.getX(j), by = p.getY(j), bz = p.getZ(j),
      cx = p.getX(k), cy = p.getY(k), cz = p.getZ(k);
    return (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  };
  let v = 0;
  if (index) for (let i = 0; i < index.count; i += 3) v += tri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  else for (let i = 0; i < p.count; i += 3) v += tri(i, i + 1, i + 2);
  return Math.abs(v);
}

describe("esquinas a 90° de las paredes exteriores", () => {
  it("en un rectángulo, el anillo de cada pared es un trapecio: lado largo afuera, lado corto adentro", () => {
    const walls = exteriorSegments(rect(8, 6));
    for (const w of walls) {
      const ring = wallLocalRing(w, walls),
        zs = ring.map((q) => q.z),
        side = interiorSide(w, rect(8, 6)),
        inner = innerFaceSpan(ring, side),
        len = wallFrame(w).length;
      expect(ring).toHaveLength(4);
      // la cara exterior llega hasta el final del muro más medio espesor; la interior, hasta el borde de la pared vecina
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(w.thickness, 6);
      expect(inner.hi - inner.lo).toBeCloseTo(len - w.thickness, 6);
      const outer = innerFaceSpan(ring, side === 1 ? -1 : 1);
      expect(outer.hi - outer.lo).toBeCloseTo(len + w.thickness, 6);
    }
  });

  it("todas las paredes exteriores de todas las distribuciones se unen en un contorno con esquinas a 90° (sin chaflanes)", () => {
    const bad: string[] = [];
    for (const plan of PLAN_CATALOG.filter((p) => p.version === 2)) {
      const c = buildLayoutProposal(initialConfig(plan.system ?? "woodframe"), plan);
      expect(isOrthogonal(c.contour)).toBe(true);
      const walls = exteriorSegments(c.contour, plan.system === "tradicional" ? 0.2 : 0.15),
        rings = walls.map((w) => miterPolygon(w, walls).map((q) => [q.x, q.z] as [number, number]));
      const union = polygonClipping.union(...rings.map((r) => [r] as [[number, number][]]));
      for (const poly of union)
        for (const ring of poly) {
          const pts = ring.slice(0, -1).map(([x, z]) => ({ x, z }));
          if (!isOrthogonal(pts)) bad.push(`${plan.id}: el borde de las paredes tiene un tramo en diagonal`);
        }
      // el área de las paredes es la del contorno exterior menos la del interior (nada duplicado ni faltante)
      const area = union.reduce((s, poly) => s + poly.reduce((a, ring, i) => a + (i === 0 ? 1 : -1) * Math.abs(polygonArea(ring.slice(0, -1).map(([x, z]) => ({ x, z })))), 0), 0),
        t = walls[0]!.thickness,
        perimeter = walls.reduce((s, w) => s + wallFrame(w).length, 0);
      // para un contorno ortogonal simple: área de la corona = perímetro del eje × espesor
      if (Math.abs(area - perimeter * t) > 1e-6 * perimeter) bad.push(`${plan.id}: el área de las paredes (${area.toFixed(3)}) no es perímetro × espesor (${(perimeter * t).toFixed(3)})`);
    }
    expect(bad).toEqual([]);
  });

  it("el lado interior de cada pared de cada distribución mira hacia adentro de la casa", () => {
    const plan = PLAN_CATALOG.find((p) => p.version === 2 && p.footprint === "L")!,
      c = buildLayoutProposal(initialConfig(plan.system ?? "woodframe"), plan);
    for (const w of designWalls(c, 0).filter((v) => v.id.startsWith("edge-"))) {
      const side = interiorSide(w, c.contour),
        { center, angle } = wallFrame(w),
        probe = { x: center.x + Math.sin(angle) * side * 0.3, z: center.z + Math.cos(angle) * side * 0.3 },
        opposite = { x: center.x - Math.sin(angle) * side * 0.3, z: center.z - Math.cos(angle) * side * 0.3 };
      const inside = (p: Point) => polygonClipping.intersection([c.contour.map((q) => [q.x, q.z] as [number, number])], [[[p.x - 1e-3, p.z - 1e-3], [p.x + 1e-3, p.z - 1e-3], [p.x + 1e-3, p.z + 1e-3], [p.x - 1e-3, p.z + 1e-3]]]).length > 0;
      expect(inside(probe)).toBe(true);
      expect(inside(opposite)).toBe(false);
    }
  });
});

describe("cuerpo macizo del muro", () => {
  const w = { id: "edge-0", a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, thickness: 0.15, height: 2.65 };
  const ring = wallLocalRing(w, exteriorSegments(rect(4, 3)));

  it("sin aberturas es la planta extruida hasta la altura pedida", () => {
    const g = buildWallSolid(ring, [], 2.85)!;
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(g.boundingBox!.max.y).toBeCloseTo(2.85, 6);
    const area = Math.abs(polygonArea(ring));
    expect(volume(g)).toBeCloseTo(area * 2.85, 5);
  });

  it("con una ventana, el hueco se descuenta del volumen y el muro sigue siendo continuo arriba y abajo", () => {
    const g = buildWallSolid(ring, [{ type: "ventana", offset: 0 }], 2.65)!,
      area = Math.abs(polygonArea(ring)),
      // ventana simple: 0,8 de ancho, 1,0 de alto; el espesor medio del hueco es el del muro en la cara interior
      hole = 0.8 * 1.0 * 0.15;
    expect(volume(g)).toBeCloseTo(area * 2.65 - hole, 4);
  });

  it("la altura del cuerpo exterior sube hasta la losa de arriba en las plantas de abajo, para que no se vea la franja entre plantas", () => {
    expect(exteriorSolidHeight(2.65, 0, 2, FLOOR_STEP)).toBe(FLOOR_STEP);
    expect(exteriorSolidHeight(2.65, 1, 3, FLOOR_STEP)).toBe(FLOOR_STEP);
    // la última planta mantiene su altura (la cubre el techo) y una casa de una planta también
    expect(exteriorSolidHeight(2.65, 1, 2, FLOOR_STEP)).toBe(2.65);
    expect(exteriorSolidHeight(2.65, 0, 1, FLOOR_STEP)).toBe(2.65);
    // si el muro ya es más alto que el paso entre plantas, no se toca
    expect(exteriorSolidHeight(3.1, 0, 2, FLOOR_STEP)).toBe(3.1);
  });
});

describe("plantas que se dibujan", () => {
  it("al elegir la planta de arriba, la de abajo sigue ahí (solo para mirar)", () => {
    expect(floorsToDraw(true, 1, 2)).toEqual([
      { floor: 0, inert: true },
      { floor: 1, inert: false },
    ]);
    expect(floorsToDraw(true, 2, 3).map((f) => f.floor)).toEqual([0, 1, 2]);
    expect(floorsToDraw(true, 0, 3)).toEqual([{ floor: 0, inert: false }]);
  });
  it("en Exterior se dibujan todas y se pueden tocar; una planta elegida fuera de rango no rompe nada", () => {
    expect(floorsToDraw(false, 0, 3)).toEqual([
      { floor: 0, inert: false },
      { floor: 1, inert: false },
      { floor: 2, inert: false },
    ]);
    expect(floorsToDraw(true, 9, 2).map((f) => f.floor)).toEqual([0, 1]);
    expect(floorsToDraw(true, -1, 2).map((f) => f.floor)).toEqual([0]);
  });
});

/** Aristas dirigidas de una malla sin índice, con los vértices redondeados al 0,01 mm. Las que están en el plano y = 0 son el borde abierto de abajo. */
function edgeStats(g: THREE.BufferGeometry) {
  const p = g.getAttribute("position"),
    key = (i: number) => `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`,
    onFloor = (i: number, j: number) => Math.abs(p.getY(i)) < 1e-6 && Math.abs(p.getY(j)) < 1e-6,
    directed = new Map<string, number>(),
    floor = new Set<string>();
  for (let t = 0; t + 2 < p.count; t += 3)
    for (let k = 0; k < 3; k++) {
      const i = t + k,
        j = t + ((k + 1) % 3),
        id = `${key(i)}>${key(j)}`;
      directed.set(id, (directed.get(id) ?? 0) + 1);
      if (onFloor(i, j)) floor.add(id);
    }
  let repeated = 0,
    unmatched = 0;
  for (const [id, n] of directed) {
    if (n > 1) repeated++;
    const [a, b] = id.split(">") as [string, string];
    if (!directed.has(`${b}>${a}`) && !floor.has(id)) unmatched++;
  }
  return { repeated, unmatched };
}

/** Volumen con signo: positivo si todas las caras miran hacia afuera. */
function signedVolume(g: THREE.BufferGeometry): number {
  const p = g.getAttribute("position");
  let v = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i), bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1), cx = p.getX(i + 2), cy = p.getY(i + 2), cz = p.getZ(i + 2);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

describe("cuerpo del muro sin cortes: no quedan caras internas que asomen como una raya", () => {
  const wall = { id: "edge-0", a: { x: 0, z: 0 }, b: { x: 6, z: 0 }, thickness: 0.15, height: 2.65 };
  const ring = wallLocalRing(wall, exteriorSegments(rect(6, 4)));
  const cuts = [
    { type: "ventana" as const, offset: -1.8 },
    { type: "entrada" as const, offset: 0.2 },
    { type: "ventanaGrande" as const, offset: 1.9 },
  ];

  it("es una superficie cerrada y bien orientada (cada arista tiene su vecina, ninguna está repetida, todas las caras miran hacia afuera)", () => {
    const g = buildContinuousSolid(ring, cuts, 2.65, true)!;
    expect(g).not.toBeNull();
    expect(edgeStats(g)).toEqual({ repeated: 0, unmatched: 0 });
    expect(signedVolume(g)).toBeGreaterThan(0);
  });

  it("el armado anterior por tramos sí dejaba caras internas repetidas (por eso la raya)", () => {
    const old = buildSlabSolid(ring, cuts, 2.65)!,
      stats = edgeStats(old);
    expect(stats.repeated + stats.unmatched).toBeGreaterThan(0);
  });

  it("descuenta de su volumen los huecos de las ventanas y la puerta", () => {
    const g = buildContinuousSolid(ring, cuts, 2.65, true)!,
      zs = ring.map((q) => q.z),
      thick = Math.max(...zs) - Math.min(...zs),
      holes = cuts.reduce((s, o) => s + OPENINGS_CATALOG[o.type].width * OPENINGS_CATALOG[o.type].height * thick, 0);
    expect(signedVolume(g)).toBeCloseTo(Math.abs(polygonArea(ring)) * 2.65 - holes, 4);
  });

  it("sin cara superior no hay ningún triángulo horizontal arriba (en las plantas de abajo no hay raya en la unión entre plantas)", () => {
    const horizontalAt = (g: THREE.BufferGeometry, y: number) => {
      const p = g.getAttribute("position");
      let n = 0;
      for (let i = 0; i + 2 < p.count; i += 3) if ([0, 1, 2].every((k) => Math.abs(p.getY(i + k) - y) < 1e-5)) n++;
      return n;
    };
    expect(horizontalAt(buildWallSolid(ring, cuts, 2.65, { top: true })!, 2.65)).toBeGreaterThan(0);
    expect(horizontalAt(buildWallSolid(ring, cuts, 2.65, { top: false })!, 2.65)).toBe(0);
    // abajo nunca hay cara: queda apoyado sobre la losa o sobre el muro de abajo
    expect(horizontalAt(buildWallSolid(ring, cuts, 2.65)!, 0)).toBe(0);
  });

  it("todos los muros de todas las distribuciones, en todas las plantas, se arman sin cortes y cerrados", () => {
    const bad: string[] = [];
    for (const plan of PLAN_CATALOG.filter((p) => p.version === 2)) {
      const c = buildLayoutProposal(initialConfig(plan.system ?? "woodframe"), plan);
      for (let floor = 0; floor < c.floors; floor++) {
        const all = designWalls(c, floor);
        for (const w of all) {
          const r = wallLocalRing(w, all),
            interior = w.id.startsWith("wall-"),
            h = interior ? w.height : exteriorSolidHeight(w.height, floor, c.floors, FLOOR_STEP),
            cutsHere = c.openings.filter((o) => o.floor === floor && resolveWall(c, o.wall, floor)?.id === w.id).map((o) => ({ type: o.type, offset: o.offset })),
            g = buildContinuousSolid(r, cutsHere, h, true);
          if (!g) {
            bad.push(`${plan.id} planta ${floor} ${w.id}: no se pudo armar sin cortes`);
            continue;
          }
          const s = edgeStats(g);
          if (s.repeated || s.unmatched) bad.push(`${plan.id} planta ${floor} ${w.id}: la malla no es cerrada (${s.repeated} repetidas, ${s.unmatched} sin vecina)`);
          if (signedVolume(g) <= 0) bad.push(`${plan.id} planta ${floor} ${w.id}: hay caras que miran hacia adentro`);
        }
      }
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it("todos los muros se cortan a las mismas alturas (las de todas las aberturas): en las esquinas los vértices de un muro y del vecino coinciden", () => {
    const levelsOf = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute("position"),
        ys = new Set<number>();
      for (let i = 0; i < p.count; i++) ys.add(Math.round(p.getY(i) * 1e4));
      return [...ys].sort((a, b) => a - b);
    };
    const expected = [0, 0.9, 1.1, 1.5, 2.05, 2.1, 2.65].map((v) => Math.round(v * 1e4));
    const noCuts = buildContinuousSolid(ring, [], 2.65, true)!,
      withCuts = buildContinuousSolid(ring, cuts, 2.65, true)!;
    expect(levelsOf(noCuts)).toEqual(expected);
    expect(levelsOf(withCuts)).toEqual(expected);
  });

  it("la malla del muro se mantiene liviana (menos de 1500 triángulos por muro con seis aberturas)", () => {
    const six = [-2.75, -1.65, -0.55, 0.55, 1.65, 2.75].map((offset) => ({ type: "ventana" as const, offset })),
      walls8 = exteriorSegments(rect(8, 4)),
      g = buildContinuousSolid(wallLocalRing(walls8[0]!, walls8), six, 2.65, true)!;
    expect(g.getAttribute("position").count / 3).toBeLessThan(1500);
  });

  it("si una abertura no entra en el tramo recto del muro se usa el armado por tramos en vez de fallar", () => {
    const wide = [{ type: "ventanal" as const, offset: 2.9 }];
    expect(buildContinuousSolid(ring, wide, 2.65, true)).toBeNull();
    expect(buildWallSolid(ring, wide, 2.65)).not.toBeNull();
  });

  it("el muro de una planta con otra encima se prolonga unos milímetros dentro del de arriba", () => {
    expect(JOINT_OVERLAP).toBeGreaterThan(0);
    expect(JOINT_OVERLAP).toBeLessThan(0.02);
  });
});
