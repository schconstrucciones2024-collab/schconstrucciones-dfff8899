import { describe, expect, it } from "vitest";
import {
  BATHROOM_MATERIALS,
  BATHROOM_TILE_HEIGHT,
  FINISH_MATERIALS,
  MATERIAL_NAMES,
} from "@/config/materials";
import { FINISHES_BY_SYSTEM, systemPatch } from "@/config/systems";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { detectRooms, distance, inside, polygonArea, type Point } from "@/config/geometry";
import { PLAN_CATALOG, planFloors, type LayoutProposal } from "@/config/layoutProposals";
import {
  buildLayoutProposal,
  initialConfig,
  resolveWall,
  roomName,
  type HouseConfig,
} from "@/store/useConfigurator";
import { bathSurfaces, isBathName } from "./bathTiling";

const build = (plan: LayoutProposal, finish?: HouseConfig["finish"]): HouseConfig => {
  const base = initialConfig();
  const c = buildLayoutProposal(
    { ...base, ...systemPatch(base, plan.system ?? "woodframe") },
    plan,
  );
  return finish ? { ...c, finish } : c;
};

describe("baños de woodframe: piso antideslizante y pared de cerámica", () => {
  it("las tres terminaciones de woodframe lo llevan y la tradicional no", () => {
    for (const f of FINISHES_BY_SYSTEM.woodframe) {
      expect(BATHROOM_MATERIALS[f]).toEqual({
        floor: "ceramicoAntideslizante",
        wall: "ceramicoBano",
      });
    }
    for (const f of FINISHES_BY_SYSTEM.tradicional) expect(BATHROOM_MATERIALS[f]).toBeUndefined();
    expect(MATERIAL_NAMES.ceramicoAntideslizante).toBe("Piso cerámico antideslizante");
    expect(MATERIAL_NAMES.ceramicoBano).toBe("Pared de cerámica");
  });

  it("no cambia los materiales del resto de la casa", () => {
    expect(FINISH_MATERIALS.rustica.floor).toBe("pisoPino");
    expect(FINISH_MATERIALS.esencial.floor).toBe("ceramico");
  });

  it("reconoce los nombres de baño", () => {
    for (const n of ["Baño", "Baño suite", "Baño social", "baño en suite", "Toilette"])
      expect(isBathName(n)).toBe(true);
    for (const n of ["Dormitorio", "Cocina", "Lavadero", "Estar"])
      expect(isBathName(n)).toBe(false);
  });

  const woodPlans = PLAN_CATALOG.filter((p) => (p.system ?? "woodframe") === "woodframe");
  it("cada distribución de woodframe tiene cerámica en todos sus baños", () => {
    for (const plan of woodPlans) {
      const c = build(plan);
      let baths = 0;
      for (let floor = 0; floor < c.floors; floor++) {
        const rooms = detectRooms(c.contour, c.walls[floor] ?? []);
        const named = rooms.filter((r, i) => /^baño/i.test(roomName(c, floor, r, i)));
        baths += named.length;
        const s = bathSurfaces(c, floor);
        expect(s.floors.length, `${plan.id} planta ${floor}: pisos`).toBe(named.length);
        // El piso cubre casi todo el ambiente (menos el espesor de las paredes) y nunca más que el ambiente.
        const room = named.reduce((a, r) => a + r.area, 0);
        const tiled = s.floors.reduce((a, rings) => a + polygonArea(rings[0] ?? []), 0);
        expect(tiled, `${plan.id} planta ${floor}`).toBeLessThan(room);
        expect(tiled, `${plan.id} planta ${floor}`).toBeGreaterThan(room * 0.55);
        // Todas las paredes miran hacia adentro del baño y llegan hasta el cielorraso.
        for (const f of s.faces) {
          const mid = {
            x: f.a.x + (f.dir.x * (f.t0 + f.t1)) / 2 + f.n.x * 0.05,
            z: f.a.z + (f.dir.z * (f.t0 + f.t1)) / 2 + f.n.z * 0.05,
          };
          const inBath = s.floors.some(
            (rings) => inside(mid, rings[0] ?? []) && !rings.slice(1).some((h) => inside(mid, h)),
          );
          expect(inBath, `${plan.id}: paño mirando hacia afuera`).toBe(true);
          expect(f.y1).toBeLessThanOrEqual(BATHROOM_TILE_HEIGHT + 1e-9);
        }
        const top = Math.max(...s.faces.map((f) => f.y1));
        expect(top).toBeCloseTo(BATHROOM_TILE_HEIGHT, 6);
      }
      expect(baths, `${plan.id}: baños`).toBeGreaterThanOrEqual(1);
    }
  });

  it("las puertas y ventanas del baño quedan sin cerámica", () => {
    for (const plan of woodPlans) {
      const c = build(plan);
      for (let floor = 0; floor < c.floors; floor++) {
        const s = bathSurfaces(c, floor);
        for (const o of c.openings.filter((x) => x.floor === floor)) {
          const w = resolveWall(c, o.wall, floor);
          if (!w) continue;
          const len = distance(w.a, w.b);
          const spec = OPENINGS_CATALOG[o.type];
          const center: Point = {
            x: (w.a.x + w.b.x) / 2 + ((w.b.x - w.a.x) / len) * o.offset,
            z: (w.a.z + w.b.z) / 2 + ((w.b.z - w.a.z) / len) * o.offset,
          };
          const probeY = spec.sill + spec.height / 2;
          for (const f of s.faces) {
            const off = { x: center.x - f.a.x, z: center.z - f.a.z };
            const across = Math.abs(off.x * f.dir.z - off.z * f.dir.x);
            if (across > w.thickness / 2 + 0.06) continue;
            const t = off.x * f.dir.x + off.z * f.dir.z;
            const covers = t > f.t0 + 0.02 && t < f.t1 - 0.02 && probeY > f.y0 && probeY < f.y1;
            expect(covers, `${plan.id}: ${o.type} tapada por la cerámica`).toBe(false);
          }
        }
      }
    }
  });

  it("la construcción tradicional no recibe este revestimiento (se decide por terminación)", () => {
    const tr = PLAN_CATALOG.find((p) => p.system === "tradicional");
    expect(tr).toBeDefined();
    expect(BATHROOM_MATERIALS[build(tr!).finish]).toBeUndefined();
  });

  it("un espacio abierto con un sanitario suelto no se reviste entero", () => {
    const base = initialConfig();
    const c: HouseConfig = {
      ...base,
      walls: [[]],
      fixtures: [{ id: "f1", kind: "wc", floor: 0, x: 0, z: 0, rotation: 0 }],
      roomLabels: {},
      openings: [],
    };
    const s = bathSurfaces(c, 0);
    expect(s.floors.length).toBe(0);
    expect(planFloors(PLAN_CATALOG[0]!)).toBeGreaterThanOrEqual(1);
  });
});
