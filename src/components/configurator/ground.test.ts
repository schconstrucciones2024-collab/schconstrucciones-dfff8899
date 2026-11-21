import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * El suelo (arena o césped) del visor 3D. Antes, con "Ver bajo la casa" activado se volvía casi transparente y la casa quedaba
 * flotando en el cielo; además dependía de que la textura cargara. Estas pruebas leen el código del suelo y fijan lo que no puede volver
 * a pasar: ningún suelo transparente y siempre un suelo de respaldo liso que llega hasta el horizonte.
 */
const source = readFileSync(`${process.cwd()}/src/components/configurator/House.tsx`, "utf8"),
  start = source.indexOf("export function Ground()"),
  end = source.indexOf("function GroundGrass");

describe("suelo del visor", () => {
  // sin comentarios: lo que cuenta es el código
  const ground = source.slice(start, end).replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

  it("se encuentra el código del suelo", () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });

  it("nunca es transparente ni depende de 'Ver bajo la casa'", () => {
    expect(ground).not.toMatch(/transparent/);
    expect(ground).not.toMatch(/opacity/);
    expect(ground).not.toMatch(/underHouse/);
    expect(ground).not.toMatch(/depthWrite/);
  });

  it("tiene un suelo de respaldo liso y grande, un poco más abajo que el texturado", () => {
    expect(ground).toMatch(/planeGeometry args=\{\[400, 400\]\}/);
    expect(ground).toMatch(/position-y=\{-0\.02\}/);
    expect(ground).toMatch(/GROUND_BASE_COLOR/);
  });

  it("dibuja siempre el pasto y la arena sueltos (no se ocultan)", () => {
    expect(ground).toMatch(/<GroundGrass sand=\{ground === "arena"\} \/>/);
    expect(source.slice(end)).not.toMatch(/hidden/);
  });
});
