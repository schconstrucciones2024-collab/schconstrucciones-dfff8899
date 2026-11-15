import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILY_CONTINUITY, PRE_SCH_PROJECTS, PROJECTS, SCH_PROJECTS, SCH_PROJECT_COUNT, countProjects } from "./projects";
import { PROJECT_FACTS } from "./projectFacts";
import { projectJsonLd, projectPageTitle } from "./projectSeo";
import { PROJECT_STORIES } from "./projectStories";

const read = (file: string) => readFileSync(`${process.cwd()}/${file}`, "utf8");

describe("cuántos proyectos tiene el sitio", () => {
  it("son 11 proyectos de SCH en Punta del Diablo (10 portadas: la de La Diosa y La Clave del Diablo suma dos)", () => {
    expect(SCH_PROJECT_COUNT).toBe(11);
    expect(SCH_PROJECTS).toHaveLength(10);
    const laDiosa = PROJECTS.find((p) => p.name === "La Diosa");
    expect(laDiosa?.count).toBe(2);
    expect(countProjects(SCH_PROJECTS)).toBe(11);
    expect(countProjects(PROJECTS)).toBe(13);
  });

  it("todos los proyectos de SCH que se cuentan están en Punta del Diablo", () => {
    for (const story of PROJECT_STORIES.filter((s) => !s.preSCH)) expect(story.location, story.slug).toContain("Punta del Diablo");
  });

  it("Le Sirenuse y Complejo Alvear son las dos obras anteriores a SCH y no entran en el 11", () => {
    expect(PRE_SCH_PROJECTS.map((p) => p.name)).toEqual(["Le Sirenuse", "Complejo Alvear"]);
    expect(SCH_PROJECTS.some((p) => p.preSCH)).toBe(false);
  });

  it("el contador de la home usa esa cifra y no la cantidad de portadas", () => {
    const pillars = read("src/components/home/Pillars.tsx");
    expect(pillars).toContain("<CountUp to={SCH_PROJECT_COUNT}");
    expect(pillars).not.toContain("PROJECTS.length");
    expect(pillars).toContain("proyectos de SCH en Punta del Diablo");
    expect(pillars).toContain("FAMILY_CONTINUITY");
    const portfolio = read("src/components/home/Portfolio.tsx");
    expect(portfolio).toContain("SCH_PROJECT_COUNT");
    expect(portfolio).toContain("Obras de la Familia Sánchez");
    expect(portfolio).toContain("FAMILY_CONTINUITY");
  });
});

describe("La Diosa y La Clave del Diablo", () => {
  it("el sitio suma 11 pero no aclara que sean dos proyectos distintos (así lo pidió la empresa)", () => {
    const visible = [
      read("src/components/home/Pillars.tsx"),
      read("src/components/home/Portfolio.tsx"),
      JSON.stringify(PROJECT_FACTS["la-diosa"]),
      JSON.stringify(PROJECTS.find((p) => p.name === "La Diosa")),
    ].join("\n");
    expect(visible).not.toMatch(/dos proyectos|se cuentan como dos|proyectos (diferentes|distintos)|2: La Diosa/i);
    const story = PROJECT_STORIES.find((p) => p.slug === "la-diosa");
    expect(story?.name).toBe("La Diosa");
    expect(story?.subtitle).toBe("La Clave del Diablo");
  });
});

describe("obras anteriores a SCH (Familia Sánchez)", () => {
  it("la frase de continuidad es la de la empresa", () => {
    expect(FAMILY_CONTINUITY).toBe("Seguimos siendo la Familia Sánchez, ahora bajo el nombre de SCH Construcciones.");
  });

  it("ni los textos alternativos ni las fichas se las atribuyen a SCH", () => {
    for (const project of PRE_SCH_PROJECTS) {
      expect(project.alt, project.name).toContain("Familia Sánchez");
      expect(project.alt, project.name).toContain("anterior a SCH Construcciones");
      expect(project.alt, project.name).not.toMatch(/realizad[oa] por SCH/);
    }
    for (const slug of ["le-sirenuse", "complejo-alvear"]) {
      const facts = PROJECT_FACTS[slug]!;
      expect(facts.note, slug).toContain("Obra anterior a SCH Construcciones");
      expect(facts.note, slug).toContain("cuando éramos la Familia Sánchez");
      expect(facts.note, slug).toContain(FAMILY_CONTINUITY);
      expect(facts.description, slug).toMatch(/antes de que existiera SCH Construcciones/);
    }
  });

  it("el título y los datos estructurados de su página dicen que no son de SCH", () => {
    for (const story of PROJECT_STORIES) {
      const [work] = projectJsonLd(story) as any[];
      if (story.preSCH) {
        expect(projectPageTitle(story), story.slug).toBe(`${story.name} | Antes de SCH: obra de la Familia Sánchez`);
        expect(projectPageTitle(story).length, story.slug).toBeLessThan(61);
        expect(work.creator.name, story.slug).toBe("Familia Sánchez");
        expect(work.creator["@type"], story.slug).toBe("Organization");
      } else {
        expect(projectPageTitle(story), story.slug).toBe(`${story.name} | Obras de SCH Construcciones`);
        expect(work.creator.name, story.slug).toBe("SCH Construcciones");
      }
    }
  });

  it("la página de la obra, el visor y la home lo dicen", () => {
    const page = read("src/components/home/ProjectExperience.tsx");
    expect(page).toContain("Antes de SCH · Familia Sánchez");
    expect(read("src/components/home/Lightbox.tsx")).toContain("Antes de SCH · Familia Sánchez");
    expect(read("src/components/home/About.tsx")).toContain("Seguimos siendo la Familia Sánchez, ahora bajo el nombre de SCH Construcciones");
    expect(read("src/data/servicios.ts")).toContain("Obras de la Familia Sánchez anteriores a SCH Construcciones: Complejo Alvear");
  });
});
