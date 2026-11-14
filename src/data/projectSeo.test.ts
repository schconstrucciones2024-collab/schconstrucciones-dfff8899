import { describe, expect, it } from "vitest";
import { projectJsonLd } from "./projectSeo";
import { PROJECT_STORIES } from "./projectStories";

describe("SEO de cada obra", () => {
  it("cada obra declara la obra y su ruta de navegación, con URLs absolutas del sitio", () => {
    for (const story of PROJECT_STORIES) {
      const [work, crumbs] = projectJsonLd(story) as any[];
      expect(work["@type"], story.slug).toBe("CreativeWork");
      expect(work.url, story.slug).toBe(`https://schconstrucciones.lovable.app/proyectos/${story.slug}`);
      expect(work.description, story.slug).toBe(story.description);
      expect(crumbs["@type"], story.slug).toBe("BreadcrumbList");
      expect(crumbs.itemListElement.map((i: any) => i.position)).toEqual([1, 2, 3]);
      expect(crumbs.itemListElement[2].name).toBe(story.name);
      expect(crumbs.itemListElement[2].item).toBe(work.url);
    }
  });

  it("cada obra declara a SCH Construcciones como titular de los derechos", () => {
    for (const story of PROJECT_STORIES) {
      const [work] = projectJsonLd(story) as any[];
      expect(work.copyrightHolder.name, story.slug).toBe("SCH Construcciones");
      expect(work.copyrightNotice, story.slug).toContain("Todos los derechos reservados");
    }
  });

  it("el JSON-LD se puede serializar sin perder información", () => {
    const json = JSON.stringify(projectJsonLd(PROJECT_STORIES[0]!));
    expect(JSON.parse(json)).toHaveLength(2);
  });
});
