import { describe, expect, it } from "vitest";
import { PLAN_CATALOG, planFloors } from "@/config/layoutProposals";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { bounds, detectRooms, distance, inside, project, stairGeometry, transformPoint, type Point, type Stair } from "@/config/geometry";
import { buildLayoutProposal, designWalls, FLOOR_STEP, initialConfig, stairConflict, stairLanding, type HouseConfig } from "@/store/useConfigurator";

/**
 * Circulación de cada distribución del catálogo, planta por planta, como la recorrería una persona:
 *  - la escalera sube a un lugar desde el que se llega a TODOS los ambientes de la planta de arriba (no a una pared, no a un hueco);
 *  - desde la entrada se llega a todos los ambientes de la planta baja y a la entrada de la escalera;
 *  - ninguna puerta da contra una escalera, un hueco o un muro.
 */
const CELL = 0.1;

type Grid = { cells: Uint8Array; w: number; h: number; minX: number; minZ: number };

function stairEnds(s: Stair) {
  const g = stairGeometry(s, FLOOR_STEP),
    first = g.steps[0]!,
    last = g.steps[g.steps.length - 1]!;
  const centre = (t: typeof first) => transformPoint({ x: t.x, z: t.z }, s.x, s.z, s.rotation),
    dirOf = (t: typeof first, sign: 1 | -1) => {
      const f = { x: -Math.sin(t.rotation) * sign, z: Math.cos(t.rotation) * sign },
        d = transformPoint(f, 0, 0, s.rotation),
        d0 = transformPoint({ x: 0, z: 0 }, 0, 0, s.rotation);
      return { x: d.x - d0.x, z: d.z - d0.z };
    };
  const lead = g.tread / 2 + 0.45,
    entryDir = dirOf(first, -1),
    exitDir = dirOf(last, 1),
    fc = centre(first),
    lc = centre(last);
  return {
    entry: { x: fc.x + entryDir.x * lead, z: fc.z + entryDir.z * lead },
    exit: { x: lc.x + exitDir.x * lead, z: lc.z + exitDir.z * lead },
  };
}

function walkGrid(c: HouseConfig, floor: number): Grid {
  const b = bounds(c.contour),
    w = Math.ceil((b.maxX - b.minX) / CELL) + 1,
    h = Math.ceil((b.maxZ - b.minZ) / CELL) + 1,
    walls = designWalls(c, floor),
    doors = c.openings
      .filter((o) => o.floor === floor && OPENINGS_CATALOG[o.type].door)
      .map((o) => {
        const wall = walls.find((v) => v.id === o.wall);
        if (!wall) return null;
        const len = distance(wall.a, wall.b),
          t = 0.5 + o.offset / len;
        return {
          wall,
          centre: { x: wall.a.x + (wall.b.x - wall.a.x) * t, z: wall.a.z + (wall.b.z - wall.a.z) * t },
          r: OPENINGS_CATALOG[o.type].width / 2 + 0.02,
        };
      })
      .filter((v): v is NonNullable<typeof v> => !!v),
    solid: Point[][] = [],
    voids: Point[][] = [];
  for (const s of c.stairs) {
    if (s.exterior) continue;
    const g = stairGeometry(s, FLOOR_STEP);
    if (s.floor === floor) solid.push(g.footprint);
    if (s.floor === floor - 1) voids.push(g.hole);
  }
  const cells = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const p = { x: b.minX + i * CELL, z: b.minZ + j * CELL };
      if (!inside(p, c.contour, false)) continue;
      let ok = true;
      for (const wall of walls) {
        const proj = project(p, wall.a, wall.b).point;
        if (distance(proj, p) < wall.thickness / 2 - 1e-6 && !doors.some((d) => d.wall.id === wall.id && distance(d.centre, proj) <= d.r)) {
          ok = false;
          break;
        }
      }
      if (ok && (voids.some((v) => inside(p, v, false)) || solid.some((v) => inside(p, v, false)))) ok = false;
      cells[j * w + i] = ok ? 1 : 0;
    }
  return { cells, w, h, minX: b.minX, minZ: b.minZ };
}

const cellOf = (g: Grid, p: Point) => ({ i: Math.round((p.x - g.minX) / CELL), j: Math.round((p.z - g.minZ) / CELL) });
const walkable = (g: Grid, p: Point) => {
  const { i, j } = cellOf(g, p);
  return i >= 0 && j >= 0 && i < g.w && j < g.h && g.cells[j * g.w + i] === 1;
};

/** Inunda desde `seed`, que tiene que ser una celda caminable (sin buscar una vecina): si no lo es, no hay forma de llegar. */
function flood(g: Grid, seed: Point): Uint8Array | null {
  if (!walkable(g, seed)) return null;
  const seen = new Uint8Array(g.w * g.h),
    { i, j } = cellOf(g, seed),
    stack = [j * g.w + i];
  seen[stack[0]!] = 1;
  while (stack.length) {
    const k = stack.pop()!,
      ci = k % g.w,
      cj = (k - ci) / g.w;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = ci + di,
        nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= g.w || nj >= g.h) continue;
      const nk = nj * g.w + ni;
      if (seen[nk] || !g.cells[nk]) continue;
      seen[nk] = 1;
      stack.push(nk);
    }
  }
  return seen;
}

