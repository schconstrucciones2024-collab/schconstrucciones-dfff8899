import { beforeEach, describe, expect, it } from "vitest";
import {
  TRADICIONAL_STARTER_ID,
  buildLayoutProposal,
  decodeDesign,
  encodeDesign,
  initialConfig,
  placedRooms,
  roomLabelKey,
  roomName,
  startingPlan,
  useConfigurator,
} from "./useConfigurator";
import { detectRooms } from "@/config/geometry";
import { PLAN_CATALOG, isLShape, planArea } from "@/config/layoutProposals";
import { DEFAULT_FOUNDATION, TRADICIONAL_MAX_PITCH, systemOf, systemPatch } from "@/config/systems";

const st = () => useConfigurator.getState();
const config = () => st().config;
const fresh = () =>
  useConfigurator.setState({
    config: initialConfig(),
    past: [],
    future: [],
    selectedId: null,
    error: null,
    activeFloor: 0,
  });
const plan = (id: string) => {
  const p = PLAN_CATALOG.find((v) => v.id === id);
  if (!p) throw new Error(`falta la distribución ${id}`);
  return p;
};
const toTradicional = () => st().update(systemPatch(config(), "tradicional"));

describe("reiniciar respeta el sistema constructivo", () => {
  beforeEach(fresh);

  it("en woodframe vuelve a la Compacta abierta de siempre", () => {
    st().update({ m2: 90, floors: 2 });
    st().reset();
    expect(config()).toEqual(initialConfig());
    expect(config().finish).toBe("rustica");
    expect(config().foundation).toBe("madera");
    expect(config().roofPitch).toBe(20);
  });

  it("en tradicional vuelve al diseño tradicional de arranque, no al de woodframe", () => {
    toTradicional();
    st().update({ finish: "clasica" });
    st().update({ m2: 120, floors: 2 });
    st().reset();
    const c = config();
    expect(systemOf(c.finish)).toBe("tradicional");
    expect(c.finish).toBe("esencial");
    expect(c.foundation).toBe(DEFAULT_FOUNDATION.tradicional);
    expect(c.roofType).toBe("dos");
    expect(c.roofPitch).toBeLessThanOrEqual(TRADICIONAL_MAX_PITCH);
    expect(c.floors).toBe(1);
    expect(c.m2).toBe(48);
    expect(c).toEqual(initialConfig("tradicional"));
    expect(st().error).toBeNull();
  });

  it("el diseño tradicional de arranque es la distribución recomendada de 48 m², completa", () => {
    const c = initialConfig("tradicional");
    expect(c).toEqual(
      buildLayoutProposal({ ...initialConfig("tradicional") }, plan(TRADICIONAL_STARTER_ID)),
    );
    expect(plan(TRADICIONAL_STARTER_ID).system).toBe("tradicional");
    expect(plan(TRADICIONAL_STARTER_ID).recommended).toBe(true);
    expect(c.footprint).toBe("rectangular");
    expect(c.counters.some((v) => v.kind === "cocina")).toBe(true);
    expect(c.openings.some((o) => o.type === "entrada")).toBe(true);
    const placed = placedRooms(c);
    expect(placed.bedrooms).toBeGreaterThanOrEqual(1);
    expect(placed.bathrooms).toBeGreaterThanOrEqual(1);
  });

  it("initialConfig() sin argumento no cambió y el link compartido de ambos diseños se recupera igual", () => {
    expect(initialConfig().finish).toBe("rustica");
    for (const c of [initialConfig(), initialConfig("tradicional")]) {
      const back = decodeDesign(encodeDesign(c));
      expect(back?.finish).toBe(c.finish);
      expect(back?.foundation).toBe(c.foundation);
      expect(back?.m2).toBeCloseTo(c.m2, 6);
    }
  });

  it("reiniciar se puede deshacer", () => {
    toTradicional();
    st().update({ m2: 100 });
    const before = config();
    st().reset();
    expect(config().m2).toBe(48);
    st().undo();
    expect(config()).toEqual(before);
  });

  it("'Distribución sugerida' en la huella 6 × 8 de una planta usa la propuesta del sistema", () => {
    toTradicional();
    st().layout(true);
    st().layout(false);
    expect(config()).toEqual(initialConfig("tradicional"));
    st().update(systemPatch(config(), "woodframe"));
    st().layout(false);
    expect(config().walls).toEqual(initialConfig().walls);
  });
});

