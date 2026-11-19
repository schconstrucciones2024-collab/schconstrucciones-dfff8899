/**
 * «Mis diseños» y autoguardado del diseñador 3D, conectados a la pantalla.
 *
 * - Al abrir el diseñador (`init`) retoma el último diseño de este navegador, o abre el que llega por link compartido (?design=).
 * - Mientras se diseña, guarda solo cada cambio (con una pequeña espera para no escribir en cada movimiento) y también al
 *   cerrar o esconder la pestaña, que en el celular es lo que pasa casi siempre.
 * - Guarda, abre, duplica, renombra y borra diseños con nombre.
 *
 * La lógica de guardado está en `designStorage.ts` (funciones puras, con pruebas); acá solo se conecta con el store del
 * diseñador (`useConfigurator`) y con el navegador.
 */
import { create } from "zustand";
import { systemOf } from "@/config/systems";
import { decodeDesign, initialConfig, useConfigurator, type HouseConfig } from "@/store/useConfigurator";
import {
  MAX_SAVED_DESIGNS,
  SAVED_DESIGNS_KEY,
  browserStorage,
  deleteDesign,
  designFingerprint,
  duplicateDesign,
  listSavedDesigns,
  openSavedDesign,
  readAutosave,
  renameDesign,
  saveDesign,
  writeAutosave,
  type SaveFailure,
  type SaveResult,
  type SavedDesign,
  type StorageLike,
} from "@/store/designStorage";

export type LibraryNotice = { tone: "info" | "error"; text: string };

/** Espera antes de escribir el autoguardado, para no escribir en cada movimiento. */
export const AUTOSAVE_DELAY_MS = 500;

export function failureText(reason: SaveFailure): string {
  switch (reason) {
    case "limite":
      return `Ya tenés ${MAX_SAVED_DESIGNS} diseños guardados. Eliminá alguno para guardar otro.`;
    case "almacenamiento":
      return "Tu navegador no nos dejó guardar (modo privado, almacenamiento lleno o bloqueado). Copiá el link de tu diseño para no perderlo.";
    case "invalido":
      return "Este diseño tiene algo que todavía no se puede guardar. Probá deshacer el último cambio.";
    case "grande":
      return "El diseño es demasiado grande para guardarlo.";
    case "no-existe":
      return "Ese diseño ya no está guardado.";
  }
}

/**
 * ¿Lo que se ve en pantalla tiene cambios que no están en ningún diseño guardado?
 * - Con un diseño guardado abierto: si difiere de lo guardado.
 * - Sin ninguno abierto: si el cliente ya tocó algo y no coincide con ningún guardado.
 */
export function hasUnsavedChanges(config: HouseConfig, list: readonly SavedDesign[], activeId: string | null, touched: boolean): boolean {
  const fp = designFingerprint(config);
  const active = activeId ? list.find((d) => d.id === activeId) : undefined;
  if (active) return fp !== active.fp;
  if (!touched) return false;
  return !list.some((d) => d.fp === fp);
}

type Library = {
  ready: boolean;
  /** false si el navegador no deja guardar (modo privado, bloqueado o lleno). */
  storageOk: boolean;
  list: SavedDesign[];
  /** El diseño guardado que está abierto en pantalla, si hay uno. */
  activeId: string | null;
  /** El cliente ya hizo cambios en lo que se ve (puede no estar guardado en ningún diseño con nombre). */
  touched: boolean;
  notice: LibraryNotice | null;
  /** Arranca el guardado. Devuelve la función que lo detiene (al desmontar el diseñador). */
  init: (opts?: { storage?: StorageLike | null; search?: string }) => () => void;
  refresh: () => void;
  saveNew: (name?: string) => SaveResult;
  saveChanges: () => SaveResult;
  open: (id: string) => boolean;
  startNew: () => void;
  rename: (id: string, name: string) => boolean;
  duplicate: (id: string) => boolean;
  remove: (id: string) => boolean;
  dismissNotice: () => void;
};