/** Punto a `d` metros del centro de la puerta, hacia un lado u otro del muro. */
function sidePoints(c: HouseConfig, floor: number, o: HouseConfig["openings"][number], d: number) {
  const wall = designWalls(c, floor).find((v) => v.id === o.wall);
  if (!wall) return null;
  const len = distance(wall.a, wall.b),
    t = 0.5 + o.offset / len,
    centre = { x: wall.a.x + (wall.b.x - wall.a.x) * t, z: wall.a.z + (wall.b.z - wall.a.z) * t },
    n = { x: -(wall.b.z - wall.a.z) / len, z: (wall.b.x - wall.a.x) / len };
  return [
    { x: centre.x + n.x * d, z: centre.z + n.z * d },
    { x: centre.x - n.x * d, z: centre.z - n.z * d },
  ];
}

function audit(c: HouseConfig, planId: string) {
  const problems: string[] = [];
  const tag = (floor: number, msg: string) => problems.push(`${planId} planta ${floor}: ${msg}`);
  for (let floor = 0; floor < c.floors; floor++) {
    const grid = walkGrid(c, floor),
      seeds: { name: string; p: Point }[] = [];
    if (floor === 0) {
      const door = c.openings.find((o) => o.floor === 0 && OPENINGS_CATALOG[o.type].door && o.wall.startsWith("edge-"));
      if (!door) tag(floor, "no tiene puerta de entrada");
      else {
        const pts = sidePoints(c, 0, door, 0.7);
        const inner = pts?.find((p) => inside(p, c.contour, false));
        if (inner) seeds.push({ name: "entrada", p: inner });
      }
    } else
      for (const s of c.stairs.filter((v) => !v.exterior && v.floor === floor - 1)) seeds.push({ name: `salida de la escalera ${s.id}`, p: stairEnds(s).exit });
    if (!seeds.length) tag(floor, "no hay por dónde llegar a esta planta");
    for (const seed of seeds) {
      const seen = flood(grid, seed.p);
      if (!seen) {
        tag(floor, `${seed.name}: el punto de llegada cae contra un muro, un hueco o fuera de la casa`);
        continue;
      }
      const reached = (p: Point) => {
        const { i, j } = cellOf(grid, p);
        return i >= 0 && j >= 0 && i < grid.w && j < grid.h && seen[j * grid.w + i] === 1;
      };
      // Ambientes: cada uno tiene que quedar alcanzable (casi) entero.
      for (const room of detectRooms(c.contour, designWalls(c, floor).filter((w) => !w.id.startsWith("edge-")))) {
        let total = 0,
          got = 0;
        const bb = bounds(room.polygon);
        for (let z = bb.minZ; z <= bb.maxZ; z += CELL)
          for (let x = bb.minX; x <= bb.maxX; x += CELL) {
            const p = { x, z };
            if (!inside(p, room.polygon, false) || (room.holes ?? []).some((h) => inside(p, h, false)) || !walkable(grid, p)) continue;
            total++;
            if (reached(p)) got++;
          }
        if (total > 40 && got / total < 0.97) tag(floor, `${seed.name}: el ambiente ${room.id} queda sin acceso (${got}/${total} celdas alcanzables)`);
      }
      // Las puertas interiores: las dos caras tienen que ser caminables (nada de puertas que abren contra una escalera o un hueco).
      for (const o of c.openings.filter((v) => v.floor === floor && OPENINGS_CATALOG[v.type].door && !v.wall.startsWith("edge-"))) {
        const pts = sidePoints(c, floor, o, 0.55);
        if (!pts) continue;
        if (!pts.every((p) => walkable(grid, p) && reached(p))) tag(floor, `${seed.name}: la puerta de ${o.wall} da contra una escalera, un hueco o un espacio sin acceso`);
      }
    }
    // Entrada de la escalera de esta planta: se llega desde donde se esté.
    if (floor === 0 || true)
      for (const s of c.stairs.filter((v) => !v.exterior && v.floor === floor)) {
        const e = stairEnds(s).entry,
          seed = seeds[0];
        if (!seed) continue;
        const seen = flood(grid, seed.p);
        if (!seen) continue;
        const { i, j } = cellOf(grid, e);
        if (!walkable(grid, e) || seen[j * grid.w + i] !== 1) tag(floor, `no se llega a la entrada de la escalera ${s.id}`);
      }
  }
  for (const s of c.stairs.filter((v) => !v.exterior)) {
    const l = stairLanding(c, s);
    if (l.entry < 0.85 - 1e-6 || l.exit < 0.85 - 1e-6) tag(s.floor, `la escalera ${s.id} tiene un descanso de ${Math.min(l.entry, l.exit).toFixed(2)} m (mínimo 0,85 m)`);
    const conflict = stairConflict(c, s);
    if (conflict) tag(s.floor, `la escalera ${s.id}: ${conflict}`);
  }
  return problems;
}

describe("circulación de las distribuciones", () => {
  const plans = PLAN_CATALOG.filter((p) => p.version === 2);
  it("hay distribuciones de varias plantas para revisar", () => {
    expect(plans.filter((p) => planFloors(p) >= 2).length).toBeGreaterThan(10);
  });
  it("de la entrada a todos los ambientes, y por la escalera a todos los de arriba", () => {
    const problems: string[] = [];
    for (const plan of plans) problems.push(...audit(buildLayoutProposal(initialConfig(plan.system ?? "woodframe"), plan), plan.id));
    expect(problems).toEqual([]);
  });
});
