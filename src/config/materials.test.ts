import { describe, expect, it } from "vitest";
import { FINISH_MATERIALS, MATERIAL_BOARDS, MATERIAL_NAMES, MATERIAL_TILE_M, materialTextureUrl, type MaterialKind } from "./materials";

/** El revestimiento exterior es gris claro en las tres terminaciones. */
function expectLightGraySiding(kind: MaterialKind) {
  const boards = MATERIAL_BOARDS[kind];
  if (!boards) throw new Error(`Falta la definición de tablas de ${kind}`);
  const [r, g, b] = boards.base;
  expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(180); // claro, no grafito
  expect(Math.max(r, g, b)).toBeLessThanOrEqual(235); // sin quemarse a blanco
  expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(12); // gris neutro, sin virar a beige ni a azul
  expect(boards.tone).toBe("mineral"); // textura de siding pintado, no veta de madera
}

describe("siding exterior", () => {
  it("es gris claro neutro con textura mineral", () => {
    expectLightGraySiding("sidingModerno");
  });

  it("las tres terminaciones muestran el mismo siding gris claro", () => {
    for (const finish of Object.keys(FINISH_MATERIALS) as (keyof typeof FINISH_MATERIALS)[]) {
      expectLightGraySiding(FINISH_MATERIALS[finish].siding);
    }
  });
});

describe("texturas PBR del visor 3D", () => {
  // Vite lista los archivos reales de public/textures (no los importa): sirve para verificar que no falte ninguno.
  const files = new Set(Object.keys(import.meta.glob("../../public/textures/*/*.webp")));
  const kinds = Object.keys(MATERIAL_NAMES) as MaterialKind[];

  it("cada material tiene mapa de color, normal y ORM, en 1024 px y en 512 px para celulares", () => {
    for (const kind of kinds) {
      for (const map of ["albedo", "normal", "orm"] as const) {
        for (const low of [false, true]) {
          expect(files.has(`../../public${materialTextureUrl(kind, map, low)}`), `${kind} ${map}${low ? " (512)" : ""}`).toBe(true);
        }
      }
    }
  });

  it("la URL apunta a public/textures/<material>/<mapa>.webp", () => {
    expect(materialTextureUrl("pisoPino", "albedo")).toBe("/textures/pisoPino/albedo.webp");
    expect(materialTextureUrl("pasto", "normal", true)).toBe("/textures/pasto/normal-512.webp");
  });

  it("la arena y el pasto se repiten cada 2 m y el resto cada 1 m", () => {
    expect(MATERIAL_TILE_M.arena).toBe(2);
    expect(MATERIAL_TILE_M.pasto).toBe(2);
    for (const kind of kinds.filter((k) => k !== "arena" && k !== "pasto")) expect(MATERIAL_TILE_M[kind] ?? 1).toBe(1);
  });
});
