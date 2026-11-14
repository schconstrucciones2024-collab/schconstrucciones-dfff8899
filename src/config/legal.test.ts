import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COPYRIGHT_HOLDER, LEGAL_PAGES, LEGAL_UPDATED, copyrightNotice, legalSections, privacySections } from "./legal";

const contact = { address: "Av. Central, Punta del Diablo, Rocha, Uruguay", email: "sch.construcciones2024@gmail.com", whatsappLabel: "+598 95 564 068" };
const text = (blocks: { paragraphs?: string[]; items?: string[] }[]) => blocks.flatMap((b) => [...(b.paragraphs ?? []), ...(b.items ?? [])]).join("\n");
const read = (file: string) => readFileSync(`${process.cwd()}/${file}`, "utf8");

describe("derechos de autor", () => {
  it("el aviso lleva el titular, el año y «todos los derechos reservados»", () => {
    expect(copyrightNotice(2026)).toBe("© 2026 SCH Construcciones. Todos los derechos reservados.");
    expect(COPYRIGHT_HOLDER).toBe("SCH Construcciones");
    expect(copyrightNotice()).toContain(String(new Date().getFullYear()));
  });

  it("el aviso legal prohíbe copiar, clonar, extraer contenido y entrenar IA, y dice cómo pedir autorización", () => {
    const all = text(legalSections(contact, 2026));
    expect(all).toContain("© 2026 SCH Construcciones. Todos los derechos reservados.");
    for (const frase of ["Copiar, reproducir", "Copiar o clonar el sitio", "scraping", "inteligencia artificial", "sin autorización escrita"]) {
      expect(all.includes(frase) || legalSections(contact).some((b) => b.title.includes(frase))).toBe(true);
    }
    expect(all).toContain(contact.email);
    expect(all).toContain(contact.whatsappLabel);
    expect(all).toContain(LEGAL_UPDATED);
  });
});

describe("política de privacidad", () => {
  const all = text(privacySections(contact));

  it("explica lo que el sitio hace de verdad con el formulario y con el diseñador", () => {
    expect(all).toContain("no envía esos datos a ningún servidor");
    expect(all).toContain("abre WhatsApp");
    expect(all).toContain("almacenamiento local");
    expect(all).toContain("Asistente de escaleras");
    expect(all).toContain("Google Analytics");
    expect(all).toContain("Ley N.º 18.331");
    expect(all).toContain("URCDP");
    expect(all).toContain(contact.email);
  });

  it("tiene un título por sección y ninguna sección vacía", () => {
    for (const block of [...privacySections(contact), ...legalSections(contact)]) {
      expect(block.title.length).toBeGreaterThan(3);
      expect((block.paragraphs?.length ?? 0) + (block.items?.length ?? 0)).toBeGreaterThan(0);
    }
  });
});

describe("páginas legales", () => {
  it("cada página tiene ruta, título corto, descripción y un archivo de ruta", () => {
    for (const page of Object.values(LEGAL_PAGES)) {
      expect(page.path.startsWith("/")).toBe(true);
      expect(page.metaTitle.length).toBeLessThan(61);
      expect(page.description.length).toBeLessThan(161);
      expect(read(`src/routes/${page.path.slice(1)}.tsx`)).toContain(`createFileRoute("${page.path}")`);
      expect(read("src/routeTree.gen.ts")).toContain(`'${page.path}'`);
    }
  });

  it("el pie y el formulario enlazan a las dos páginas", () => {
    const footer = read("src/components/home/SiteFooter.tsx");
    expect(footer).toContain("LEGAL_PAGES.avisoLegal.path");
    expect(footer).toContain("LEGAL_PAGES.privacidad.path");
    expect(footer).toContain("copyrightNotice()");
    expect(read("src/components/home/Contact.tsx")).toContain("LEGAL_PAGES.privacidad.path");
  });
});

describe("robots.txt", () => {
  const robots = read("public/robots.txt");
  const grupo = (agente: string) => new RegExp(`User-agent: ${agente}\\r?\\nDisallow: /\\r?\\n`).test(robots);

  it("bloquea a los rastreadores que entrenan sistemas de IA", () => {
    for (const bot of ["GPTBot", "CCBot", "ClaudeBot", "anthropic-ai", "Bytespider", "Applebot-Extended", "Meta-ExternalAgent"]) {
      expect(grupo(bot), bot).toBe(true);
    }
  });

  it("deja pasar a los buscadores, a la vista previa de enlaces y a los asistentes de IA que buscan para responder (ChatGPT, Gemini, Claude, Perplexity), y conserva el sitemap", () => {
    for (const bot of ["Googlebot", "Bingbot", "Twitterbot", "facebookexternalhit", "OAI-SearchBot", "ChatGPT-User", "Google-Extended", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Applebot", "DuckAssistBot"]) {
      expect(new RegExp(`User-agent: ${bot}\\r?\\nAllow: /\\r?\\n`).test(robots), bot).toBe(true);
      expect(grupo(bot), bot).toBe(false);
    }
    expect(robots).toContain("User-agent: *\nAllow: /");
    expect(robots).toContain("Sitemap: https://schconstrucciones.lovable.app/sitemap.xml");
  });
});

describe("home", () => {
  const index = read("src/routes/index.tsx");
  it("el título habla de todo Uruguay y no pasa de 60 caracteres", () => {
    const title = /const TITLE = "([^"]+)"/.exec(index)?.[1] ?? "";
    expect(title).toBe("Cabañas y casas en todo Uruguay | SCH Construcciones");
    expect(title.length).toBeLessThan(61);
    const description = /const DESCRIPTION = "([^"]+)"/.exec(index)?.[1] ?? "";
    expect(description).toContain("todo Uruguay");
    expect(description).toContain("Punta del Diablo");
    expect(description.length).toBeLessThan(161);
  });
});
