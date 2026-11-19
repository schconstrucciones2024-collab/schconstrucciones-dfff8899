/**
 * Guardado de diseños del diseñador 3D en el propio navegador (sin servidor, sin cuenta).
 *
 * Hay dos cosas guardadas:
 * - El AUTOGUARDADO: el diseño que se está armando, con el último cambio. Si el cliente sale de la web y vuelve, lo retoma.
 * - «MIS DISEÑOS»: diseños con nombre, que el cliente guarda a propósito (hasta `MAX_SAVED_DESIGNS`), para abrirlos,
 *   modificarlos, duplicarlos o borrarlos cuando quiera.
 *
 * Todo se guarda con el mismo formato (y las mismas validaciones) que el link para compartir: `encodeDesign` / `decodeDesign`.
 * Así un diseño guardado nunca puede dejar la pantalla en un estado inválido: si no pasa la validación, no se abre.
 *
 * Este archivo son solo funciones: reciben el almacenamiento (`StorageLike`) y no tocan `window`. Así se prueban sin navegador.
 * El navegador puede negar el almacenamiento (modo privado, bloqueado, lleno): todo devuelve un resultado en vez de romper.
 */
import { decodeDesign, encodeDesign, type HouseConfig } from "@/store/useConfigurator";

/** Diseño que se está armando ahora (autoguardado). */
export const AUTOSAVE_KEY = "sch-diseno-actual-v1";
/** Lista de «Mis diseños». */
export const SAVED_DESIGNS_KEY = "sch-mis-disenos-v1";
export const MAX_SAVED_DESIGNS = 20;
export const MAX_NAME_LENGTH = 60;
/** `decodeDesign` descarta textos más largos que esto: no vale la pena guardar algo que después no se puede abrir. */
export const MAX_DESIGN_CHARS = 100000;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type DesignSummary = { m2: number; floors: number; finish: string };
export type SavedDesign = {
  id: string;
  name: string;
  /** Milisegundos desde 1970 (cuándo se guardó por última vez). */
  savedAt: number;
  /** El diseño, en el formato del link compartido. */
  data: string;
  /** Huella del diseño tal como se vuelve a abrir (sirve para saber si hay cambios sin guardar). */
  fp: string;
  summary: DesignSummary;
};

export type SaveFailure = "limite" | "almacenamiento" | "invalido" | "grande" | "no-existe";
export type SaveResult = { ok: true; design: SavedDesign } | { ok: false; reason: SaveFailure };
export type Autosave = { config: HouseConfig; activeId: string | null; savedAt: number };

/** El almacenamiento del navegador, o null si no se puede usar (se prueba escribiendo y borrando una clave). */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "sch-prueba-almacenamiento";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Texto que identifica a un diseño, igual si las claves vienen en otro orden.
 * Se usa para saber si el diseño que se ve es el mismo que el guardado.
 */
export function designFingerprint(c: HouseConfig): string {
  return JSON.stringify(c, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : value,
  );
}

