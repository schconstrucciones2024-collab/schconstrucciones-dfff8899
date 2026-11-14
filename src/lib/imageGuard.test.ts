import { describe, expect, it } from "vitest";
import { IMAGE_GUARD_OPT_OUT, installImageGuard, shouldBlockImageAction } from "./imageGuard";

/** Elemento mínimo: `closest` responde según los selectores que contenga el árbol simulado. */
const el = (ancestors: string[]) => ({ closest: (selector: string) => (ancestors.includes(selector) ? {} : null) });

describe("freno al copiado de imágenes", () => {
  it("bloquea el menú y el arrastre sobre una imagen", () => {
    expect(shouldBlockImageAction(el(["img"]))).toBe(true);
  });

  it("no toca el texto, los botones ni los enlaces que no son imagen", () => {
    expect(shouldBlockImageAction(el([]))).toBe(false);
    expect(shouldBlockImageAction(null)).toBe(false);
    expect(shouldBlockImageAction(undefined)).toBe(false);
    expect(shouldBlockImageAction({})).toBe(false);
  });

  it("respeta lo que se marca como libre para guardar", () => {
    expect(shouldBlockImageAction(el(["img", `[${IMAGE_GUARD_OPT_OUT}]`]))).toBe(false);
  });

  it("instala y quita los dos frenos, y solo cancela el evento cuando corresponde", () => {
    const handlers: Record<string, (e: any) => void> = {};
    const doc = {
      addEventListener: (type: string, fn: (e: any) => void) => { handlers[type] = fn; },
      removeEventListener: (type: string) => { delete handlers[type]; },
    };
    const remove = installImageGuard(doc);
    expect(Object.keys(handlers).sort()).toEqual(["contextmenu", "dragstart"]);

    let cancelado = 0;
    handlers.contextmenu!({ target: el(["img"]), preventDefault: () => { cancelado++; } });
    handlers.dragstart!({ target: el(["img"]), preventDefault: () => { cancelado++; } });
    handlers.contextmenu!({ target: el([]), preventDefault: () => { cancelado++; } });
    expect(cancelado).toBe(2);

    remove();
    expect(Object.keys(handlers)).toHaveLength(0);
  });
});