let storage: StorageLike | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Pone un diseño en pantalla (sin historial de deshacer: el de antes ya no corresponde). */
function show(config: HouseConfig) {
  useConfigurator.setState({ config, past: [], future: [], selectedId: null, placing: null, error: null, activeFloor: 0 });
}

export const useDesignLibrary = create<Library>((set, get) => {
  const info = (text: string) => set({ notice: { tone: "info", text } });
  const problem = (reason: SaveFailure) => set({ notice: { tone: "error", text: failureText(reason) } });
  const reload = () => {
    const list = listSavedDesigns(storage);
    set((s) => ({ list, activeId: s.activeId && list.some((d) => d.id === s.activeId) ? s.activeId : null }));
  };
  /**
   * Escribe el autoguardado ya, con el estado de ahora. Si el cliente todavía no tocó nada (y no abrió un diseño guardado)
   * no escribe: así alguien que solo mira la página no deja un «último diseño» que no armó.
   */
  const persist = (force = false) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!storage) return;
    if (!force && !get().touched && !get().activeId) return;
    const result = writeAutosave(storage, useConfigurator.getState().config, get().activeId);
    if (result === "almacenamiento" && get().storageOk) {
      set({ storageOk: false, notice: { tone: "error", text: failureText("almacenamiento") } });
    } else if (result === "ok" && !get().storageOk) {
      set({ storageOk: true });
    }
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => persist(), AUTOSAVE_DELAY_MS);
  };
  /** Después de cambiar qué diseño está abierto (nuevo, abierto, borrado…): se guarda enseguida, sin esperar. */
  const settle = () => persist(true);

  return {
    ready: false,
    storageOk: true,
    list: [],
    activeId: null,
    touched: false,
    notice: null,

    init: (opts = {}) => {
      storage = opts.storage === undefined ? browserStorage() : opts.storage;
      const search = opts.search ?? (typeof window !== "undefined" ? window.location.search : "");
      const list = listSavedDesigns(storage);
      set({ storageOk: storage !== null, list });

      let encoded: string | null = null;
      try {
        encoded = new URLSearchParams(search).get("design");
      } catch {
        /* sin parámetros */
      }
      const linked = encoded ? decodeDesign(encoded) : null;
      const auto = readAutosave(storage);

      if (linked) {
        // Un link compartido manda sobre el autoguardado, pero lo que el cliente tenía armado no se pierde:
        // si no estaba guardado con nombre, queda en «Mis diseños».
        let replaced = false; // había un diseño armado que no se pudo guardar en «Mis diseños»
        let kept = false;
        if (auto && designFingerprint(auto.config) !== designFingerprint(linked)) {
          const fp = designFingerprint(auto.config);
          kept = list.some((d) => d.fp === fp) || saveDesign(storage, auto.config, { name: "Diseño anterior (autoguardado)" }).ok;
          replaced = !kept;
        }
        show(linked);
        set({
          list: listSavedDesigns(storage),
          activeId: null,
          touched: false,
          notice: {
            tone: "info",
            text: kept
              ? "Abrimos el diseño del link. El que tenías armado quedó guardado en «Mis diseños»."
              : replaced
                ? "Abrimos el diseño del link. Ojo: el que tenías armado no se pudo guardar en «Mis diseños» y quedó reemplazado."
                : "Abrimos el diseño del link. Desde acá lo podés modificar y guardar.",
          },
        });
        // Se anota ya y se saca el link de la dirección: si no, al recargar volvería a abrirse el original y pisaría los cambios.
        writeAutosave(storage, linked, null);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("design");
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        } catch {
          /* sin historial del navegador */
        }
      } else if (auto) {
        const activeId = auto.activeId && list.some((d) => d.id === auto.activeId) ? auto.activeId : null;
        if (designFingerprint(auto.config) !== designFingerprint(useConfigurator.getState().config)) {
          show(auto.config);
          set({ activeId, touched: true, notice: { tone: "info", text: "Retomamos tu último diseño. Se guarda solo en este dispositivo." } });
        } else if (get().activeId === null) {
          set({ activeId });
        }
      }

      const unsubscribe = useConfigurator.subscribe((s, prev) => {
        if (s.config === prev.config) return;
        if (!get().touched) set({ touched: true });
        schedule();
      });
      const onHide = () => persist();
      const onVisibility = () => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") persist();
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === SAVED_DESIGNS_KEY) reload();
      };
      const win = typeof window !== "undefined" && typeof window.addEventListener === "function" ? window : null;
      const doc = typeof document !== "undefined" && typeof document.addEventListener === "function" ? document : null;
      win?.addEventListener("pagehide", onHide);
      win?.addEventListener("storage", onStorage);
      doc?.addEventListener("visibilitychange", onVisibility);
      set({ ready: true });
      return () => {
        persist();
        unsubscribe();
        win?.removeEventListener("pagehide", onHide);
        win?.removeEventListener("storage", onStorage);
        doc?.removeEventListener("visibilitychange", onVisibility);
      };
    },

    refresh: reload,

    saveNew: (name) => {
      const result = saveDesign(storage, useConfigurator.getState().config, { name });
      if (!result.ok) {
        problem(result.reason);
        return result;
      }
      set({ list: listSavedDesigns(storage), activeId: result.design.id, touched: false });
      info(`Guardamos «${result.design.name}». Lo podés abrir y modificar cuando quieras.`);
      settle();
      return result;
    },

    saveChanges: () => {
      const id = get().activeId;
      if (!id) return { ok: false, reason: "no-existe" };
      const result = saveDesign(storage, useConfigurator.getState().config, { id });
      if (!result.ok) {
        problem(result.reason);
        return result;
      }
      set({ list: listSavedDesigns(storage) });
      info(`Guardamos los cambios en «${result.design.name}».`);
      return result;
    },

    open: (id) => {
      reload();
      const saved = get().list.find((d) => d.id === id);
      const config = saved ? openSavedDesign(saved) : null;
      if (!saved || !config) {
        set({
          notice: {
            tone: "error",
            text: saved
              ? "No pudimos abrir este diseño: puede haberse guardado con una versión anterior de la web."
              : failureText("no-existe"),
          },
        });
        return false;
      }
      show(config);
      set({ activeId: id, touched: false });
      info(`Abrimos «${saved.name}». Lo que cambies se autoguarda; tocá «Guardar cambios» para quedarte con eso en este diseño.`);
      settle();
      return true;
    },

    startNew: () => {
      show(initialConfig(systemOf(useConfigurator.getState().config.finish)));
      useConfigurator.setState({ view: "exterior" });
      set({ activeId: null, touched: false });
      info("Empezaste un diseño nuevo.");
      settle();
    },

    rename: (id, name) => {
      const result = renameDesign(storage, id, name);
      if (!result.ok) {
        problem(result.reason);
        return false;
      }
      set({ list: listSavedDesigns(storage) });
      return true;
    },

    duplicate: (id) => {
      const result = duplicateDesign(storage, id);
      if (!result.ok) {
        problem(result.reason);
        return false;
      }
      set({ list: listSavedDesigns(storage) });
      info(`Hicimos una copia: «${result.design.name}».`);
      return true;
    },

    remove: (id) => {
      const gone = deleteDesign(storage, id);
      if (!gone) {
        reload();
        return false;
      }
      const wasOpen = get().activeId === id;
      set({ list: listSavedDesigns(storage), ...(wasOpen ? { activeId: null, touched: true } : {}) });
      if (wasOpen) {
        info("Borramos ese diseño. Lo que ves en pantalla sigue autoguardado, pero ya no está en «Mis diseños».");
        settle();
      }
      return true;
    },

    dismissNotice: () => set({ notice: null }),
  };
});
