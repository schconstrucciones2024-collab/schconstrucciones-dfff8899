import { describe, expect, it } from "vitest";
import { SYSTEMS, TEXTURED_WALL_MATERIALS, defaultOptions, type SystemId } from "@/config/wallSystems";
import { triangleCount, solidFromSpec, type Vec3 } from "./wallGeometry";
import { TR, WF, buildWall, partBounds, presentLayerIds, type Part, type WallModel } from "./wallModel";

type Box = { min: Vec3; max: Vec3 };
const overlapVolume = (a: Box, b: Box) => {
  let v = 1;
  for (let k = 0; k < 3; k++) {
    const d = Math.min(a.max[k]!, b.max[k]!) - Math.max(a.min[k]!, b.min[k]!);
    if (d <= 1e-9) return 0;
    v *= d;
  }
  return v;
};
const inside = (inner: Box, outer: Box, eps = 1e-9) => [0, 1, 2].every((k) => inner.min[k]! >= outer.min[k]! - eps && inner.max[k]! <= outer.max[k]! + eps);

function combos(system: SystemId): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const o of SYSTEMS[system].options) out = out.flatMap((base) => o.values.map((v) => ({ ...base, [o.key]: v.value })));
  return out;
}

const layer = (m: WallModel, id: string) => m.layers.find((l) => l.id === id)!;
const layerBox = (m: WallModel, id: string): Box => {
  const bs = layer(m, id).parts.map(partBounds);
  return {
    min: [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k]!))) as Vec3,
    max: [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k]!))) as Vec3,
  };
};

