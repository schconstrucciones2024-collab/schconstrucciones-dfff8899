import { describe, it, expect } from "vitest";
import { initialConfig, resizeConfig, encodeDesign, type HouseConfig } from "./useConfigurator";
import { normalizeDeck } from "@/config/deck";
import {
  AUTOSAVE_KEY,
  MAX_NAME_LENGTH,
  MAX_SAVED_DESIGNS,
  SAVED_DESIGNS_KEY,
  cleanName,
  defaultName,
  deleteDesign,
  designFingerprint,
  duplicateDesign,
  listSavedDesigns,
  openSavedDesign,
  readAutosave,
  renameDesign,
  saveDesign,
  uniqueName,
  writeAutosave,
  type StorageLike,
} from "./designStorage";

function fakeStorage(opts: { failWrites?: boolean } = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (opts.failWrites) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const casa = (): HouseConfig => resizeConfig(initialConfig(), { m2: 80, floors: 2 });
const conDeck = (c: HouseConfig): HouseConfig => ({ ...c, deck: normalizeDeck({ ...c.deck, enabled: true }) });

describe("guardado de diseños en el navegador", () => {
  it("guarda un diseño y lo vuelve a abrir igual, con su resumen", () => {
    const st = fakeStorage(), c = casa();
    const r = saveDesign(st, c, { name: "Casa de la playa", now: 1000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.design.name).toBe("Casa de la playa");
    expect(r.design.savedAt).toBe(1000);
    expect(r.design.summary).toEqual({ m2: Number(c.m2.toFixed(2)), floors: 2, finish: c.finish });
    const list = listSavedDesigns(st);
    expect(list).toHaveLength(1);
    expect(openSavedDesign(list[0]!)).toEqual(c);
  });

  it("sin nombre usa «Mi diseño 1», «Mi diseño 2»… y no repite nombres", () => {
    const st = fakeStorage();
    saveDesign(st, casa(), { now: 1 });
    saveDesign(st, casa(), { now: 2 });
    saveDesign(st, casa(), { name: "  Mi   diseño 1 ", now: 3 });
    const names = listSavedDesigns(st).map((d) => d.name);
    expect(names).toContain("Mi diseño 1");
    expect(names).toContain("Mi diseño 2");
    expect(names).toContain("Mi diseño 1 (2)");
    expect(defaultName(listSavedDesigns(st))).toBe("Mi diseño 3");
  });

  it("la lista sale del más nuevo al más viejo", () => {
    const st = fakeStorage();
    saveDesign(st, casa(), { name: "A", now: 10 });
    saveDesign(st, casa(), { name: "B", now: 30 });
    saveDesign(st, casa(), { name: "C", now: 20 });
    expect(listSavedDesigns(st).map((d) => d.name)).toEqual(["B", "C", "A"]);
  });

  it("al guardar cambios sobre un diseño existente lo actualiza, conserva el nombre y no agrega otro", () => {
    const st = fakeStorage(), c = casa();
    const first = saveDesign(st, c, { name: "Casa", now: 1 });
    if (!first.ok) throw new Error("no guardó");
    const changed = conDeck(c);
    const second = saveDesign(st, changed, { id: first.design.id, now: 5 });
    expect(second.ok).toBe(true);
    const list = listSavedDesigns(st);
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Casa");
    expect(list[0]!.savedAt).toBe(5);
    expect(list[0]!.fp).not.toBe(first.design.fp);
    expect(openSavedDesign(list[0]!)?.deck.enabled).toBe(true);
  });

  it("actualizar un diseño que ya no existe avisa y no crea uno nuevo", () => {
    const st = fakeStorage();
    expect(saveDesign(st, casa(), { id: "nada" })).toEqual({ ok: false, reason: "no-existe" });
    expect(listSavedDesigns(st)).toHaveLength(0);
  });

  it("hay un máximo de diseños guardados y avisa cuando se llega", () => {
    const st = fakeStorage();
    for (let i = 0; i < MAX_SAVED_DESIGNS; i++) expect(saveDesign(st, casa(), { name: `Diseño ${i}`, now: i }).ok).toBe(true);
    expect(saveDesign(st, casa(), { name: "Uno más" })).toEqual({ ok: false, reason: "limite" });
    expect(listSavedDesigns(st)).toHaveLength(MAX_SAVED_DESIGNS);
    // Actualizar uno existente sigue permitido con la lista llena.
    const any = listSavedDesigns(st)[0]!;
    expect(saveDesign(st, conDeck(casa()), { id: any.id }).ok).toBe(true);
  });

  it("renombrar limpia el nombre, no deja vacío ni repetido", () => {
    const st = fakeStorage();
    const a = saveDesign(st, casa(), { name: "Uno", now: 1 }), b = saveDesign(st, casa(), { name: "Dos", now: 2 });
    if (!a.ok || !b.ok) throw new Error("no guardó");
    expect(renameDesign(st, a.design.id, "   Casa   nueva  ").ok).toBe(true);
    expect(listSavedDesigns(st).find((d) => d.id === a.design.id)?.name).toBe("Casa nueva");
    expect(renameDesign(st, a.design.id, "   ")).toEqual({ ok: false, reason: "invalido" });
    const r = renameDesign(st, b.design.id, "casa nueva");
    expect(r.ok && r.design.name).toBe("casa nueva (2)");
    expect(renameDesign(st, "nada", "x")).toEqual({ ok: false, reason: "no-existe" });
  });

  it("duplicar hace una copia aparte con el mismo diseño", () => {
    const st = fakeStorage();
    const a = saveDesign(st, casa(), { name: "Casa", now: 1 });
    if (!a.ok) throw new Error("no guardó");
    const d = duplicateDesign(st, a.design.id, 9);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.design.name).toBe("Casa (copia)");
    expect(d.design.id).not.toBe(a.design.id);
    expect(d.design.data).toBe(a.design.data);
    expect(listSavedDesigns(st)).toHaveLength(2);
    expect(duplicateDesign(st, a.design.id, 10).ok && true).toBe(true);
    expect(listSavedDesigns(st).map((x) => x.name)).toContain("Casa (copia) (2)");
  });

  it("no duplica con la lista llena", () => {
    const st = fakeStorage();
    for (let i = 0; i < MAX_SAVED_DESIGNS; i++) saveDesign(st, casa(), { name: `D${i}`, now: i });
    expect(duplicateDesign(st, listSavedDesigns(st)[0]!.id)).toEqual({ ok: false, reason: "limite" });
  });

  it("borrar saca solo ese diseño", () => {
    const st = fakeStorage();
    const a = saveDesign(st, casa(), { name: "A", now: 1 }), b = saveDesign(st, casa(), { name: "B", now: 2 });
    if (!a.ok || !b.ok) throw new Error("no guardó");
    expect(deleteDesign(st, a.design.id)).toBe(true);
    expect(listSavedDesigns(st).map((d) => d.name)).toEqual(["B"]);
    expect(deleteDesign(st, a.design.id)).toBe(false);
  });

  it("sin almacenamiento (modo privado o bloqueado) no rompe: avisa", () => {
    expect(saveDesign(null, casa(), { name: "X" })).toEqual({ ok: false, reason: "almacenamiento" });
    expect(listSavedDesigns(null)).toEqual([]);
    expect(writeAutosave(null, casa(), null)).toBe("almacenamiento");
    expect(readAutosave(null)).toBeNull();
    const lleno = fakeStorage({ failWrites: true });
    expect(saveDesign(lleno, casa(), { name: "X" })).toEqual({ ok: false, reason: "almacenamiento" });
    expect(writeAutosave(lleno, casa(), null)).toBe("almacenamiento");
    expect(listSavedDesigns(lleno)).toEqual([]);
  });

  it("no guarda un diseño que después no se podría abrir", () => {
    const st = fakeStorage();
    const roto = { ...casa(), m2: 1 } as HouseConfig;
    expect(saveDesign(st, roto, { name: "Roto" })).toEqual({ ok: false, reason: "invalido" });
    expect(listSavedDesigns(st)).toHaveLength(0);
  });

  it("ignora lo dañado o ajeno en el almacenamiento y conserva lo bueno", () => {
    const st = fakeStorage();
    const ok = saveDesign(st, casa(), { name: "Bueno", now: 5 });
    if (!ok.ok) throw new Error("no guardó");
    const raw = JSON.parse(st.map.get(SAVED_DESIGNS_KEY)!);
    st.map.set(SAVED_DESIGNS_KEY, JSON.stringify([null, 3, "x", { id: "a" }, { ...raw[0], id: "" }, raw[0], raw[0]]));
    expect(listSavedDesigns(st).map((d) => d.name)).toEqual(["Bueno"]);
    st.map.set(SAVED_DESIGNS_KEY, "esto no es json");
    expect(listSavedDesigns(st)).toEqual([]);
    st.map.set(SAVED_DESIGNS_KEY, JSON.stringify({ no: "es lista" }));
    expect(listSavedDesigns(st)).toEqual([]);
  });

  it("un diseño guardado con datos corruptos no se abre (y no rompe nada)", () => {
    const st = fakeStorage();
    const ok = saveDesign(st, casa(), { name: "A", now: 1 });
    if (!ok.ok) throw new Error("no guardó");
    expect(openSavedDesign({ data: "basura" })).toBeNull();
    expect(openSavedDesign({ data: encodeDesign({ ...casa(), floors: 9 } as HouseConfig) })).toBeNull();
  });

  it("los nombres: se limpian, se acotan y no se repiten", () => {
    expect(cleanName("  hola \n  mundo ")).toBe("hola mundo");
    expect(cleanName("x".repeat(200))).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanName("   ")).toBe("");
    const st = fakeStorage();
    const largo = "y".repeat(MAX_NAME_LENGTH);
    saveDesign(st, casa(), { name: largo, now: 1 });
    const again = saveDesign(st, casa(), { name: largo, now: 2 });
    expect(again.ok && again.design.name.length <= MAX_NAME_LENGTH).toBe(true);
    expect(again.ok && again.design.name.endsWith("(2)")).toBe(true);
    expect(uniqueName("Casa", [])).toBe("Casa");
  });

  it("la huella no depende del orden de las claves y cambia si cambia el diseño", () => {
    const c = casa();
    const reordenado = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(c).reverse()))) as HouseConfig;
    expect(designFingerprint(reordenado)).toBe(designFingerprint(c));
    expect(designFingerprint(conDeck(c))).not.toBe(designFingerprint(c));
  });
});

