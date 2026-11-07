import { describe, expect, it } from "vitest";
import {
  PLAN_CATALOG,
  isLShape,
  planArea,
  planFloors,
  planLevels,
  planShape,
  plansFor,
  recommendedPlan,
  type LayoutProposal,
  type PlanSystem,
} from "./layoutProposals";
import {
  buildLayoutProposal,
  decodeDesign,
  encodeDesign,
  initialConfig,
  resolveWall,
  roomName,
  stairConflict,
  useConfigurator,
  validateOpening,
  type HouseConfig,
} from "@/store/useConfigurator";
import {
  FIXTURE_SIZES,
  bounds,
  detectRooms,
  distance,
  inside,
  segmentInside,
  stairGeometry,
  transformPoint,
  validateContour,
  wallOverlap,
  type Point,
} from "./geometry";
import { OPENINGS_CATALOG } from "./openingsCatalog";
import { systemPatch } from "./systems";

const baseFor = (system: PlanSystem): HouseConfig => {
  const c = initialConfig();
  return { ...c, ...systemPatch(c, system) };
};
const openingPoint = (c: HouseConfig, o: HouseConfig["openings"][number]): Point => {
  const w = resolveWall(c, o.wall, o.floor)!,
    len = distance(w.a, w.b),
    t = 0.5 + o.offset / len;
  return { x: w.a.x + (w.b.x - w.a.x) * t, z: w.a.z + (w.b.z - w.a.z) * t };
};
type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const boxOf = (cx: number, cz: number, w: number, d: number, rotation: number): Box => {
  const swap = Math.abs(Math.sin(rotation)) > 0.5,
    hw = (swap ? d : w) / 2,
    hd = (swap ? w : d) / 2;
  return { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd };
};
const within = (p: Point, b: Box, m = 0) =>
  p.x > b.minX - m && p.x < b.maxX + m && p.z > b.minZ - m && p.z < b.maxZ + m;