describe("Wood Frame: capas", () => {
  const m = buildWall("woodframe");

  it("de adentro hacia afuera: interior, lana de vidrio, estructura, OSB, membrana, clavaderas, exterior", () => {
    expect(m.layers.map((l) => l.id)).toEqual(["interior", "aislacion", "estructura", "osb", "membrana", "clavaderas", "exterior"]);
  });

  it("cada capa tiene piezas y usa materiales con mapas PBR", () => {
    for (const l of m.layers) {
      expect(l.parts.length).toBeGreaterThan(0);
      for (const p of l.parts) expect(TEXTURED_WALL_MATERIALS.includes(p.material)).toBe(true);
    }
  });

  it("las capas se apilan sin pisarse a lo largo del espesor", () => {
    const order = ["interior", "estructura", "osb", "membrana", "clavaderas", "exterior"];
    for (let i = 0; i < order.length - 1; i++) {
      const a = layerBox(m, order[i]!), b = layerBox(m, order[i + 1]!);
      expect(a.max[2]!).toBeLessThanOrEqual(b.min[2]! + 1e-9);
    }
  });

  it("la lana de vidrio llena los huecos del bastidor sin pisar los montantes", () => {
    const wool = layer(m, "aislacion").parts.map(partBounds);
    const wood = layer(m, "estructura").parts.map(partBounds);
    expect(wool.length).toBe(6);
    for (const w of wool) for (const s of wood) expect(overlapVolume(w, s)).toBe(0);
    expect(inside(layerBox(m, "aislacion"), layerBox(m, "estructura"))).toBe(true);
  });

  it("el bastidor tiene montantes y soleras (arriba y abajo)", () => {
    const parts = layer(m, "estructura").parts;
    expect(parts.length).toBe(7 + 2);
    expect(parts.filter((p) => p.spec.k === "box" && p.spec.rot).length).toBe(2);
  });

  it("el siding gris claro es el exterior por defecto y tiene 14 tablas alineadas con el mapa (7 por metro)", () => {
    expect(defaultOptions("woodframe").exterior).toBe("siding");
    const ext = layer(m, "exterior").parts;
    expect(ext.length).toBe(14);
    expect(ext.every((p) => p.material === "sidingModerno")).toBe(true);
    for (let i = 0; i < ext.length; i++) expect(ext[i]!.pos[1]).toBeCloseTo(i * WF.board, 9);
    expect(layerBox(m, "exterior").max[1]).toBeCloseTo(WF.H, 6);
  });

  it("clavaderas: sin ellas la capa desaparece y el revestimiento exterior queda apoyado en la membrana", () => {
    const con = buildWall("woodframe", { battens: "con" });
    const sin = buildWall("woodframe", { battens: "sin" });
    expect(sin.layers.some((l) => l.id === "clavaderas")).toBe(false);
    expect(presentLayerIds("woodframe", { battens: "sin" }).includes("clavaderas")).toBe(false);
    expect(layerBox(con, "exterior").min[2]! - layerBox(sin, "exterior").min[2]!).toBeCloseTo(WF.batten.d, 9);
    expect(layerBox(sin, "exterior").min[2]!).toBeCloseTo(layerBox(sin, "membrana").max[2]!, 9);
    expect(layerBox(con, "exterior").min[2]!).toBeCloseTo(layerBox(con, "clavaderas").max[2]!, 9);
  });

  it("cada revestimiento interior usa su propio material", () => {
    const expected: Record<string, string> = { yeso: "drywall", chaponPino: "chaponPino", chaponEucalipto: "chaponEucalipto", machimbre: "machimbre" };
    for (const [opt, material] of Object.entries(expected)) {
      const w = buildWall("woodframe", { interior: opt });
      expect(layer(w, "interior").parts.every((p) => p.material === material)).toBe(true);
    }
  });

  it("cada revestimiento exterior usa su propio material y geometría", () => {
    const siding = buildWall("woodframe", { exterior: "siding" });
    const tablas = buildWall("woodframe", { exterior: "tablas" });
    const chapa = buildWall("woodframe", { exterior: "chapa" });
    expect(layer(siding, "exterior").parts[0]!.material).toBe("sidingModerno");
    expect(layer(tablas, "exterior").parts[0]!.material).toBe("sidingAllwood");
    expect(layer(chapa, "exterior").parts[0]!.material).toBe("chapa");
    expect(layer(chapa, "exterior").parts[0]!.spec.k).toBe("corr");
  });

  it("el interior tapa todo el ancho y el alto de la pared", () => {
    for (const interior of ["yeso", "chaponPino", "chaponEucalipto", "machimbre"]) {
      const w = buildWall("woodframe", { interior });
      const b = layerBox(w, "interior");
      expect(b.min[0]).toBeCloseTo(-WF.W / 2, 2);
      expect(b.max[0]).toBeCloseTo(WF.W / 2, 2);
      expect(b.min[1]).toBeCloseTo(0, 2);
      expect(b.max[1]).toBeCloseTo(WF.H, 2);
    }
  });

  it("al explotar, cada capa se aleja de la estructura en el orden correcto", () => {
    const z = m.layers.map((l) => l.explode[2]);
    expect(layer(m, "estructura").explode).toEqual([0, 0, 0]);
    for (let i = 0; i < z.length - 1; i++) expect(z[i]!).toBeLessThan(z[i + 1]!);
    expect(layer(m, "interior").explode[2]).toBeLessThan(0);
    expect(layer(m, "exterior").explode[2]).toBeGreaterThan(0);
  });

  it("explotada, la pila queda separada (ninguna capa se pisa con la siguiente)", () => {
    const order = ["interior", "estructura", "osb", "membrana", "clavaderas", "exterior"];
    for (let i = 0; i < order.length - 1; i++) {
      const a = layerBox(m, order[i]!), b = layerBox(m, order[i + 1]!);
      const gap = (b.min[2]! + layer(m, order[i + 1]!).explode[2]!) - (a.max[2]! + layer(m, order[i]!).explode[2]!);
      expect(gap).toBeGreaterThan(0.1);
    }
  });

  it("todas las combinaciones de opciones se arman y mantienen el orden", () => {
    const all = combos("woodframe");
    expect(all.length).toBe(4 * 2 * 3);
    for (const o of all) {
      const w = buildWall("woodframe", o);
      expect(w.layers.length).toBe(o.battens === "sin" ? 6 : 7);
      expect(w.layers[0]!.id).toBe("interior");
      expect(w.layers[w.layers.length - 1]!.id).toBe("exterior");
    }
  });
});

