import { describe, it, expect, beforeEach } from "vitest";
import { initialConfig, resizeConfig, useConfigurator, encodeDesign, decodeDesign, designUrl, stairConflict, suggestedLayout } from "./useConfigurator";
import { inside, stairGeometry } from "@/config/geometry";

const interior = (c: { stairs: { exterior: boolean }[] }) => c.stairs.filter((s) => !s.exterior);

describe("escaleras, guardado y diseño compartido", () => {
  beforeEach(() =>
    useConfigurator.setState({ config: resizeConfig(initialConfig(), { m2: 80, floors: 2 }), past: [], future: [], selectedId: null, error: null, activeFloor: 0 }),
  );
  it("cada diseño tiene escalera exterior hasta la puerta de entrada", () => {
    const ext = initialConfig().stairs.filter((s) => s.exterior);
    expect(ext.length).toBe(1);
    expect(ext[0]?.wall).toBe("edge-2");
  });
  it("al pasar a 2 plantas se agrega una escalera interior sola", () => {
    expect(interior(useConfigurator.getState().config).length).toBe(1);
  });
  it("con 3 plantas hay una escalera interior por cada nivel", () => {
    for (const c of [resizeConfig(initialConfig(), { m2: 120, floors: 3 }), suggestedLayout(resizeConfig(initialConfig(), { m2: 120, floors: 3 }))]) {
      const st = interior(c) as typeof c.stairs;
      expect(st.map((s) => s.floor).sort()).toEqual([0, 1]);
      for (const s of st) expect(stairConflict(c, s)).toBeNull();
    }
  });
  it("en casas chicas de 2 y 3 plantas siempre hay escalera por nivel", () => {
    for (const [m2, floors] of [[40, 2], [50, 2], [60, 3]] as const) {
      const c = resizeConfig(initialConfig(), { m2, floors });
      expect(interior(c).length).toBe(floors - 1);
      for (const st of c.stairs) expect(stairConflict(c, st)).toBeNull();
    }
  });
  it("todo peldaño con menos de 2 m libres queda bajo el hueco", () => {
    for (const [m2, floors] of [[40, 2], [60, 3], [120, 3]] as const) {
      const c = resizeConfig(initialConfig(), { m2, floors });
      for (const s of c.stairs.filter((v) => !v.exterior)) {
        const g = stairGeometry(s, 2.85);
        for (const t of g.steps.filter((t) => 2.85 - 0.2 - t.y < 2)) {
          const p = { x: s.x + t.x * Math.cos(s.rotation) - t.z * Math.sin(s.rotation), z: s.z + t.x * Math.sin(s.rotation) + t.z * Math.cos(s.rotation) };
          expect(inside(p, g.hole)).toBe(true);
        }
      }
    }
  });
  it("los peldaños altos quedan dentro del hueco de la planta superior", () => {
    const c = useConfigurator.getState().config, s = interior(c)[0] as (typeof c.stairs)[0];
    const g = stairGeometry(s, 2.85);
    const top = g.steps.at(-1)!;
    const p = { x: s.x + top.x * Math.cos(s.rotation) - top.z * Math.sin(s.rotation), z: s.z + top.x * Math.sin(s.rotation) + top.z * Math.cos(s.rotation) };
    expect(inside(p, g.hole)).toBe(true);
  });
  it("si se borra, se vuelve a agregar en un lugar libre", () => {
    const st = interior(useConfigurator.getState().config)[0] as unknown as { id: string };
    useConfigurator.getState().deleteObject(st.id);
    expect(interior(useConfigurator.getState().config).length).toBe(0);
    useConfigurator.getState().addStair(false);
    const s = useConfigurator.getState();
    expect(s.error).toBeNull();
    expect(interior(s.config).length).toBe(1);
  });
  it("rechaza escalera interior en una sola planta", () => {
    useConfigurator.setState({ config: initialConfig() });
    useConfigurator.getState().addStair(false);
    expect(interior(useConfigurator.getState().config).length).toBe(0);
    expect(useConfigurator.getState().error).not.toBeNull();
  });
  it("no deja mover la escalera a través de una pared", () => {
    const s = useConfigurator.getState(), st = interior(s.config)[0]!;
    const wall = s.config.walls[0]?.[0];
    if (!wall) return;
    const ok = s.editStair((st as unknown as { id: string }).id, { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 });
    expect(ok).toBe(false);
  });
  it("guarda y recupera el diseño con escalera sin pérdidas", () => {
    useConfigurator.getState().addStair(false);
    const c = useConfigurator.getState().config;
    expect(decodeDesign(encodeDesign(c))).toEqual(c);
  });
  it("el enlace compartido contiene un diseño que se puede abrir", () => {
    const c = useConfigurator.getState().config;
    const url = new URL(designUrl(c, "https://sch.example/?x=1#a"));
    expect(url.hash).toBe("#configurador-3d");
    expect(decodeDesign(url.searchParams.get("design")!)).toEqual(c);
  });
  it("ignora diseños compartidos corruptos", () => {
    expect(decodeDesign("basura")).toBeNull();
  });
});
