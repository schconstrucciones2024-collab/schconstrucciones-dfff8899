import { describe, expect, it } from "vitest";
import { CONTACT, PROJECTS } from "./projects";
import { responsive, thumbnail } from "@/lib/img";

describe("Obras del portfolio", () => {
  it("mantiene las 12 obras reales, cada una con portada y galería", () => {
    expect(PROJECTS).toHaveLength(12);
    for (const project of PROJECTS) {
      expect(project.name.length).toBeGreaterThan(0);
      expect(project.alt.length).toBeGreaterThan(0);
      expect(project.images.length).toBeGreaterThanOrEqual(2);
      expect(project.images[0]).toBe(project.src);
    }
  });

  it("sirve las fotos desde public/images, sin depender de Lovable", () => {
    for (const project of PROJECTS) {
      for (const url of project.images) expect(url).toMatch(/^\/images\/[a-z0-9-]+\.webp$/);
    }
  });
});

describe("Imágenes responsivas", () => {
  it("genera srcSet de 800 y 1600 px para las fotos de proyectos", () => {
    expect(responsive("/images/portada-barbacoa.webp")).toEqual({
      src: "/images/portada-barbacoa.webp",
      srcSet: "/images/portada-barbacoa-800.webp 800w, /images/portada-barbacoa.webp 1600w",
    });
    expect(thumbnail("/images/portada-barbacoa.webp")).toBe("/images/portada-barbacoa-800.webp");
  });

  it("deja intacta cualquier URL que no siga la convención", () => {
    expect(responsive("/__l5e/assets-v1/abc/foto.jpg")).toEqual({ src: "/__l5e/assets-v1/abc/foto.jpg" });
    expect(responsive("/images/portada-barbacoa-800.webp")).toEqual({ src: "/images/portada-barbacoa-800.webp" });
    expect(thumbnail("https://ejemplo.com/foto.webp")).toBe("https://ejemplo.com/foto.webp");
  });
});

describe("Datos de contacto", () => {
  it("usa los canales oficiales de SCH", () => {
    expect(CONTACT.whatsapp).toBe("https://wa.me/59895564068");
    expect(CONTACT.instagram).toBe("https://www.instagram.com/sch_construcciones_/");
    expect(CONTACT.email).toBe("sch.construcciones2024@gmail.com");
  });
});
