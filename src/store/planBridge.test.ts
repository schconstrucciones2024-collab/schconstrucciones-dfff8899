import { describe, expect, it } from "vitest";
import { PLAN_CATALOG } from "@/config/layoutProposals";
import { detectRooms, polygonArea } from "@/config/geometry";
import { EMPTY_PLAN, addOpening, addRectangle, addWall, analyzePlan, setLabel, type PlanDoc } from "@/config/planDraw";
import { buildLayoutProposal, designWalls, initialConfig, useConfigurator, validateOpening } from "@/store/useConfigurator";
import { configToPlan, planToConfig } from "./planBridge";

let n = 0;
const id = (p: string) => `${p}${++n}`;
const P = (x: number, z: number) => ({ x, z });
const rect = (w: number, d: number): PlanDoc => addRectangle(EMPTY_PLAN, P(0, 0), P(w, d), id).doc;

describe("del plano al diseñador 3D", () => {
  it("un rectángulo de 6 × 8 m se convierte en una casa de 48 m² centrada, con la distribución en blanco", () => {
    const r = planToConfig(rect(6, 8), initialConfig());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.m2).toBeCloseTo(48, 6);
    expect(r.config.floors).toBe(1);
    expect(r.config.contour[0]).toEqual(P(-3, -4));
    expect(r.config.contour[2]).toEqual(P(3, 4));
    expect(r.config.walls[0]).toHaveLength(0);
    expect(r.config.footprint).toBe("rectangular");
  });

  it("conserva sistema, terminación y fundación de la casa actual", () => {
    const base = initialConfig("tradicional");
    const r = planToConfig(rect(6, 8), base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.finish).toBe(base.finish);
    expect(r.config.foundation).toBe(base.foundation);
    expect(r.config.roofPitch).toBe(base.roofPitch);
  });

  it("sin forma cerrada o fuera de límites explica por qué no se puede", () => {
    const open = addWall(EMPTY_PLAN, P(0, 0), P(5, 0), id).doc;
    const a = planToConfig(open, initialConfig());
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.errors[0]).toMatch(/cerrada/);
    const big = planToConfig(rect(30, 20), initialConfig());
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.errors.join(" ")).toMatch(/500/);
  });

  it("tabiques, puertas, ventanas y nombres llegan al diseño y son válidos para el diseñador", () => {
    let doc = addWall(rect(6, 8), P(0, 4), P(6, 4), id).doc;
    const front = doc.walls.find((w) => w.a.z === 8 && w.b.z === 8)!;
    const partition = doc.walls.find((w) => w.a.z === 4 && w.b.z === 4)!;
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    doc = addOpening(doc, "puerta", front.id, 3, id).doc;
    doc = addOpening(doc, "puerta", partition.id, 3, id).doc;
    doc = addOpening(doc, "ventana", top.id, 3, id).doc;
    doc = setLabel(doc, P(3, 2), "Dormitorio", id);
    doc = setLabel(doc, P(3, 6), "Living", id);
    const r = planToConfig(doc, initialConfig());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.config;
    expect(c.walls[0]).toHaveLength(1);
    expect(c.openings.map((o) => o.type).sort()).toEqual(["entrada", "interior", "ventana"]);
    for (const o of c.openings) expect(validateOpening(c, o)).toBeNull();
    expect(Object.values(c.roomLabels).sort()).toEqual(["Dormitorio", "Living"]);
    expect(c.stairs).toHaveLength(1);
    expect(c.stairs[0]!.wall).toBe("edge-2");
    expect(r.warnings).toHaveLength(0);
  });

  it("el diseñador acepta el diseño: queda en el historial y se puede deshacer", () => {
    const before = useConfigurator.getState().config;
    const r = planToConfig(addWall(rect(7, 9), P(0, 4.5), P(7, 4.5), id).doc, before);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    useConfigurator.getState().replaceDesign(r.config);
    expect(useConfigurator.getState().error).toBeNull();
    expect(useConfigurator.getState().config.m2).toBeCloseTo(63, 6);
    useConfigurator.getState().undo();
    expect(useConfigurator.getState().config.m2).toBeCloseTo(polygonArea(before.contour), 6);
  });

  it("una abertura que no entra se avisa y no rompe el pasaje", () => {
    let doc = rect(6, 8);
    const top = doc.walls.find((w) => w.a.z === 0 && w.b.z === 0)!;
    doc = addOpening(doc, "ventana", top.id, 0.3, id).doc;
    const r = planToConfig(doc, initialConfig());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.openings).toHaveLength(0);
    expect(r.warnings.join(" ")).toMatch(/abertura/);
  });

  it("una casa en L con tabique se convierte con su forma real", () => {
    let doc = addRectangle(EMPTY_PLAN, P(0, 0), P(8, 4), id).doc;
    doc = addRectangle(doc, P(0, 4), P(4, 8), id).doc;
    const r = planToConfig(doc, initialConfig());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.footprint).toBe("L");
    expect(r.config.m2).toBeCloseTo(48, 6);
    expect(r.config.roofType).toBeDefined();
  });
});

describe("del diseñador 3D al plano y de vuelta", () => {
  it("la casa inicial se dibuja en el plano con su misma superficie, ambientes y aberturas", () => {
    const c = initialConfig();
    const plan = configToPlan(c);
    const a = analyzePlan(plan);
    expect(a.contour).not.toBeNull();
    expect(a.area).toBeCloseTo(polygonArea(c.contour), 5);
    expect(a.openings.length).toBe(c.openings.filter((o) => o.floor === 0).length);
    expect(a.openings.every((o) => !o.problem)).toBe(true);
  });

  it("las distribuciones del catálogo (planta baja) sobreviven a ida y vuelta sin perder ambientes ni aberturas", () => {
    const failures: string[] = [];
    for (const proposal of PLAN_CATALOG) {
      const c = buildLayoutProposal(initialConfig(), proposal);
      const plan = configToPlan(c);
      const r = planToConfig(plan, c);
      if (!r.ok) { failures.push(`${proposal.id}: ${r.errors.join(" / ")}`); continue; }
      const want = c.openings.filter((o) => o.floor === 0).length;
      if (r.config.openings.length !== want) failures.push(`${proposal.id}: aberturas ${r.config.openings.length}/${want} (${r.warnings.join(" ")})`);
      if (Math.abs(r.config.m2 - c.m2 / c.floors) > 1e-4) failures.push(`${proposal.id}: superficie ${r.config.m2} vs ${c.m2 / c.floors}`);
      const rooms = (h: typeof r.config) => detectRooms(h.contour, h.walls[0] ?? []).length;
      if (rooms(r.config) !== rooms(c)) failures.push(`${proposal.id}: ambientes ${rooms(r.config)}/${rooms(c)}`);
      if (designWalls(r.config, 0).length > designWalls(c, 0).length) failures.push(`${proposal.id}: más paredes de las esperadas`);
    }
    expect(PLAN_CATALOG.length).toBeGreaterThan(30);
    expect(failures).toEqual([]);
  });
});
