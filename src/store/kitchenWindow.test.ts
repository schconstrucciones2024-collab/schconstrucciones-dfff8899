import { describe, expect, it } from "vitest";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { LAYOUT_PROPOSALS } from "@/config/layoutProposals";
import { distance, exteriorSegments, project } from "@/config/geometry";
import { buildLayoutProposal, initialConfig, suggestedLayout, type HouseConfig } from "./useConfigurator";

const rect = (w: number, d: number) => [
  { x: -w / 2, z: -d / 2 },
  { x: w / 2, z: -d / 2 },
  { x: w / 2, z: d / 2 },
  { x: -w / 2, z: d / 2 },
];

/** Offset of a point along a wall, measured from the wall center (same convention as openings). */
const offsetOn = (wall: { a: { x: number; z: number }; b: { x: number; z: number } }, p: { x: number; z: number }) =>
  project(p, wall.a, wall.b).t * distance(wall.a, wall.b) - distance(wall.a, wall.b) / 2;

describe("ventana de cocina (120 x 40 cm)", () => {
  it("existe en el catálogo con esas medidas", () => {
    expect(OPENINGS_CATALOG.ventanaCocina.width).toBe(1.2);
    expect(OPENINGS_CATALOG.ventanaCocina.height).toBe(0.4);
  });

  it("el diseño inicial (Compacta abierta) la trae centrada sobre la mesada de cocina", () => {
    const c = initialConfig();
    const win = c.openings.find((o) => o.type === "ventanaCocina");
    const counter = c.counters.find((k) => k.kind === "cocina");
    expect(win).toBeDefined();
    expect(counter).toBeDefined();
    if (!win || !counter) throw new Error("Falta ventana o mesada de cocina");
    const wall = [...exteriorSegments(c.contour), ...(c.walls[0] ?? [])].find((w) => w.id === win.wall);
    if (!wall) throw new Error("Falta pared de cocina");
    expect(Math.abs(offsetOn(wall, counter) - win.offset)).toBeLessThan(0.05);
  });

  it("la distribución sugerida también la coloca centrada sobre la mesada", () => {
    const base = { ...initialConfig(), contour: rect(8, 6), m2: 48 } as HouseConfig;
    const c = suggestedLayout(base);
    const win = c.openings.find((o) => o.type === "ventanaCocina");
    const counter = c.counters.find((k) => k.kind === "cocina");
    expect(win).toBeDefined();
    expect(counter).toBeDefined();
    if (!win || !counter) throw new Error("Falta ventana o mesada de cocina");
    const wall = exteriorSegments(c.contour).find((w) => w.id === win.wall);
    if (!wall) throw new Error("Falta pared de cocina");
    expect(Math.abs(offsetOn(wall, counter) - win.offset)).toBeLessThan(0.05);
  });

  it.each(LAYOUT_PROPOSALS)("$name conserva solo la rectangular en la pared de cocina, sin quitar las de los dormitorios", (proposal) => {
    const c = buildLayoutProposal(initialConfig(), proposal);
    const win = c.openings.find((o) => o.type === "ventanaCocina");
    const counter = c.counters.find((k) => k.kind === "cocina");
    if (!win || !counter) throw new Error("Falta ventana o mesada de cocina");
    expect(c.openings.filter((o) => o.wall === win.wall && o.floor === win.floor).map((o) => o.type)).toEqual(["ventanaCocina"]);
    const wall = exteriorSegments(c.contour).find((w) => w.id === win.wall);
    if (!wall) throw new Error("Falta pared de cocina");
    expect(offsetOn(wall, counter)).toBeCloseTo(win.offset);
    expect(c.openings.some((o) => o.type === "ventana")).toBe(true);
  });
});