describe("autoguardado", () => {
  it("guarda y recupera el diseño que se estaba armando, con el diseño guardado que estaba abierto", () => {
    const st = fakeStorage(), c = conDeck(casa());
    expect(writeAutosave(st, c, "d-1", 77)).toBe("ok");
    const back = readAutosave(st);
    expect(back?.config).toEqual(c);
    expect(back?.activeId).toBe("d-1");
    expect(back?.savedAt).toBe(77);
  });

  it("sin nada guardado, o con algo dañado, no devuelve nada", () => {
    const st = fakeStorage();
    expect(readAutosave(st)).toBeNull();
    for (const raw of ["no es json", "null", "3", JSON.stringify({ data: 5 }), JSON.stringify({ v: 1, data: "basura" })]) {
      st.map.set(AUTOSAVE_KEY, raw);
      expect(readAutosave(st)).toBeNull();
    }
  });

  it("un diseño que no se puede abrir NO pisa el último autoguardado bueno", () => {
    const st = fakeStorage(), bueno = casa();
    writeAutosave(st, bueno, null);
    expect(writeAutosave(st, { ...bueno, m2: 1 } as HouseConfig, null)).toBe("invalido");
    expect(readAutosave(st)?.config).toEqual(bueno);
  });

  it("el activeId raro se ignora", () => {
    const st = fakeStorage(), c = casa();
    writeAutosave(st, c, null);
    const rec = JSON.parse(st.map.get(AUTOSAVE_KEY)!);
    st.map.set(AUTOSAVE_KEY, JSON.stringify({ ...rec, activeId: 42 }));
    expect(readAutosave(st)?.activeId).toBeNull();
  });
});
