import { create } from "zustand";
import { ALL_FX, NO_LIMITS, PROFILES, defaultQuality, deviceLimits, effectiveFx, lowerQuality, type DeviceInfo, type DeviceLimits, type EffectiveFx, type FxToggles, type QualityId } from "@/lib/renderQuality";

/**
 * Calidad de render del visor y efectos de postproducción. Está separado de `useConfigurator` (diseño y precio)
 * y de `useEntorno` (hora, cielo, vegetación): cambiar la calidad no toca el presupuesto ni el enlace para compartir.
 */
export type RenderFxState = FxToggles & {
  quality: QualityId;
  /** Si está activo, el visor baja solo la calidad cuando va lento. */
  auto: boolean;
  /** Motivo por el que la postproducción se apagó sola (`null` = funciona). */
  failed: string | null;
  initialized: boolean;
  /** Límites del equipo (celular, pocos núcleos): se fijan en `init`. */
  limits: DeviceLimits;
  notice: string | null;

  /** Elige la calidad inicial según el equipo (una sola vez por carga de la página). */
  init: (device: DeviceInfo) => void;
  setQuality: (id: QualityId) => void;
  setAuto: (on: boolean) => void;
  setAo: (on: boolean) => void;
  setBloom: (on: boolean) => void;
  setReflections: (on: boolean) => void;
  setCine: (on: boolean) => void;
  /** Baja un escalón por lentitud. Devuelve la calidad nueva o `null` si ya estaba en el mínimo. */
  degrade: () => QualityId | null;
  /** La postproducción no anda en este dispositivo: se vuelve al render simple. */
  fail: (reason: string) => void;
  /** Vuelve a intentar la postproducción después de una falla. */
  retry: () => void;
  setNotice: (text: string | null) => void;
};

export const useRenderFx = create<RenderFxState>()((set, get) => ({
  ...ALL_FX,
  // Arranca en Económico (también en el servidor): `init` sube la calidad en el navegador si el equipo lo permite.
  quality: "economico",
  auto: true,
  failed: null,
  initialized: false,
  limits: NO_LIMITS,
  notice: null,

  init: (device) => {
    if (get().initialized) return;
    set({ quality: defaultQuality(device), limits: deviceLimits(device), initialized: true });
  },
  setQuality: (id) => set({ quality: PROFILES[id] ? id : "economico", failed: null, notice: `Calidad de render: ${PROFILES[id]?.label ?? "Económico"}.` }),
  setAuto: (auto) => set({ auto }),
  setAo: (ao) => set({ ao }),
  setBloom: (bloom) => set({ bloom }),
  setReflections: (reflections) => set({ reflections }),
  setCine: (cine) => set({ cine }),
  degrade: () => {
    const next = lowerQuality(get().quality);
    if (!next) return null;
    set({ quality: next, notice: `Bajamos la calidad de render a ${PROFILES[next].label} para que el visor se mueva con fluidez. Podés volver a subirla en Visualización.` });
    return next;
  },
  fail: (reason) => set({ failed: reason, notice: `Los efectos de render se desactivaron: ${reason}` }),
  retry: () => set({ failed: null, notice: "Probando de nuevo los efectos de render." }),
  setNotice: (notice) => set({ notice }),
}));

/** Lo que queda activo hoy (perfil + interruptores + falla). Es un valor nuevo en cada llamada: usarlo con `useMemo`. */
export const fxOf = (s: Pick<RenderFxState, "quality" | "ao" | "bloom" | "reflections" | "cine" | "failed"> & { limits?: DeviceLimits }): EffectiveFx =>
  effectiveFx(s.quality, { ao: s.ao, bloom: s.bloom, reflections: s.reflections, cine: s.cine }, s.failed !== null, s.limits);