describe("forma de la casa en L", () => {
  beforeEach(fresh);

  it.each([
    ["woodframe", 1, "wf-l-patio"],
    ["woodframe", 2, "wf-l-dos-plantas"],
    ["woodframe", 3, "wf-l-tres-plantas"],
    ["tradicional", 1, "tr-l-patio"],
    ["tradicional", 2, "tr-l-dos-plantas"],
    ["tradicional", 3, "tr-l-tres-plantas"],
  ] as const)("%s con %i planta(s) aplica %s", (system, floors, id) => {
    if (system === "tradicional") toTradicional();
    st().update({ m2: floors * 40 });
    st().update({ floors });
    expect(config().floors).toBe(floors);
    st().applyShape("L");
    expect(st().error).toBeNull();
    const c = config();
    expect(isLShape(c.contour)).toBe(true);
    expect(c.footprint).toBe("L");
    expect(c.floors).toBe(floors);
    expect(c.m2).toBeCloseTo(planArea(plan(id)), 4);
    expect(systemOf(c.finish)).toBe(system); // la forma no cambia de sistema
    expect(c.walls).toHaveLength(floors);
    expect(c.walls.every((w) => w.length > 0)).toBe(true);
    expect(c.stairs.filter((s) => !s.exterior)).toHaveLength(floors - 1);
  });

  it("volver a Compacta o Alargada saca la L y arma una distribución nueva en un rectángulo", () => {
    st().applyShape("L");
    const m2 = config().m2;
    st().applyShape("alargada");
    let c = config();
    expect(isLShape(c.contour)).toBe(false);
    expect(c.footprint).toBe("rectangular");
    expect(c.shape).toBe("alargada");
    expect(c.m2).toBeCloseTo(m2, 3);
    expect(c.walls[0]?.length).toBeGreaterThan(0);
    expect(c.stairs.some((s) => s.exterior)).toBe(true);
    expect(st().error).toBeNull();
    st().applyShape("L");
    st().applyShape("compacta");
    c = config();
    expect(isLShape(c.contour)).toBe(false);
    expect(c.shape).toBe("compacta");
  });

  it("de un rectángulo, Compacta y Alargada cambian la proporción con una distribución nueva y sin errores", () => {
    const start = config().shape; // la Compacta abierta de 6 × 8 m es más profunda que ancha
    const other = start === "compacta" ? "alargada" : "compacta";
    for (const shape of [other, start, other]) {
      st().applyShape(shape);
      const c = config();
      expect(st().error).toBeNull();
      expect(c.shape).toBe(shape);
      expect(c.footprint).toBe("rectangular");
      expect(c.m2).toBeCloseTo(48, 3);
      expect(c.walls[0]?.length).toBeGreaterThan(0);
      expect(c.stairs.some((s) => s.exterior)).toBe(true);
      const placed = placedRooms(c);
      expect(placed.bedrooms).toBeGreaterThanOrEqual(c.bedrooms);
      expect(placed.bathrooms).toBeGreaterThanOrEqual(c.bathrooms);
    }
    const history = st().past.length;
    st().applyShape(config().shape); // ya está en esa forma: no hace nada
    expect(st().past.length).toBe(history);
  });

  it("elegir En L estando en L no hace nada, y se deshace en un paso", () => {
    const before = config();
    st().applyShape("L");
    const l = config();
    expect(isLShape(l.contour)).toBe(true);
    const history = st().past.length;
    st().applyShape("L");
    expect(st().past.length).toBe(history);
    st().undo();
    expect(config()).toEqual(before);
  });

  it("'Distribución sugerida' en una casa en L vuelve a la propuesta en L del sistema", () => {
    toTradicional();
    st().applyShape("L");
    const applied = config();
    st().layout(true);
    expect(config().walls[0]).toEqual([]);
    st().layout(false);
    expect(config().walls).toEqual(applied.walls);
    expect(config().stairs).toEqual(applied.stairs);
    expect(startingPlan(config())).toBeDefined();
  });

  it("el diseño en L sobrevive al link compartido", () => {
    st().applyShape("L");
    const c = config();
    const back = decodeDesign(encodeDesign(c));
    expect(back).not.toBeNull();
    expect(isLShape(back!.contour)).toBe(true);
    expect(back!.walls.map((w) => w.length)).toEqual(c.walls.map((w) => w.length));
  });
});

describe("nombres de ambientes por planta", () => {
  it("un ambiente con el mismo contorno en dos plantas lleva el nombre de cada una", () => {
    const c = buildLayoutProposal(initialConfig("tradicional"), plan("tr-duplex"));
    const names = (floor: number) =>
      detectRooms(c.contour, c.walls[floor] ?? []).map((r, i) => roomName(c, floor, r, i));
    expect(names(0)).toContain("Cocina");
    expect(names(1)).toContain("Dormitorio principal");
    expect(names(0)).not.toContain("Dormitorio principal");
    expect(names(1)).not.toContain("Cocina");
    expect(roomLabelKey(0, "room-1")).toBe("room-1");
    expect(roomLabelKey(2, "room-1")).toBe("2:room-1");
  });
});
