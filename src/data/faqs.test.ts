import { describe, expect, it } from "vitest";
import { faqs } from "./faqs";

describe("Plazos orientativos oficiales", () => {
  const table = faqs.find((faq) => faq.id === "faq-plazos")?.blocks.find((block) => block.type === "table");
  function range(row: number, column: number) {
    if (!table || table.type !== "table") throw new Error("Falta la configuración de plazos");
    return [...(table.rows[row]?.[column] ?? "").matchAll(/\d+(?:,\d+)?/g)].map(([value]) => Number(value.replace(",", ".")));
  }
  it("Wood frame de 48 a 60 m²: 3 a 5 meses", () => {
    expect(range(0, 0)).toEqual([48, 60]);
    expect(range(0, 1)).toEqual([3, 5]);
  });
  it("Tradicional de 48 a 60 m²: 4,5 a 10 meses", () => {
    expect(range(0, 2)).toEqual([4.5, 10]);
  });
  it("Wood frame de 80 a 100 m²: 4 a 8 meses", () => {
    expect(range(1, 0)).toEqual([80, 100]);
    expect(range(1, 1)).toEqual([4, 8]);
  });
  it("Tradicional de 80 a 100 m²: 6 a 16 meses", () => {
    expect(range(1, 2)).toEqual([6, 16]);
  });
  it("Reducción orientativa: 30% a 50%", () => {
    const highlight = faqs.find((faq) => faq.id === "faq-plazos")?.blocks.find((block) => block.type === "highlight");
    if (!highlight || highlight.type !== "highlight") throw new Error("Falta el rango de reducción");
    expect([...highlight.text.matchAll(/(\d+)%/g)].map((match) => Number(match[1]))).toEqual([30, 50]);
  });
});