/** Nombre limpio: sin espacios de más, sin saltos de línea y de largo acotado. Vacío si no queda nada. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trim();
}

/** «Mi diseño 1», «Mi diseño 2»… el primero que no esté usado. */
export function defaultName(list: readonly SavedDesign[]): string {
  const used = new Set(list.map((d) => d.name.toLowerCase()));
  for (let n = 1; n <= MAX_SAVED_DESIGNS + 1; n++) {
    const name = `Mi diseño ${n}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return "Mi diseño";
}

/** Si ya hay uno con ese nombre, le agrega « (2)», « (3)»… sin pasarse del largo máximo. */
export function uniqueName(name: string, list: readonly SavedDesign[], ignoreId?: string): string {
  const used = new Set(list.filter((d) => d.id !== ignoreId).map((d) => d.name.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  for (let n = 2; n < 1000; n++) {
    const suffix = ` (${n})`;
    const candidate = `${name.slice(0, MAX_NAME_LENGTH - suffix.length).trim()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return name;
}

let counter = 0;
function newId(now: number): string {
  counter = (counter + 1) % 1e6;
  return `d-${now.toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const summaryOf = (c: HouseConfig): DesignSummary => ({ m2: Number(c.m2.toFixed(2)), floors: c.floors, finish: c.finish });

function isSavedDesign(v: unknown): v is SavedDesign {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  const s = d.summary as Record<string, unknown> | undefined;
  return (
    typeof d.id === "string" &&
    d.id.length > 0 &&
    typeof d.name === "string" &&
    typeof d.savedAt === "number" &&
    Number.isFinite(d.savedAt) &&
    typeof d.data === "string" &&
    d.data.length > 0 &&
    d.data.length <= MAX_DESIGN_CHARS &&
    typeof d.fp === "string" &&
    !!s &&
    typeof s.m2 === "number" &&
    typeof s.floors === "number" &&
    typeof s.finish === "string"
  );
}

/** Los diseños guardados, del más reciente al más viejo. Lo dañado o ajeno se ignora. */
export function listSavedDesigns(storage: StorageLike | null): SavedDesign[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SAVED_DESIGNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const list: SavedDesign[] = [];
    for (const item of parsed) {
      if (!isSavedDesign(item) || seen.has(item.id)) continue;
      seen.add(item.id);
      list.push(item);
    }
    return list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_SAVED_DESIGNS);
  } catch {
    return [];
  }
}

function writeList(storage: StorageLike | null, list: SavedDesign[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVED_DESIGNS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Arma la ficha de un diseño nuevo, comprobando que se pueda volver a abrir. */
function pack(config: HouseConfig): { data: string; fp: string; summary: DesignSummary } | SaveFailure {
  let data: string;
  try {
    data = encodeDesign(config);
  } catch {
    return "invalido";
  }
  if (data.length > MAX_DESIGN_CHARS) return "grande";
  const back = decodeDesign(data);
  if (!back) return "invalido";
  return { data, fp: designFingerprint(back), summary: summaryOf(back) };
}

/**
 * Guarda el diseño en «Mis diseños». Con `id` de un diseño que existe, lo actualiza (conserva el nombre salvo que se pase otro);
 * sin `id`, agrega uno nuevo (con el nombre pedido o «Mi diseño N»; si el nombre ya existe, le agrega un número).
 */
export function saveDesign(
  storage: StorageLike | null,
  config: HouseConfig,
  opts: { id?: string | null; name?: string; now?: number } = {},
): SaveResult {
  if (!storage) return { ok: false, reason: "almacenamiento" };
  const now = opts.now ?? Date.now();
  const packed = pack(config);
  if (typeof packed === "string") return { ok: false, reason: packed };
  const list = listSavedDesigns(storage);
  const index = opts.id ? list.findIndex((d) => d.id === opts.id) : -1;
  if (opts.id && index < 0) return { ok: false, reason: "no-existe" };
  const typed = cleanName(opts.name ?? "");
  let design: SavedDesign;
  let next: SavedDesign[];
  if (index >= 0) {
    const old = list[index]!;
    design = { ...old, ...packed, name: typed ? uniqueName(typed, list, old.id) : old.name, savedAt: now };
    next = list.map((d, i) => (i === index ? design : d));
  } else {
    if (list.length >= MAX_SAVED_DESIGNS) return { ok: false, reason: "limite" };
    design = { id: newId(now), name: uniqueName(typed || defaultName(list), list), savedAt: now, ...packed };
    next = [design, ...list];
  }
  return writeList(storage, next) ? { ok: true, design } : { ok: false, reason: "almacenamiento" };
}

/** Cambia el nombre (no toca el diseño ni la fecha). */
export function renameDesign(storage: StorageLike | null, id: string, name: string): SaveResult {
  const list = listSavedDesigns(storage);
  const old = list.find((d) => d.id === id);
  if (!old) return { ok: false, reason: "no-existe" };
  const typed = cleanName(name);
  if (!typed) return { ok: false, reason: "invalido" };
  const design = { ...old, name: uniqueName(typed, list, id) };
  return writeList(storage, list.map((d) => (d.id === id ? design : d))) ? { ok: true, design } : { ok: false, reason: "almacenamiento" };
}

/** Hace una copia («Nombre (copia)») para seguir modificando sin tocar el original. */
export function duplicateDesign(storage: StorageLike | null, id: string, now: number = Date.now()): SaveResult {
  const list = listSavedDesigns(storage);
  const old = list.find((d) => d.id === id);
  if (!old) return { ok: false, reason: "no-existe" };
  if (list.length >= MAX_SAVED_DESIGNS) return { ok: false, reason: "limite" };
  const suffix = " (copia)";
  const name = uniqueName(`${old.name.slice(0, MAX_NAME_LENGTH - suffix.length).trim()}${suffix}`, list);
  const design: SavedDesign = { ...old, id: newId(now), name, savedAt: now };
  return writeList(storage, [design, ...list]) ? { ok: true, design } : { ok: false, reason: "almacenamiento" };
}

/** Borra un diseño guardado. Devuelve false si no existía o no se pudo escribir. */
export function deleteDesign(storage: StorageLike | null, id: string): boolean {
  const list = listSavedDesigns(storage);
  if (!list.some((d) => d.id === id)) return false;
  return writeList(storage, list.filter((d) => d.id !== id));
}

/** Link para abrir un diseño guardado en cualquier dispositivo (el mismo formato del link de «Compartir»). */
export function savedDesignUrl(d: Pick<SavedDesign, "data">, href: string): string {
  return `${href.split("#")[0]?.split("?")[0]}?design=${d.data}#disenar`;
}

/** Abre un diseño guardado: pasa por las mismas validaciones que un link compartido. Null si no se puede abrir. */
export function openSavedDesign(d: Pick<SavedDesign, "data">): HouseConfig | null {
  return decodeDesign(d.data);
}

/**
 * Guarda el diseño que se está armando para retomarlo al volver. Si el diseño no pasa la validación NO pisa el autoguardado
 * anterior: es mejor retomar el último diseño bueno que uno que no se puede abrir.
 * Devuelve «ok», «invalido» (el diseño no se puede guardar) o «almacenamiento» (el navegador no deja escribir).
 */
export function writeAutosave(
  storage: StorageLike | null,
  config: HouseConfig,
  activeId: string | null,
  now: number = Date.now(),
): "ok" | "invalido" | "almacenamiento" {
  if (!storage) return "almacenamiento";
  let data: string;
  try {
    data = encodeDesign(config);
    if (data.length > MAX_DESIGN_CHARS || !decodeDesign(data)) return "invalido";
  } catch {
    return "invalido";
  }
  try {
    storage.setItem(AUTOSAVE_KEY, JSON.stringify({ v: 1, savedAt: now, activeId, data }));
    return "ok";
  } catch {
    return "almacenamiento";
  }
}

/** El diseño autoguardado, ya validado, o null si no hay (o no se puede abrir). */
export function readAutosave(storage: StorageLike | null): Autosave | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const rec: unknown = JSON.parse(raw);
    if (!rec || typeof rec !== "object") return null;
    const r = rec as Record<string, unknown>;
    if (typeof r.data !== "string") return null;
    const config = decodeDesign(r.data);
    if (!config) return null;
    return {
      config,
      activeId: typeof r.activeId === "string" ? r.activeId : null,
      savedAt: typeof r.savedAt === "number" && Number.isFinite(r.savedAt) ? r.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearAutosave(storage: StorageLike | null): void {
  try {
    storage?.removeItem(AUTOSAVE_KEY);
  } catch {
    /* sin almacenamiento */
  }
}
