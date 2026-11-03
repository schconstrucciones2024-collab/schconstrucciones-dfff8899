/**
 * Estado del apartado "Sistemas constructivos": qué sistema se ve, qué opciones hay elegidas (en la pared A y, al
 * comparar, en la B), qué capas están ocultas, cuál está seleccionada, cuánto está explotada la vista y desde dónde se mira.
 * Es un reductor puro: el componente solo despacha acciones, y acá se prueba que cada una hace lo que dice.
 */
import { SYSTEMS, defaultOptions, type SystemId } from "@/config/wallSystems";
import { presentLayerIds } from "./wallModel";

export type Side = "A" | "B";

export const VIEWS = [
  { id: "iso", label: "Isométrica" },
  { id: "frente", label: "Frente" },
  { id: "lateral", label: "Corte lateral" },
  { id: "interior", label: "Desde el interior" },
  { id: "planta", label: "Planta" },
] as const;
export type ViewId = (typeof VIEWS)[number]["id"];

type PerSystem = { A: Record<string, string>; B: Record<string, string>; hidden: string[] };

export type WallState = {
  system: SystemId;
  per: Record<SystemId, PerSystem>;
  /** 0 = armada, 1 = totalmente explotada. */
  explode: number;
  selected: string | null;
  compare: boolean;
  /** Qué pared editan los tags cuando se está comparando. */
  editing: Side;
  view: ViewId;
};

export type WallAction =
  | { type: "system"; system: SystemId }
  | { type: "option"; key: string; value: string }
  | { type: "toggleLayer"; id: string }
  | { type: "showAll" }
  | { type: "select"; id: string | null }
  | { type: "explode"; value: number }
  | { type: "toggleExplode" }
  | { type: "compare"; on: boolean }
  | { type: "editing"; side: Side }
  | { type: "view"; view: ViewId }
  | { type: "restore" };

const fresh = (system: SystemId): PerSystem => ({ A: defaultOptions(system), B: defaultOptions(system), hidden: [] });

export function initialWallState(system: SystemId = "woodframe"): WallState {
  return { system, per: { woodframe: fresh("woodframe"), tradicional: fresh("tradicional") }, explode: 0, selected: null, compare: false, editing: "A", view: "iso" };
}

export const optionsOf = (s: WallState, side: Side = "A") => s.per[s.system][side];

/** Capas que existen en alguna de las paredes que se están mostrando. */
export function layersInUse(s: WallState): string[] {
  const p = s.per[s.system];
  const a = presentLayerIds(s.system, p.A);
  if (!s.compare) return a;
  const b = new Set(presentLayerIds(s.system, p.B));
  return SYSTEMS[s.system].layers(p.A).map((l) => l.id).filter((id) => a.includes(id) || b.has(id));
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function withSelectionValid(s: WallState): WallState {
  return s.selected && !layersInUse(s).includes(s.selected) ? { ...s, selected: null } : s;
}

export function wallReducer(s: WallState, a: WallAction): WallState {
  switch (a.type) {
    case "system":
      return a.system === s.system ? s : { ...s, system: a.system, selected: null, compare: false, editing: "A" };
    case "option": {
      const def = SYSTEMS[s.system].options.find((o) => o.key === a.key);
      if (!def || !def.values.some((v) => v.value === a.value)) return s;
      const p = s.per[s.system];
      const sides: Side[] = s.compare ? [s.editing] : ["A", "B"];
      const next: PerSystem = { ...p };
      for (const side of sides) next[side] = { ...p[side], [a.key]: a.value };
      return withSelectionValid({ ...s, per: { ...s.per, [s.system]: next } });
    }
    case "toggleLayer": {
      if (!layersInUse(s).includes(a.id)) return s;
      const p = s.per[s.system];
      const hidden = p.hidden.includes(a.id) ? p.hidden.filter((h) => h !== a.id) : [...p.hidden, a.id];
      return { ...s, per: { ...s.per, [s.system]: { ...p, hidden } } };
    }
    case "showAll":
      return { ...s, per: { ...s.per, [s.system]: { ...s.per[s.system], hidden: [] } } };
    case "select":
      if (a.id !== null && !layersInUse(s).includes(a.id)) return s;
      return { ...s, selected: a.id === s.selected ? null : a.id };
    case "explode":
      return { ...s, explode: clamp01(a.value) };
    case "toggleExplode":
      return { ...s, explode: s.explode > 0.5 ? 0 : 1 };
    case "compare": {
      if (a.on === s.compare) return s;
      const p = s.per[s.system];
      // Al empezar a comparar, la pared B parte igual que la A (después se cambia lo que se quiera comparar).
      return a.on
        ? { ...s, compare: true, editing: "B", per: { ...s.per, [s.system]: { ...p, B: { ...p.A } } } }
        : withSelectionValid({ ...s, compare: false, editing: "A", per: { ...s.per, [s.system]: { ...p, B: { ...p.A } } } });
    }
    case "editing":
      return s.compare ? { ...s, editing: a.side } : s;
    case "view":
      return { ...s, view: a.view };
    case "restore":
      return { ...initialWallState(s.system), per: { ...s.per, [s.system]: fresh(s.system) } };
  }
}