/** Revisión de una propuesta: geometría válida, programa completo, aberturas, mobiliario, escaleras y criterios de proyecto. */
export function issuesFor(plan: LayoutProposal): string[] {
  const out: string[] = [];
  const system = plan.system ?? "woodframe",
    floors = planFloors(plan),
    base = baseFor(system),
    c = buildLayoutProposal(base, plan),
    q = (x: number, z: number): Point => ({ x: x - plan.width / 2, z: z - plan.depth / 2 }),
    levels = planLevels(plan);
  if (c.floors !== floors || levels.length !== floors)
    out.push(`plantas: ${c.floors} en el diseño, ${floors} declaradas`);
  const contourError = validateContour(c.contour, c.floors);
  if (contourError) out.push(`contorno: ${contourError}`);
  if (planShape(plan) === "L" ? !isLShape(c.contour) : c.contour.length !== 4)
    out.push("la forma no coincide con la declarada");
  if (Math.abs(c.m2 - planArea(plan)) > 1e-6) out.push(`m²: ${c.m2} vs ${planArea(plan)}`);
  if (c.m2 > 200 || (floors > 1 && c.m2 / floors < 20))
    out.push(`superficie fuera de rango: ${c.m2}`);
  // El store acepta el diseño tal cual (misma validación que al aplicarlo desde la galería).
  useConfigurator.setState({ config: base, past: [], future: [], error: null });
  useConfigurator.getState().replaceDesign(c);
  const applied = useConfigurator.getState();
  if (applied.error) out.push(`el store lo rechaza: ${applied.error}`);
  else if (applied.config.walls.length !== floors) out.push("el store no aplicó el diseño");
  for (const [f, ws] of c.walls.entries())
    for (const w of ws) {
      if (!segmentInside(w.a, w.b, c.contour)) out.push(`muro fuera de la casa en planta ${f}`);
      if (wallOverlap(w, ws)) out.push(`muros superpuestos en planta ${f}`);
    }
  for (const o of c.openings) {
    const e = validateOpening(c, o);
    if (e) out.push(`abertura inválida ${o.id}: ${e}`);
  }
  for (const s of c.stairs) {
    const e = stairConflict(c, s);
    if (e) out.push(`escalera ${s.id}: ${e}`);
  }
  for (let f = 0; f < floors - 1; f++)
    if (!c.stairs.some((s) => !s.exterior && s.floor === f))
      out.push(`falta la escalera de la planta ${f}`);
  if (!c.stairs.some((s) => s.exterior)) out.push("falta la escalinata de entrada");

  // Aberturas pedidas: cada una quedó en su lugar.
  const expected: [string, number, Point][] = [];
  if (plan.entrance) expected.push([plan.entrance.type, 0, q(plan.entrance.x, plan.depth)]);
  levels.forEach((l, f) => {
    for (const [t, x, z] of l.openings ?? []) expected.push([t, f, q(x, z)]);
    for (const r of l.rooms)
      for (const d of r.doors ?? (r.door ? [r.door] : []))
        expected.push(["interior", f, q(d.x, d.z)]);
  });
  for (const [type, f, p] of expected)
    if (
      !c.openings.some(
        (o) => o.type === type && o.floor === f && distance(openingPoint(c, o), p) < 0.06,
      )
    )
      out.push(
        `falta ${type} en planta ${f} cerca de (${(p.x + plan.width / 2).toFixed(2)}; ${(p.z + plan.depth / 2).toFixed(2)})`,
      );

  // Ambientes: superficie, nombre, artefactos, luz natural y medidas mínimas.
  let beds = 0,
    baths = 0;
  levels.forEach((l, f) => {
    const rooms = detectRooms(c.contour, c.walls[f] ?? []);
    const nameOf = (r: (typeof rooms)[number]) => roomName(c, f, r, rooms.indexOf(r));
    for (const box of l.rooms) {
      const center = q(box.x + box.w / 2, box.z + box.d / 2),
        room = rooms.find(
          (r) =>
            inside(center, r.polygon) && !(r.holes ?? []).some((h) => inside(center, h, false)),
        );
      const tag = `${box.name} (planta ${f})`;
      if (!room) {
        out.push(`${tag}: no se detecta como ambiente`);
        continue;
      }
      if (Math.abs(room.area - box.w * box.d) > 0.01)
        out.push(`${tag}: superficie ${room.area.toFixed(2)} vs ${(box.w * box.d).toFixed(2)}`);
      if (nameOf(room) !== box.name) out.push(`${tag}: figura con el nombre «${nameOf(room)}»`);
      const here = c.fixtures
        .filter((v) => v.floor === f && inside(v, room.polygon))
        .map((v) => v.kind)
        .sort();
      const want = box.kind === "bed" ? ["cama"] : box.kind === "bath" ? ["ducha", "wc"] : [];
      if (JSON.stringify(here) !== JSON.stringify(want))
        out.push(`${tag}: artefactos ${here.join(",")} en lugar de ${want.join(",")}`);
      const min = Math.min(box.w, box.d),
        area = box.w * box.d;
      const rule = {
        bed: [2.7, 7.5],
        bath: [2, 4.5],
        kitchen: [2.2, 5.5],
        living: [2.7, 9],
        study: [2.2, 5],
        service: [1.5, 2.5],
        hall: [0.9, 0],
      }[box.kind];
      if (min < rule[0]! - 1e-9 || area < rule[1]! - 1e-9)
        out.push(`${tag}: medidas mínimas (${box.w} × ${box.d})`);
      if (box.kind === "bed") beds++;
      if (box.kind === "bath") baths++;
      if (["bed", "bath", "kitchen"].includes(box.kind)) {
        const edge: Box = { minX: box.x, maxX: box.x + box.w, minZ: box.z, maxZ: box.z + box.d };
        const lit = c.openings.some((o) => {
          if (o.floor !== f || OPENINGS_CATALOG[o.type].walls === "interior") return false;
          const p = openingPoint(c, o),
            s = { x: p.x + plan.width / 2, z: p.z + plan.depth / 2 };
          return (
            (Math.abs(s.x - edge.minX) < 0.01 || Math.abs(s.x - edge.maxX) < 0.01
              ? s.z > edge.minZ && s.z < edge.maxZ
              : Math.abs(s.z - edge.minZ) < 0.01 || Math.abs(s.z - edge.maxZ) < 0.01
                ? s.x > edge.minX && s.x < edge.maxX
                : false) && !o.wall.startsWith("wall-")
          );
        });
        if (!lit) out.push(`${tag}: sin ventana al exterior`);
      }
    }
    // Los sectores abiertos tienen nombre propio, no el de un ambiente cerrado.
    for (const r of rooms) if (!nameOf(r)) out.push(`ambiente sin nombre en planta ${f}`);
  });
  if (beds !== plan.bedrooms) out.push(`dormitorios: ${beds} vs ${plan.bedrooms} declarados`);
  if (baths !== plan.bathrooms) out.push(`baños: ${baths} vs ${plan.bathrooms} declarados`);
  if (c.fixtures.filter((v) => v.kind === "cama").length !== beds)
    out.push("camas que no corresponden a un dormitorio");

  // Mobiliario: dentro de la casa, sin atravesar muros y sin bloquear una puerta.
  const items = [
    ...c.fixtures.map((v) => ({
      id: v.id,
      floor: v.floor,
      box: boxOf(v.x, v.z, FIXTURE_SIZES[v.kind].width, FIXTURE_SIZES[v.kind].depth, v.rotation),
    })),
    ...c.counters.map((v) => ({
      id: v.id,
      floor: v.floor,
      box: boxOf(v.x, v.z, v.length, v.depth, v.rotation),
    })),
  ];
  for (const it of items) {
    const corners = [
      [it.box.minX, it.box.minZ],
      [it.box.maxX, it.box.minZ],
      [it.box.maxX, it.box.maxZ],
      [it.box.minX, it.box.maxZ],
    ];
    if (!corners.every(([x, z]) => inside({ x: x!, z: z! }, c.contour)))
      out.push(`${it.id} sale del contorno`);
    for (const w of c.walls[it.floor] ?? []) {
      const n = Math.max(2, Math.ceil(distance(w.a, w.b) / 0.05));
      for (let i = 0; i <= n; i++) {
        const p = { x: w.a.x + ((w.b.x - w.a.x) * i) / n, z: w.a.z + ((w.b.z - w.a.z) * i) / n };
        if (within(p, it.box, -0.04)) {
          out.push(`${it.id} atraviesa un muro`);
          i = n + 1;
        }
      }
    }
  }
  for (const o of c.openings.filter(
    (v) => OPENINGS_CATALOG[v.type].door && v.type === "interior",
  )) {
    const w = resolveWall(c, o.wall, o.floor)!,
      p = openingPoint(c, o),
      len = distance(w.a, w.b),
      nx = -(w.b.z - w.a.z) / len,
      nz = (w.b.x - w.a.x) / len;
    for (const side of [-1, 1])
      for (const reach of [0.35, 0.7]) {
        const s = { x: p.x + nx * side * reach, z: p.z + nz * side * reach };
        for (const it of items)
          if (it.floor === o.floor && within(s, it.box, 0.03))
            out.push(`${it.id} bloquea la puerta ${o.id}`);
      }
  }
  // Escaleras: se llega por un lado y se sale a un sector de circulación, no a un dormitorio o un baño.
  for (const s of c.stairs.filter((v) => !v.exterior)) {
    const g = stairGeometry(s, 2.85),
      at = (x: number, z: number) => transformPoint({ x, z }, s.x, s.z, s.rotation);
    const entry = at(0, -0.45),
      exit =
        s.type === "recta"
          ? at(0, g.count * g.tread + 0.45)
          : s.type === "L"
            ? at(
                (g.count - g.first) * g.tread + s.width / 2 + 0.45,
                g.first * g.tread + s.width / 2,
              )
            : s.type === "U"
              ? at(s.width, -0.45)
              : null;
    const blocked = (p: Point, f: number) =>
      (levels[f]?.rooms ?? []).some(
        (r) =>
          r.kind !== "hall" &&
          inside(
            { x: p.x + plan.width / 2, z: p.z + plan.depth / 2 },
            [pt(r.x, r.z), pt(r.x + r.w, r.z), pt(r.x + r.w, r.z + r.d), pt(r.x, r.z + r.d)],
            false,
          ),
      );
    if (!inside(entry, c.contour, false) || blocked(entry, s.floor))
      out.push(`la escalera ${s.id} no tiene acceso libre`);
    if (exit && (!inside(exit, c.contour, false) || blocked(exit, s.floor + 1)))
      out.push(`la escalera ${s.id} no desemboca en circulación`);
  }
  const open0 = detectRooms(c.contour, c.walls[0] ?? []).filter(
    (r) =>
      !levels[0]?.rooms.some(
        (b) =>
          inside(q(b.x + b.w / 2, b.z + b.d / 2), r.polygon) &&
          !(r.holes ?? []).some((h) => inside(q(b.x + b.w / 2, b.z + b.d / 2), h, false)),
      ),
  );
  if (Math.max(0, ...open0.map((r) => r.area)) < 11)
    out.push("el sector social de planta baja es demasiado chico");
  const decoded = decodeDesign(encodeDesign(c));
  if (!decoded) out.push("el link para compartir no lo vuelve a abrir");
  else if (JSON.stringify(decoded) !== JSON.stringify(c) && Math.abs(decoded.m2 - c.m2) > 1e-6)
    out.push("el link para compartir cambia el diseño");
  void bounds;
  return out;
}
const pt = (x: number, z: number): Point => ({ x, z });

