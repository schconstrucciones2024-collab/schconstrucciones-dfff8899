import { create } from "zustand";
import { HOUR_DAY, HOUR_NIGHT, isDay, wrapHour } from "@/lib/skyModel";
import type { PresetId } from "@/lib/cameraViews";
import {
  PLACE_MESSAGES, addTree, defaultTrees, keepClear, moveTree, removeTree, treeInfo,
  type HouseFrame, type PlaceCheck, type Tree, type TreeKind,
} from "@/lib/vegetation";

/**
 * Estado del entorno del visor "Diseñá tu casa": hora del día, luces, cielo y vegetación.
 * Está separado de `useConfigurator` a propósito: el diseño de la casa (medidas, precio, enlace para compartir)
 * no cambia con el entorno.
 */
export type EntornoState = {
  /** Hora objetivo (0–24). El visor llega a ella con una transición. */
  hour: number;
  /** `false` salta directo a la hora (por ejemplo al arrastrar el control de hora). */
  animate: boolean;
  houseLights: boolean;
  /** Multiplica la exposición del cielo (0,6–1,6). */
  exposure: number;
  clouds: boolean;
  animateSky: boolean;
  showVegetation: boolean;
  trees: Tree[];
  seeded: boolean;
  selectedTree: string | null;
  placing: TreeKind | null;
  movingTree: string | null;
  notice: string | null;
  preset: { n: number; id: PresetId | null };

  setHour: (hour: number, animate?: boolean) => void;
  setDay: () => void;
  setNight: () => void;
  setHouseLights: (on: boolean) => void;
  setExposure: (v: number) => void;
  setClouds: (on: boolean) => void;
  setAnimateSky: (on: boolean) => void;
  setShowVegetation: (on: boolean) => void;
  seed: (frame: HouseFrame) => void;
  clear: (frame: HouseFrame) => void;
  setPlacing: (kind: TreeKind | null) => void;
  plant: (at: { x: number; z: number }, frame: HouseFrame) => PlaceCheck;
  selectTree: (id: string | null) => void;
  setMoving: (id: string | null) => void;
  move: (id: string, at: { x: number; z: number }, frame: HouseFrame) => PlaceCheck;
  remove: (id: string) => void;
  removeAll: () => void;
  setNotice: (text: string | null) => void;
  goTo: (id: PresetId) => void;
  reset: (frame: HouseFrame) => void;
};

const EXPOSURE_MIN = 0.6, EXPOSURE_MAX = 1.6;
const initial = {
  hour: HOUR_DAY, animate: true, houseLights: true, exposure: 1, clouds: true, animateSky: true, showVegetation: true,
  trees: [] as Tree[], seeded: false, selectedTree: null as string | null, placing: null as TreeKind | null, movingTree: null as string | null,
  notice: null as string | null, preset: { n: 0, id: null as PresetId | null },
};

export const useEntorno = create<EntornoState>()((set, get) => ({
  ...initial,
  setHour: (hour, animate = true) => set({ hour: wrapHour(Number.isFinite(hour) ? hour : HOUR_DAY), animate }),
  setDay: () => set({ hour: HOUR_DAY, animate: true }),
  setNight: () => set({ hour: HOUR_NIGHT, animate: true }),
  setHouseLights: (houseLights) => set({ houseLights }),
  setExposure: (v) => set({ exposure: Math.min(EXPOSURE_MAX, Math.max(EXPOSURE_MIN, Number.isFinite(v) ? v : 1)) }),
  setClouds: (clouds) => set({ clouds }),
  setAnimateSky: (animateSky) => set({ animateSky }),
  setShowVegetation: (showVegetation) => set({ showVegetation, ...(showVegetation ? {} : { placing: null, selectedTree: null, movingTree: null }) }),
  seed: (frame) => { if (!get().seeded) set({ trees: defaultTrees(frame), seeded: true }); },
  clear: (frame) => { const next = keepClear(get().trees, frame); if (next !== get().trees) set({ trees: next }); },
  setPlacing: (placing) => set({ placing, selectedTree: null, movingTree: null, notice: placing ? `Tocá el terreno para plantar: ${treeInfo(placing).name}.` : null, ...(placing ? { showVegetation: true } : {}) }),
  plant: (at, frame) => {
    const { placing, trees } = get();
    if (!placing) return { ok: false, reason: "fuera-del-terreno" };
    const r = addTree(trees, placing, at, frame);
    if (r.check.ok) set({ trees: r.trees, selectedTree: r.id ?? null, notice: `${treeInfo(placing).name} plantado. Seguí tocando para agregar más o tocá "Listo".` });
    else set({ notice: PLACE_MESSAGES[r.check.reason] });
    return r.check;
  },
  selectTree: (selectedTree) => set({ selectedTree, ...(selectedTree ? { placing: null } : { movingTree: null }) }),
  setMoving: (movingTree) => set({ movingTree }),
  move: (id, at, frame) => {
    const r = moveTree(get().trees, id, at, frame);
    if (r.check.ok) set({ trees: r.trees });
    return r.check;
  },
  remove: (id) => set((s) => ({ trees: removeTree(s.trees, id), selectedTree: s.selectedTree === id ? null : s.selectedTree, movingTree: null, notice: "Árbol quitado." })),
  removeAll: () => set({ trees: [], selectedTree: null, movingTree: null, placing: null, notice: "Quitaste toda la vegetación." }),
  setNotice: (notice) => set({ notice }),
  goTo: (id) => set((s) => ({ preset: { n: s.preset.n + 1, id } })),
  reset: (frame) => set({ ...initial, trees: defaultTrees(frame), seeded: true, preset: { n: get().preset.n, id: null } }),
}));

/**
 * Nivel de luz de las ventanas (0–1) que calcula el cielo en cada cuadro; las aberturas lo leen sin pasar por React.
 * Es un valor mutable a propósito: cambia 60 veces por segundo durante la transición día/noche.
 */
export const sceneGlow = { level: 0 };

/**
 * Hora que se está mostrando en este cuadro (con la transición día/noche ya aplicada). La leen los reflejos del cielo y la
 * postproducción sin pasar por React, igual que `sceneGlow`.
 */
export const skyClock = { hour: HOUR_DAY };

export const modeOf = (hour: number): "dia" | "noche" => (isDay(hour) ? "dia" : "noche");
