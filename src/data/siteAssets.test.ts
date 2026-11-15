import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHARE_IMAGES, SHARE_IMAGE_SIZE, SITE_URL, publicPageHead, serviceHead } from "./servicios";
import { privacySections } from "@/config/legal";

const root = (file: string) => `${process.cwd()}/${file}`;
const read = (file: string) => readFileSync(root(file), "utf8");
const meta = (head: { meta: Record<string, string>[] }, key: string) => head.meta.find((m) => m.property === key || m.name === key)?.content;

/** Ancho y alto de un JPEG, leídos del primer marcador SOF. */
function jpegSize(file: string) {
  const b = readFileSync(root(file));
  expect(b[0]).toBe(0xff);
  expect(b[1]).toBe(0xd8);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error("JPEG sin SOF");
}

describe("imagen al compartir las páginas de servicio", () => {
  it("woodframe y tradicional tienen una imagen de 1200 × 630 que pesa poco", () => {
    expect(Object.keys(SHARE_IMAGES).sort()).toEqual(["/construccion-tradicional", "/woodframe"]);
    for (const { file, alt } of Object.values(SHARE_IMAGES)) {
      expect(file.startsWith("/images/compartir-")).toBe(true);
      expect(jpegSize(`public${file}`)).toEqual(SHARE_IMAGE_SIZE);
      expect(statSync(root(`public${file}`)).size).toBeLessThan(200_000);
      expect(alt.length).toBeGreaterThan(20);
    }
  });

  it("el encabezado lleva og:image y twitter:image con la dirección completa", () => {
    for (const [path, { file, alt }] of Object.entries(SHARE_IMAGES)) {
      const head = serviceHead(path, "Título", "Descripción", []);
      expect(meta(head, "og:image")).toBe(`${SITE_URL}${file}`);
      expect(meta(head, "twitter:image")).toBe(`${SITE_URL}${file}`);
      expect(meta(head, "og:image:width")).toBe("1200");
      expect(meta(head, "og:image:height")).toBe("630");
      expect(meta(head, "og:image:alt")).toBe(alt);
      expect(head.meta.filter((m) => m.property === "og:image")).toHaveLength(1);
    }
  });

  it("mobiliario y las demás páginas no llevan imagen todavía", () => {
    for (const path of ["/mobiliario", "/privacidad", "/aviso-legal"]) {
      const head = publicPageHead(path, "Título", "Descripción");
      expect(meta(head, "og:image")).toBe(undefined);
      expect(meta(head, "twitter:image")).toBe(undefined);
    }
  });

  it("las rutas de woodframe y tradicional usan serviceHead (que agrega la imagen)", () => {
    expect(read("src/routes/woodframe.tsx")).toContain('serviceHead("/woodframe"');
    expect(read("src/routes/construccion-tradicional.tsx")).toContain('serviceHead("/construccion-tradicional"');
  });
});

describe("tipografías en el propio sitio", () => {
  const css = read("src/styles.css");
  const rootRoute = read("src/routes/__root.tsx");

  it("Urbanist y Epilogue se declaran con @font-face y sus archivos existen (WOFF)", () => {
    for (const [familia, archivo, pesos] of [["Urbanist", "urbanist-latin.woff", "300 700"], ["Epilogue", "epilogue-latin.woff", "300 600"]] as const) {
      const bloque = new RegExp(`@font-face\\s*{[^}]*font-family:\\s*"${familia}"[^}]*}`).exec(css)?.[0] ?? "";
      expect(bloque, familia).toContain(`url("/${archivo}") format("woff")`);
      expect(bloque, familia).toContain(`font-weight: ${pesos}`);
      expect(bloque, familia).toContain("font-display: swap");
      const bytes = readFileSync(root(`public/${archivo}`));
      expect(bytes.subarray(0, 4).toString("latin1"), archivo).toBe("wOFF");
      expect(bytes.length, archivo).toBeLessThan(80_000);
    }
    expect(read("public/fuentes-licencia.txt")).toContain("SIL Open Font License");
  });

  it("la raíz precarga las dos tipografías y ya no pide nada a Google Fonts", () => {
    expect(rootRoute).toContain('href: "/urbanist-latin.woff"');
    expect(rootRoute).toContain('href: "/epilogue-latin.woff"');
    expect(rootRoute).not.toMatch(/googleapis|gstatic/);
    expect(css).not.toMatch(/googleapis|gstatic/);
  });

  it("la política de privacidad no dice que se usa Google Fonts", () => {
    const texto = privacySections({ address: "x", email: "x", whatsappLabel: "x" }).flatMap((b) => [...(b.paragraphs ?? []), ...(b.items ?? [])]).join("\n");
    expect(texto).not.toContain("Google Fonts");
    expect(texto).toContain("Lovable");
  });
});
