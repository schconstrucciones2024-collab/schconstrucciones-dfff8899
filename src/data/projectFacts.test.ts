import { describe, expect, it } from "vitest";
import { PROJECT_FACTS } from "./projectFacts";
import { PROJECT_STORIES } from "./projectStories";

describe("datos de cada obra", () => {
  it("hay datos para las doce obras y para ninguna más", () => {
    expect(Object.keys(PROJECT_FACTS).sort()).toEqual(PROJECT_STORIES.map((p) => p.slug).sort());
  });

  it("cada obra tiene descripción para SEO, datos y trabajos realizados", () => {
    for (const story of PROJECT_STORIES) {
      expect(story.description.length, story.slug).toBeGreaterThan(80);
      expect(story.description.length, story.slug).toBeLessThan(400);
      expect(story.subtitle.length, story.slug).toBeGreaterThan(3);
      expect(story.data.length, story.slug).toBeGreaterThan(0);
      expect(story.spaces.length, story.slug).toBeGreaterThan(0);
      for (const [label, value] of story.data) {
        expect(label.trim(), story.slug).not.toBe("");
        expect(value.trim(), story.slug).not.toBe("");
      }
    }
  });

  it("no inventa testimonios, premios ni cantidades de clientes", () => {
    const text = JSON.stringify(PROJECT_FACTS);
    expect(text).not.toMatch(/premio|galard[oó]n|certificaci[oó]n|testimonio|clientes satisfechos|\d+\s*clientes/i);
  });

  it("mantiene las superficies documentadas de las obras de referencia", () => {
    expect(PROJECT_FACTS["lo-de-cata"]!.area).toContain("60");
    expect(PROJECT_FACTS["laslu"]!.area).toContain("96");
    expect(PROJECT_FACTS["le-sirenuse"]!.data.flat().join(" ")).toContain("27");
  });
});
