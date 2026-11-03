import { describe, expect, it } from "vitest";
import { defaultOptions } from "@/config/wallSystems";
import { initialWallState, layersInUse, wallReducer as r, type WallState } from "./wallState";

const run = (s: WallState, ...actions: Parameters<typeof r>[1][]) => actions.reduce((acc, a) => r(acc, a), s);

describe("estado de Sistemas constructivos", () => {
  it("arranca en Wood Frame, armada, con las opciones predeterminadas (siding gris claro, con clavaderas)", () => {
    const s = initialWallState();
    expect(s.system).toBe("woodframe");
    expect(s.explode).toBe(0);
    expect(s.per.woodframe.A).toEqual(defaultOptions("woodframe"));
    expect(s.per.woodframe.A.exterior).toBe("siding");
    expect(s.per.woodframe.A.battens).toBe("con");
    expect(s.per.woodframe.A.interior).toBe("yeso");
    expect(s.selected).toBe(null);
  });

  it("cambiar una opción cambia la pared (y solo esa opción)", () => {
    const s = run(initialWallState(), { type: "option", key: "exterior", value: "chapa" });
    expect(s.per.woodframe.A.exterior).toBe("chapa");
    expect(s.per.woodframe.A.interior).toBe("yeso");
  });

  it("rechaza opciones o valores que no existen", () => {
    const s0 = initialWallState();
    expect(run(s0, { type: "option", key: "inventada", value: "x" })).toBe(s0);
    expect(run(s0, { type: "option", key: "exterior", value: "mármol" })).toBe(s0);
  });

  it("cada sistema recuerda sus propias opciones", () => {
    let s = run(initialWallState(), { type: "option", key: "exterior", value: "tablas" }, { type: "system", system: "tradicional" });
    s = run(s, { type: "option", key: "masonry", value: "comun" }, { type: "system", system: "woodframe" });
    expect(s.per.woodframe.A.exterior).toBe("tablas");
    expect(s.per.tradicional.A.masonry).toBe("comun");
  });

  it("sin clavaderas, la capa deja de existir y se deselecciona si estaba elegida", () => {
    let s = run(initialWallState(), { type: "select", id: "clavaderas" });
    expect(s.selected).toBe("clavaderas");
    s = run(s, { type: "option", key: "battens", value: "sin" });
    expect(layersInUse(s).includes("clavaderas")).toBe(false);
    expect(s.selected).toBe(null);
  });

  it("no se puede seleccionar ni ocultar una capa que no está", () => {
    const s = run(initialWallState(), { type: "option", key: "battens", value: "sin" });
    expect(run(s, { type: "select", id: "clavaderas" }).selected).toBe(null);
    expect(run(s, { type: "toggleLayer", id: "clavaderas" }).per.woodframe.hidden).toEqual([]);
  });

  it("seleccionar de nuevo la misma capa la deselecciona", () => {
    const s = run(initialWallState(), { type: "select", id: "osb" }, { type: "select", id: "osb" });
    expect(s.selected).toBe(null);
  });

  it("ocultar y volver a mostrar capas, y 'mostrar todas'", () => {
    let s = run(initialWallState(), { type: "toggleLayer", id: "osb" }, { type: "toggleLayer", id: "exterior" });
    expect(s.per.woodframe.hidden).toEqual(["osb", "exterior"]);
    s = run(s, { type: "toggleLayer", id: "osb" });
    expect(s.per.woodframe.hidden).toEqual(["exterior"]);
    s = run(s, { type: "showAll" });
    expect(s.per.woodframe.hidden).toEqual([]);
  });

  it("explosión: se limita entre 0 y 1 y el botón alterna", () => {
    expect(run(initialWallState(), { type: "explode", value: 7 }).explode).toBe(1);
    expect(run(initialWallState(), { type: "explode", value: -2 }).explode).toBe(0);
    expect(run(initialWallState(), { type: "explode", value: Number.NaN }).explode).toBe(0);
    expect(run(initialWallState(), { type: "toggleExplode" }).explode).toBe(1);
    expect(run(initialWallState(), { type: "toggleExplode" }, { type: "toggleExplode" }).explode).toBe(0);
  });

  it("comparar: la pared B parte igual que la A y los tags editan solo la pared elegida", () => {
    let s = run(initialWallState(), { type: "option", key: "exterior", value: "tablas" }, { type: "compare", on: true });
    expect(s.per.woodframe.B).toEqual(s.per.woodframe.A);
    expect(s.editing).toBe("B");
    s = run(s, { type: "option", key: "exterior", value: "chapa" });
    expect(s.per.woodframe.A.exterior).toBe("tablas");
    expect(s.per.woodframe.B.exterior).toBe("chapa");
    s = run(s, { type: "editing", side: "A" }, { type: "option", key: "interior", value: "machimbre" });
    expect(s.per.woodframe.A.interior).toBe("machimbre");
    expect(s.per.woodframe.B.interior).toBe("yeso");
  });

  it("al comparar, una capa existe si está en cualquiera de las dos paredes", () => {
    let s = run(initialWallState(), { type: "compare", on: true }, { type: "option", key: "battens", value: "sin" });
    expect(layersInUse(s).includes("clavaderas")).toBe(true); // la A todavía las tiene
    s = run(s, { type: "editing", side: "A" }, { type: "option", key: "battens", value: "sin" });
    expect(layersInUse(s).includes("clavaderas")).toBe(false);
  });

  it("dejar de comparar vuelve a una sola pared (la A)", () => {
    const s = run(initialWallState(), { type: "compare", on: true }, { type: "option", key: "exterior", value: "chapa" }, { type: "compare", on: false });
    expect(s.compare).toBe(false);
    expect(s.editing).toBe("A");
    expect(s.per.woodframe.B).toEqual(s.per.woodframe.A);
  });

  it("sin comparar, las opciones se aplican a ambas paredes (así B ya está al día al empezar a comparar)", () => {
    const s = run(initialWallState(), { type: "option", key: "interior", value: "chaponPino" });
    expect(s.per.woodframe.B.interior).toBe("chaponPino");
  });

  it("'editing' no hace nada si no se está comparando", () => {
    const s0 = initialWallState();
    expect(run(s0, { type: "editing", side: "B" })).toBe(s0);
  });

  it("restaurar vuelve el sistema actual al original (opciones, capas ocultas, selección, explosión, comparación y vista)", () => {
    let s = run(initialWallState(), { type: "option", key: "exterior", value: "chapa" }, { type: "toggleLayer", id: "osb" }, { type: "select", id: "membrana" }, { type: "explode", value: 0.8 }, { type: "view", view: "lateral" }, { type: "compare", on: true });
    s = run(s, { type: "restore" });
    expect(s).toEqual(initialWallState());
  });

  it("restaurar un sistema no toca las opciones del otro", () => {
    let s = run(initialWallState(), { type: "system", system: "tradicional" }, { type: "option", key: "masonry", value: "comun" }, { type: "system", system: "woodframe" }, { type: "option", key: "exterior", value: "tablas" });
    s = run(s, { type: "restore" });
    expect(s.per.woodframe.A.exterior).toBe("siding");
    expect(s.per.tradicional.A.masonry).toBe("comun");
  });

  it("construcción tradicional: revoque exterior con o sin, y selección de mampostería", () => {
    let s = run(initialWallState(), { type: "system", system: "tradicional" }, { type: "select", id: "revoqueExt" });
    expect(s.selected).toBe("revoqueExt");
    s = run(s, { type: "option", key: "revoqueExt", value: "sin" });
    expect(s.selected).toBe(null);
    expect(layersInUse(s).length).toBe(6);
  });

  it("cambiar de sistema limpia la selección y apaga la comparación", () => {
    const s = run(initialWallState(), { type: "select", id: "osb" }, { type: "compare", on: true }, { type: "system", system: "tradicional" });
    expect(s.selected).toBe(null);
    expect(s.compare).toBe(false);
  });
});