describe("construcción tradicional: capas", () => {
  const variants = [{ masonry: "ticholo" }, { masonry: "comun" }];

  for (const v of variants) {
    const m = buildWall("tradicional", v);
    const name = v.masonry === "ticholo" ? "ladrillo hueco (ticholo)" : "ladrillo común";

    it(`${name}: tiene las siete capas en orden`, () => {
      expect(m.layers.map((l) => l.id)).toEqual(["revoqueInt", "mortero", "mamposteria", "encadenadoH", "encadenadoV", "dintel", "revoqueExt"]);
    });

    it(`${name}: ninguna pieza se pisa con otra (salvo las armaduras, que van dentro del hormigón)`, () => {
      const all: { part: Part; box: Box; layer: string }[] = [];
      for (const l of m.layers) for (const p of l.parts) if (p.material !== "acero") all.push({ part: p, box: partBounds(p), layer: l.id });
      expect(all.length).toBeGreaterThan(100);
      let hits = 0;
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!, b = all[j]!;
        if (a.box.max[0]! <= b.box.min[0]! || b.box.max[0]! <= a.box.min[0]!) continue;
        if (overlapVolume(a.box, b.box) > 1e-9) hits++;
      }
      expect(hits).toBe(0);
    });

    it(`${name}: las armaduras quedan dentro de su pieza de hormigón`, () => {
      for (const id of ["encadenadoH", "encadenadoV", "dintel"]) {
        const l = layer(m, id);
        const steel = l.parts.filter((p) => p.material === "acero");
        const conc = l.parts.filter((p) => p.material === "hormigon");
        expect(steel.length).toBeGreaterThan(8);
        for (const s of steel) {
          const sb = partBounds(s);
          expect(conc.some((c) => inside(sb, partBounds(c), 1e-6))).toBe(true);
        }
      }
    });

    it(`${name}: la abertura queda libre de mampostería, mortero y revoques`, () => {
      const hole: Box = { min: [TR.opening.x0, TR.opening.y0, -1], max: [TR.opening.x1, TR.opening.y1, 1] };
      for (const l of m.layers) for (const p of l.parts) expect(overlapVolume(partBounds(p), hole)).toBe(0);
    });

    it(`${name}: el dintel cubre la abertura y apoya a los dos lados`, () => {
      const b = layerBox(m, "dintel");
      expect(b.min[0]!).toBeLessThanOrEqual(TR.opening.x0 - TR.bearing + 1e-9);
      expect(b.max[0]!).toBeGreaterThanOrEqual(TR.opening.x1 + TR.bearing - 1e-9);
      expect(b.min[1]!).toBeCloseTo(TR.opening.y1, 9);
    });

    it(`${name}: encadenado vertical a cada extremo y horizontal arriba de todo`, () => {
      const v = layer(m, "encadenadoV").parts.filter((p) => p.material === "hormigon").map(partBounds);
      expect(v.length).toBe(2);
      expect(Math.min(...v.map((b) => b.min[0]))).toBeCloseTo(-TR.W / 2, 9);
      expect(Math.max(...v.map((b) => b.max[0]))).toBeCloseTo(TR.W / 2, 9);
      const h = layerBox(m, "encadenadoH");
      expect(h.max[1]).toBeCloseTo(TR.Hm + TR.beam, 9);
      expect(h.min[1]).toBeCloseTo(TR.Hm, 9);
    });

    it(`${name}: la mampostería llena el tramo entre columnas, trabada (hiladas alternadas)`, () => {
      const parts = layer(m, "mamposteria").parts;
      const b = layerBox(m, "mamposteria");
      expect(b.min[0]).toBeCloseTo(-TR.W / 2 + TR.col, 6);
      expect(b.max[0]).toBeCloseTo(TR.W / 2 - TR.col, 6);
      expect(b.max[1]).toBeLessThanOrEqual(TR.Hm + 1e-9);
      const pitch = (v.masonry === "ticholo" ? TR.ticholo.h : TR.comun.h) + TR.joint;
      const startOf = (course: number) => Math.min(...parts.filter((p) => Math.abs(p.pos[1] - (course * pitch + (v.masonry === "ticholo" ? TR.ticholo.h : TR.comun.h) / 2)) < 1e-6 && partBounds(p).min[0]! < 0).map((p) => partBounds(p).max[0]! - partBounds(p).min[0]!));
      expect(startOf(1)).toBeLessThan(startOf(0) - 0.01);
    });
  }

  it("el ticholo es hueco (celdas pasantes) y el común es macizo", () => {
    const t = buildWall("tradicional", { masonry: "ticholo" });
    const c = buildWall("tradicional", { masonry: "comun" });
    expect(layer(t, "mamposteria").parts.every((p) => p.spec.k === "hollow" && p.material === "ladrilloHueco")).toBe(true);
    expect(layer(c, "mamposteria").parts.every((p) => p.spec.k === "box" && p.material === "ladrilloComun")).toBe(true);
  });

  it("ambas mamposterías tienen exactamente el mismo alto (9 hiladas de ticholo = 27 de ladrillo común)", () => {
    const t = layerBox(buildWall("tradicional", { masonry: "ticholo" }), "mamposteria");
    const c = layerBox(buildWall("tradicional", { masonry: "comun" }), "mamposteria");
    expect(Math.abs(t.max[1]! - c.max[1]!)).toBeLessThan(1e-9);
  });

  it("revoque exterior: se puede ver con y sin", () => {
    expect(buildWall("tradicional", { revoqueExt: "con" }).layers.some((l) => l.id === "revoqueExt")).toBe(true);
    expect(buildWall("tradicional", { revoqueExt: "sin" }).layers.some((l) => l.id === "revoqueExt")).toBe(false);
    expect(presentLayerIds("tradicional", { revoqueExt: "sin" }).includes("revoqueExt")).toBe(false);
  });

  it("hormigón: con armaduras a la vista es translúcido; sólido es opaco", () => {
    const tr = buildWall("tradicional", { hormigon: "translucido" });
    const so = buildWall("tradicional", { hormigon: "solido" });
    const conc = (m: WallModel) => m.layers.flatMap((l) => l.parts).filter((p) => p.material === "hormigon");
    expect(conc(tr).every((p) => p.opacity !== undefined && p.opacity < 1)).toBe(true);
    expect(conc(so).every((p) => p.opacity === undefined)).toBe(true);
  });

  it("al explotar: revoques hacia los lados del espesor, hormigón hacia arriba y a los costados", () => {
    const m = buildWall("tradicional");
    expect(layer(m, "revoqueInt").explode[2]).toBeLessThan(0);
    expect(layer(m, "revoqueExt").explode[2]).toBeGreaterThan(0);
    expect(layer(m, "mortero").explode[2]).toBeLessThan(0);
    expect(layer(m, "encadenadoH").explode[1]).toBeGreaterThan(0);
    expect(layer(m, "dintel").explode[1]).toBeGreaterThan(0);
    const exs = layer(m, "encadenadoV").parts.map((p) => p.ex?.[0] ?? 0);
    expect(exs.some((x) => x < 0)).toBe(true);
    expect(exs.some((x) => x > 0)).toBe(true);
  });

  it("todas las combinaciones se arman", () => {
    const all = combos("tradicional");
    expect(all.length).toBe(2 * 2 * 2);
    for (const o of all) expect(buildWall("tradicional", o).layers.length).toBe(o.revoqueExt === "sin" ? 6 : 7);
  });
});

describe("costo de dibujo", () => {
  it("las mallas del modelo más pesado entran cómodas en un celular (menos de 120 mil triángulos)", () => {
    for (const system of ["woodframe", "tradicional"] as SystemId[]) for (const o of combos(system)) {
      const m = buildWall(system, o);
      const tris = m.layers.flatMap((l) => l.parts).reduce((acc, p) => acc + triangleCount(solidFromSpec(p.spec)), 0);
      expect(tris).toBeLessThan(120000);
    }
  });

  it("las piezas repetidas comparten malla (pocas mallas distintas por pared)", () => {
    const m = buildWall("tradicional", { masonry: "ticholo" });
    const keys = new Set(m.layers.flatMap((l) => l.parts).map((p) => JSON.stringify(p.spec)));
    expect(keys.size).toBeLessThan(m.layers.flatMap((l) => l.parts).length / 2);
  });

  it("cada pieza tiene un id único", () => {
    for (const system of ["woodframe", "tradicional"] as SystemId[]) {
      const ids = buildWall(system).layers.flatMap((l) => l.parts.map((p) => p.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