describe("catálogo de distribuciones", () => {
  it("tiene propuestas para cada sistema, cantidad de plantas y forma", () => {
    for (const system of ["woodframe", "tradicional"] as const)
      for (const floors of [1, 2, 3])
        for (const shape of ["rectangular", "L"] as const) {
          expect(
            plansFor(system, floors, shape).length,
            `${system} ${floors} plantas ${shape}`,
          ).toBeGreaterThan(0);
          expect(recommendedPlan(system, floors, shape)).toBeDefined();
        }
  });
  it("los identificadores son únicos y cada sistema tiene más de cuatro propuestas", () => {
    expect(new Set(PLAN_CATALOG.map((p) => p.id)).size).toBe(PLAN_CATALOG.length);
    expect(plansFor("woodframe").length).toBeGreaterThan(4);
    expect(plansFor("tradicional").length).toBeGreaterThan(4);
  });
  it("las propuestas tradicionales son distintas de las de woodframe", () => {
    const wood = new Set(plansFor("woodframe").map((p) => p.id));
    expect(plansFor("tradicional").every((p) => !wood.has(p.id))).toBe(true);
  });
  for (const plan of PLAN_CATALOG.filter((p) => p.version === 2))
    it(`${plan.name} (${plan.system}, ${planFloors(plan)} pl., ${planShape(plan)}): proyecto válido`, () => {
      expect(issuesFor(plan)).toEqual([]);
    });
});
