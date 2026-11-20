import { describe, expect, it } from "vitest";
import polygonClipping from "polygon-clipping";
import type * as THREE from "three";
import { PLAN_CATALOG } from "@/config/layoutProposals";
import { exteriorSegments, isOrthogonal, miterPolygon, polygonArea, type Point } from "@/config/geometry";
import { buildLayoutProposal, designWalls, initialConfig, FLOOR_STEP } from "@/store/useConfigurator";
import { buildWallSolid, exteriorSolidHeight, floorsToDraw, innerFaceSpan, interiorSide, wallFrame, wallLocalRing } from "./wallSolid";

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
