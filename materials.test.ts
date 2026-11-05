import { describe, expect, it } from "vitest";
import { FINISH_MATERIALS, MATERIAL_BOARDS, MATERIAL_NAMES, MATERIAL_TILE_M, materialTextureUrl, type MaterialKind } from "./materials";
import { FINISHES_BY_SYSTEM } from "./systems";

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

  it("las tres terminaciones de woodframe muestran el mismo siding gris claro", () => {
    for (const finish of FINISHES_BY_SYSTEM.woodframe) expectLightGraySiding(FINISH_MATERIALS[finish].siding);
  });
});

describe("terminaciones de construcción tradicional", () => {
  it("las dos llevan muros revocados por dentro y por fuera, sin siding", () => {
    for (const finish of FINISHES_BY_SYSTEM.tradicional) {
      const m = FINISH_MATERIALS[finish];
      expect(["revoque", "revoqueFino"]).toContain(m.wall);
      expect(m.siding).toBe(m.wall);
      expect(MATERIAL_BOARDS[m.siding]).toBeUndefined();
    }
  });

  it("Esencial: revoque común, cielorraso de yeso y piso cerámico", () => {
    expect(FINISH_MATERIALS.esencial).toEqual({ wall: "revoque", ceiling: "drywall", floor: "ceramico", siding: "revoque" });
  });

  it("Clásica: revoque fino, sin cielorraso (losa de hormigón a la vista) y porcelanato", () => {
    expect(FINISH_MATERIALS.clasica).toEqual({ wall: "revoqueFino", ceiling: "hormigon", floor: "porcelanato", siding: "revoqueFino" });
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

  it("la arena y el pasto se repiten cada 2 m, los pisos de baldosas según su tamaño y el resto cada 1 m", () => {
    expect(MATERIAL_TILE_M.arena).toBe(2);
    expect(MATERIAL_TILE_M.pasto).toBe(2);
    expect(MATERIAL_TILE_M.ceramico).toBe(0.9); // 2 × 2 baldosas de 45 cm
    expect(MATERIAL_TILE_M.porcelanato).toBe(1.2); // 2 × 2 baldosas de 60 cm
    const own = new Set<MaterialKind>(["arena", "pasto", "ceramico", "porcelanato"]);
    for (const kind of kinds.filter((k) => !own.has(k))) expect(MATERIAL_TILE_M[kind] ?? 1).toBe(1);
  });
});
