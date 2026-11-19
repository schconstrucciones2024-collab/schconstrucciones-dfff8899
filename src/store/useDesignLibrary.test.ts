import { describe, it, expect, beforeEach } from "vitest";
import { initialConfig, resizeConfig, encodeDesign, useConfigurator, type HouseConfig } from "./useConfigurator";
import { useDesignLibrary, hasUnsavedChanges, failureText } from "./useDesignLibrary";
import { AUTOSAVE_KEY, MAX_SAVED_DESIGNS, designFingerprint, listSavedDesigns, readAutosave, saveDesign, type StorageLike } from "./designStorage";

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

const lib = () => useDesignLibrary.getState();
const cfg = () => useConfigurator.getState().config;
const casa = (): HouseConfig => resizeConfig(initialConfig(), { m2: 80, floors: 2 });
const linkOf = (c: HouseConfig) => `?design=${encodeDesign(c)}`;

describe("«Mis diseños» y autoguardado conectados al diseñador", () => {
  beforeEach(() => {
    // Cada prueba arranca como una visita nueva: diseño de fábrica y nada guardado en pantalla.
    useConfigurator.setState({ config: initialConfig(), past: [], future: [], selectedId: null, error: null, activeFloor: 0, view: "exterior" });
    useDesignLibrary.setState({ ready: false, storageOk: true, list: [], activeId: null, touched: false, notice: null });
  });

  it("una visita que solo mira no deja nada guardado ni cambia el diseño", () => {
    const st = fakeStorage(), before = cfg();
    const stop = lib().init({ storage: st, search: "" });
    stop();
    expect(st.map.size).toBe(0);
    expect(cfg()).toBe(before);
    expect(lib().ready).toBe(true);
    expect(lib().notice).toBeNull();
  });

  it("lo que se diseña queda autoguardado y al volver se retoma (con aviso)", () => {
    const st = fakeStorage();
    let stop = lib().init({ storage: st, search: "" });
    useConfigurator.getState().setDeck({ enabled: true });
    expect(lib().touched).toBe(true);
    stop(); // lo que pasa al cerrar o esconder la pestaña
    const saved = readAutosave(st);
    expect(saved?.config.deck.enabled).toBe(true);
    expect(saved?.config).toEqual(cfg());

    // Visita nueva: el diseño de fábrica vuelve a estar en pantalla.
    useConfigurator.setState({ config: initialConfig(), past: [], future: [] });
    useDesignLibrary.setState({ ready: false, activeId: null, touched: false, notice: null });
    stop = lib().init({ storage: st, search: "" });
    expect(cfg().deck.enabled).toBe(true);
    expect(cfg()).toEqual(saved?.config);
    expect(useConfigurator.getState().past).toEqual([]);
    expect(lib().notice?.text).toContain("Retomamos tu último diseño");
    expect(lib().touched).toBe(true);
    stop();
  });

  it("el autoguardado sigue cada cambio (también deshacer)", () => {
    const st = fakeStorage();
    const stop = lib().init({ storage: st, search: "" });
    useConfigurator.getState().setDeck({ enabled: true });
    useConfigurator.getState().undo();
    stop();
    expect(readAutosave(st)?.config.deck.enabled).toBe(false);
  });

  it("un autoguardado dañado se ignora y deja el diseño de fábrica", () => {
    const st = fakeStorage();
    st.map.set(AUTOSAVE_KEY, "{roto");
    const before = cfg();
    const stop = lib().init({ storage: st, search: "" });
    stop();
    expect(cfg()).toBe(before);
    expect(lib().notice).toBeNull();
  });

  it("un link compartido manda, y lo que el cliente tenía armado queda en «Mis diseños»", () => {
    const st = fakeStorage();
    const mio = { ...casa(), ground: "cesped" as const };
    expect(designFingerprint(mio)).not.toBe(designFingerprint(casa()));
    saveDesign(st, initialConfig(), { name: "Otro" }); // ya había uno guardado
    // Autoguardado previo = «mio», sin nombre.
    useConfigurator.setState({ config: mio, past: [], future: [] });
    let stop = lib().init({ storage: st, search: "" });
    useConfigurator.getState().setDeck({ enabled: true });
    stop();
    const mioConDeck = cfg();

    // Visita nueva con link de un diseño distinto.
    useConfigurator.setState({ config: initialConfig(), past: [], future: [] });
    useDesignLibrary.setState({ ready: false, activeId: null, touched: false, notice: null, list: [] });
    const link = { ...casa(), roofType: "una" as const };
    stop = lib().init({ storage: st, search: linkOf(link) });
    expect(cfg()).toEqual(readAutosave(st)?.config);
    expect(cfg().roofType).toBe("una");
    expect(lib().activeId).toBeNull();
    expect(lib().touched).toBe(false);
    expect(lib().notice?.text).toContain("Mis diseños");
    const names = listSavedDesigns(st).map((d) => d.name);
    expect(names).toContain("Diseño anterior (autoguardado)");
    const back = listSavedDesigns(st).find((d) => d.name === "Diseño anterior (autoguardado)")!;
    expect(back.fp).toBe(designFingerprint(mioConDeck));

    // Segunda pasada con la dirección ya limpia (la web quita ?design= al abrirlo): no pisa ni repite nada.
    const antes = cfg();
    stop();
    useDesignLibrary.setState({ ready: false });
    stop = lib().init({ storage: st, search: "" });
    expect(cfg()).toBe(antes);
    expect(lib().notice?.text).toContain("Abrimos el diseño del link");
    expect(listSavedDesigns(st).filter((d) => d.name.startsWith("Diseño anterior"))).toHaveLength(1);
    stop();
  });

  it("si lo que tenía armado ya estaba guardado con nombre, el link no lo duplica", () => {
    const st = fakeStorage(), mio = casa();
    saveDesign(st, mio, { name: "Mi casa" });
    useConfigurator.setState({ config: mio, past: [], future: [] });
    let stop = lib().init({ storage: st, search: "" });
    useConfigurator.getState().setDeck({ enabled: false }); // sin cambios reales
    stop();
    // El autoguardado no se escribió (nada se tocó): lo armamos como lo dejaría una sesión anterior.
    st.map.set(AUTOSAVE_KEY, JSON.stringify({ v: 1, savedAt: 1, activeId: null, data: encodeDesign(mio) }));
    useConfigurator.setState({ config: initialConfig(), past: [], future: [] });
    useDesignLibrary.setState({ ready: false, list: [] });
    stop = lib().init({ storage: st, search: linkOf({ ...casa(), roofType: "una" }) });
    expect(listSavedDesigns(st).map((d) => d.name)).toEqual(["Mi casa"]);
    stop();
  });

  it("un link roto se ignora y se retoma el autoguardado", () => {
    const st = fakeStorage(), mio = casa();
    st.map.set(AUTOSAVE_KEY, JSON.stringify({ v: 1, savedAt: 1, activeId: null, data: encodeDesign(mio) }));
    const stop = lib().init({ storage: st, search: "?design=basura" });
    expect(cfg()).toEqual(mio);
    expect(lib().notice?.text).toContain("Retomamos");
    stop();
  });

  it("guardar con nombre, modificar, ver que hay cambios y guardar los cambios", () => {
    const st = fakeStorage();
    const stop = lib().init({ storage: st, search: "" });
    const r = lib().saveNew("Casa del frente");
    expect(r.ok).toBe(true);
    expect(lib().list.map((d) => d.name)).toEqual(["Casa del frente"]);
    const id = lib().activeId!;
    expect(id).toBeTruthy();
    expect(hasUnsavedChanges(cfg(), lib().list, lib().activeId, lib().touched)).toBe(false);

    useConfigurator.getState().setDeck({ enabled: true });
    expect(hasUnsavedChanges(cfg(), lib().list, lib().activeId, lib().touched)).toBe(true);
    expect(readAutosave(st)?.config.deck.enabled).toBe(false); // el autoguardado del cambio espera 500 ms
    expect(lib().list[0]!.fp).not.toBe(designFingerprint(cfg())); // y el guardado con nombre no cambia hasta tocar «Guardar cambios»
    expect(lib().saveChanges().ok).toBe(true);
    expect(hasUnsavedChanges(cfg(), lib().list, lib().activeId, lib().touched)).toBe(false);
    expect(lib().list).toHaveLength(1);
    expect(lib().list[0]!.id).toBe(id);
    stop();
    expect(readAutosave(st)?.activeId).toBe(id);
  });

  it("abrir un diseño guardado lo pone en pantalla, sin historial, y queda como el abierto", () => {
    const st = fakeStorage();
    const stop = lib().init({ storage: st, search: "" });
    useConfigurator.getState().setDeck({ enabled: true });
    lib().saveNew("Con deck");
    const id = lib().activeId!;
    lib().startNew();
    expect(cfg().deck.enabled).toBe(false);
    expect(lib().activeId).toBeNull();
    expect(lib().open(id)).toBe(true);
    expect(cfg().deck.enabled).toBe(true);
    expect(lib().activeId).toBe(id);
    expect(useConfigurator.getState().past).toEqual([]);
    expect(readAutosave(st)?.activeId).toBe(id);
    expect(readAutosave(st)?.config).toEqual(cfg());
    stop();
  });

  it("abrir uno que no existe o está dañado avisa y no toca el diseño de pantalla", () => {
    const st = fakeStorage();
    const stop = lib().init({ storage: st, search: "" });
    const antes = cfg();
    expect(lib().open("nada")).toBe(false);
    expect(lib().notice?.tone).toBe("error");
    expect(cfg()).toBe(antes);
    // Uno guardado con datos que ya no pasan la validación.
    const ok = lib().saveNew("Bueno");
    if (!ok.ok) throw new Error("no guardó");
    const rawList = JSON.parse(st.map.get("sch-mis-disenos-v1")!);
    rawList[0].data = "basura";
    st.map.set("sch-mis-disenos-v1", JSON.stringify(rawList));
    const visible = cfg();
    expect(lib().open(ok.design.id)).toBe(false);
    expect(lib().notice?.text).toContain("No pudimos abrir");
    expect(cfg()).toBe(visible);
    stop();
  });

  it("«Diseño nuevo» deja el diseño de fábrica del mismo sistema y lo autoguarda", () => {
    const st = fakeStorage();
    useConfigurator.setState({ config: initialConfig("tradicional"), past: [], future: [] });
    const stop = lib().init({ storage: st, search: "" });
    useConfigurator.getState().setDeck({ enabled: true });
    lib().startNew();
    expect(cfg().deck.enabled).toBe(false);
    expect(cfg().finish).toBe(initialConfig("tradicional").finish);
    expect(lib().touched).toBe(false);
    expect(readAutosave(st)?.config).toEqual(cfg());
    stop();
  });

  it("duplicar, renombrar y borrar actualizan la lista; borrar el abierto lo deja como trabajo sin guardar", () => {
    const st = fakeStorage();
    const stop = lib().init({ storage: st, search: "" });
    lib().saveNew("A");
    const a = lib().activeId!;
    expect(lib().duplicate(a)).toBe(true);
    expect(lib().list.map((d) => d.name).sort()).toEqual(["A", "A (copia)"]);
    expect(lib().rename(a, "Casa A")).toBe(true);
    expect(lib().list.some((d) => d.name === "Casa A")).toBe(true);
    expect(lib().remove(a)).toBe(true);
    expect(lib().activeId).toBeNull();
    expect(lib().touched).toBe(true);
    expect(hasUnsavedChanges(cfg(), lib().list, lib().activeId, lib().touched)).toBe(false); // la copia es igual
    expect(lib().remove(a)).toBe(false);
    stop();
  });

  it("se llena la lista: avisa con un mensaje claro", () => {
    const st = fakeStorage();
    const stop = lib().init({ storage: st, search: "" });
    for (let i = 0; i < MAX_SAVED_DESIGNS; i++) saveDesign(st, casa(), { name: `D${i}`, now: i });
    lib().refresh();
    const r = lib().saveNew("Otro");
    expect(r.ok).toBe(false);
    expect(lib().notice).toEqual({ tone: "error", text: failureText("limite") });
    stop();
  });

  it("si el navegador no deja guardar, lo dice y no se rompe", () => {
    const stop = lib().init({ storage: null, search: "" });
    expect(lib().storageOk).toBe(false);
    expect(lib().saveNew("X").ok).toBe(false);
    expect(lib().notice?.text).toContain("no nos dejó guardar");
    stop();

    useDesignLibrary.setState({ ready: false, storageOk: true, notice: null, touched: false });
    const lleno = fakeStorage({ failWrites: true });
    const stop2 = lib().init({ storage: lleno, search: "" });
    useConfigurator.getState().setDeck({ enabled: true });
    stop2(); // al guardar falla: avisa una vez
    expect(lib().storageOk).toBe(false);
    expect(lib().notice?.tone).toBe("error");
  });

  it("cambios sin guardar: sin diseño abierto solo cuenta si el cliente ya tocó algo y no coincide con ninguno guardado", () => {
    const c = casa();
    const st = fakeStorage();
    const saved = saveDesign(st, c, { name: "Casa" });
    if (!saved.ok) throw new Error("no guardó");
    const list = listSavedDesigns(st);
    expect(hasUnsavedChanges(c, list, null, false)).toBe(false);
    expect(hasUnsavedChanges(c, [], null, true)).toBe(true);
    expect(hasUnsavedChanges(c, list, null, true)).toBe(false); // ya está guardado con otro nombre
    expect(hasUnsavedChanges({ ...c, ground: "cesped" }, list, null, true)).toBe(true);
    expect(hasUnsavedChanges({ ...c, ground: "cesped" }, list, saved.design.id, false)).toBe(true);
    expect(hasUnsavedChanges(c, list, saved.design.id, false)).toBe(false);
    // Si el diseño abierto ya no está en la lista, se trata como uno sin abrir.
    expect(hasUnsavedChanges(c, list, "borrado", true)).toBe(false);
  });
});
