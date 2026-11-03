import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Camera, Check, Cloud, Layers3, Lightbulb, Moon, Palette, Sun, TreePine, X } from "lucide-react";
import { useConfigurator, type ViewId } from "@/store/useConfigurator";
import { useEntorno, modeOf } from "@/store/useEntorno";
import { useRenderFx } from "@/store/useRenderFx";
import { PROFILES, QUALITY_IDS } from "@/lib/renderQuality";
import { useEffectiveFx } from "./useEffectiveFx";
import { PRESETS, type PresetId } from "@/lib/cameraViews";
import { HOUR_DAY, HOUR_NIGHT, formatHour } from "@/lib/skyModel";
import { TREE_KINDS, toWorld, treeInfo, type TreeKind } from "@/lib/vegetation";
import { CATEGORIES } from "@/lib/cotizador";
import { MaterialsSheet } from "./MaterialsSheet";
import { useHouseVolume } from "./useHouseVolume";

/**
 * Barra de herramientas del visor: Cámara, Día/Noche, Materiales, Entorno, Vegetación, Iluminación y Visualización.
 * Cada botón abre su panel debajo de la barra (un panel a la vez; Escape lo cierra). Todo lo que hay en los paneles
 * ejecuta una acción real sobre el visor: no hay botones decorativos.
 */
type GroupId = "camara" | "dia" | "materiales" | "entorno" | "vegetacion" | "iluminacion" | "visualizacion";
const GROUPS: { id: GroupId; name: string; Icon: typeof Sun }[] = [
  { id: "camara", name: "Cámara", Icon: Camera },
  { id: "dia", name: "Día y noche", Icon: Sun },
  { id: "materiales", name: "Materiales", Icon: Palette },
  { id: "entorno", name: "Entorno", Icon: Cloud },
  { id: "vegetacion", name: "Vegetación", Icon: TreePine },
  { id: "iluminacion", name: "Iluminación", Icon: Lightbulb },
  { id: "visualizacion", name: "Visualización", Icon: Layers3 },
];
const VIEWS: { id: ViewId; name: string }[] = [
  { id: "exterior", name: "Exterior" },
  { id: "interior", name: "Interior" },
  { id: "corte", name: "Corte" },
  { id: "planta", name: "Planta" },
  { id: "recorrido", name: "Recorrido" },
];
const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center gap-2 border px-3 text-xs font-medium transition-[background-color,border-color,color] duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary hover:text-primary"}`;

function Switch({ label, on, onChange, hint, disabled = false }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on && !disabled} disabled={disabled} onClick={() => onChange(!on)} className={`${chip(on && !disabled)} w-full justify-between sm:w-auto ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <span className="text-left">{label}{hint ? <span className="block text-[10px] font-normal opacity-80">{hint}</span> : null}</span>
      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full border ${on ? "border-primary-foreground/50 bg-primary-foreground/30" : "border-border bg-secondary"}`}>
        <span className={`absolute left-0.5 top-0.5 size-3.5 rounded-full transition-transform duration-200 motion-reduce:transition-none ${on ? "translate-x-[18px] bg-primary-foreground" : "translate-x-0 bg-foreground/60"}`} />
      </span>
    </button>
  );
}

function Slider({ label, value, min, max, step, onChange, shown }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; shown: string }) {
  const id = useId();
  return (
    <div className="min-w-0 sm:min-w-[260px]">
      <label htmlFor={id} className="flex items-center justify-between text-xs font-medium text-foreground"><span>{label}</span><output htmlFor={id} className="tabular-nums text-primary">{shown}</output></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 h-11 w-full cursor-pointer accent-primary" />
    </div>
  );
}

export function EntornoToolbar({ onStep }: { onStep: (step: number) => void }) {
  const [open, setOpen] = useState<GroupId | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const view = useConfigurator((s) => s.view);
  const setView = useConfigurator((s) => s.setView);
  const underHouse = useConfigurator((s) => s.underHouse);
  const toggleUnder = useConfigurator((s) => s.toggleUnder);
  const finish = useConfigurator((s) => s.config.finish);
  const house = useHouseVolume();
  const e = useEntorno();
  const fx = useRenderFx();
  const eff = useEffectiveFx();
  const mode = modeOf(e.hour);
  const selected = e.trees.find((t) => t.id === e.selectedTree) ?? null;
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);

  useEffect(() => {
    if (!open) return;
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      setOpen(null);
      root.current?.querySelector<HTMLButtonElement>(`[data-group="${open}"]`)?.focus();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  const goPreset = (id: PresetId) => {
    if (view !== "exterior") setView("exterior");
    e.goTo(id);
  };
  const nudge = (dx: number, dz: number) => {
    if (!selected) return;
    const d = toWorld({ x: dx, z: dz }, { position: { x: 0, z: 0 }, rotation: house.rotation });
    const r = e.move(selected.id, { x: selected.x + d.x, z: selected.z + d.z }, house);
    if (!r.ok) e.setNotice("No se puede mover más en esa dirección.");
    else e.setNotice(null);
  };

  const panel = (id: GroupId): ReactNode => {
    switch (id) {
      case "camara":
        return (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" title={p.hint} className={chip(e.preset.id === p.id && view === "exterior")} aria-pressed={e.preset.id === p.id && view === "exterior"} onClick={() => goPreset(p.id)}>{p.name}</button>
            ))}
            <button type="button" title="Recorré el interior de la casa" className={chip(view === "interior")} aria-pressed={view === "interior"} onClick={() => setView("interior")}>Interior</button>
            <p className="basis-full text-xs text-foreground/65">En las vistas exteriores la cámara no atraviesa el suelo ni las paredes de la casa. En la vista interior se mantiene por encima del piso.</p>
          </div>
        );
      case "dia":
        return (
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" className={chip(mode === "dia")} aria-pressed={mode === "dia"} onClick={() => e.setDay()}><Sun size={15} aria-hidden="true" />Modo día</button>
            <button type="button" className={chip(mode === "noche")} aria-pressed={mode === "noche"} onClick={() => e.setNight()}><Moon size={15} aria-hidden="true" />Modo noche</button>
            <button type="button" className={chip(false)} onClick={() => e.setHour(6.5)}>Amanecer</button>
            <button type="button" className={chip(false)} onClick={() => e.setHour(19.2)}>Atardecer</button>
            <Slider label="Hora del día" value={e.hour} min={0} max={23.75} step={0.25} shown={formatHour(e.hour)} onChange={(v) => e.setHour(v, false)} />
            <p className="basis-full text-xs text-foreground/65">{reduced ? "Tu sistema pide menos movimiento: el cambio de hora es directo." : `El cambio entre día y noche es progresivo (modo día ${formatHour(HOUR_DAY)}, modo noche ${formatHour(HOUR_NIGHT)}).`}</p>
          </div>
        );
      case "materiales":
        return (
          <div>
            <p className="text-xs text-foreground/75">Terminación elegida: <span className="font-semibold text-foreground">{finishName(finish)}</span></p>
            <div className="max-w-md"><MaterialsSheet finish={finish} /></div>
            <button type="button" className={`${chip(false)} mt-4`} onClick={() => { onStep(3); setOpen(null); document.getElementById("config-title")?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); }}>Cambiar la terminación</button>
          </div>
        );
      case "entorno":
        return (
          <div className="flex flex-wrap items-start gap-3">
            <Switch label="Nubes" on={e.clouds} onChange={e.setClouds} />
            <Switch label="Cielo animado" on={e.animateSky && !reduced} onChange={e.setAnimateSky} hint={reduced ? "Desactivado por tu sistema" : "Las nubes se desplazan despacio"} />
            <p className="basis-full text-xs text-foreground/65">El cielo, el sol y las nubes son ambiente: no se pueden seleccionar ni mover. En celulares y equipos modestos el cielo queda quieto para cuidar la batería.</p>
          </div>
        );
      case "vegetacion":
        return (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {TREE_KINDS.map((k) => (
                <button key={k.id} type="button" className={chip(e.placing === k.id)} aria-pressed={e.placing === k.id} onClick={() => e.setPlacing(e.placing === k.id ? null : (k.id as TreeKind))}>
                  <TreePine size={14} aria-hidden="true" />Agregar {k.name.toLowerCase()}
                </button>
              ))}
              {e.placing && <button type="button" className={chip(false)} onClick={() => e.setPlacing(null)}><Check size={14} aria-hidden="true" />Listo</button>}
            </div>
            {selected && (
              <div className="border border-primary/40 p-3">
                <p className="text-sm font-semibold text-foreground">{treeInfo(selected.kind).name} seleccionado</p>
                <p className="mt-1 text-xs text-foreground/65">Arrastralo en el visor o movelo de a 1 m con estos botones (según el frente de la casa).</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className={chip(false)} onClick={() => nudge(0, 1)}>Hacia el frente</button>
                  <button type="button" className={chip(false)} onClick={() => nudge(0, -1)}>Hacia el fondo</button>
                  <button type="button" className={chip(false)} onClick={() => nudge(-1, 0)}>A la izquierda</button>
                  <button type="button" className={chip(false)} onClick={() => nudge(1, 0)}>A la derecha</button>
                  <button type="button" className={chip(false)} onClick={() => e.remove(selected.id)}><X size={14} aria-hidden="true" />Quitar este</button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Switch label="Mostrar vegetación" on={e.showVegetation} onChange={e.setShowVegetation} />
              <button type="button" className={chip(false)} disabled={!e.trees.length} onClick={() => e.removeAll()}>Quitar toda la vegetación</button>
              <span className="text-xs text-foreground/65">{e.trees.length} {e.trees.length === 1 ? "ejemplar" : "ejemplares"}</span>
            </div>
            <p className="text-xs text-foreground/65">Vegetación ilustrativa para ambientar: no forma parte del presupuesto ni de la obra. No se guarda en el enlace para compartir.</p>
          </div>
        );
      case "iluminacion":
        return (
          <div className="flex flex-wrap items-end gap-4">
            <Switch label="Luces de la casa" on={e.houseLights} onChange={e.setHouseLights} hint="Se ven de noche en las ventanas" />
            <Slider label="Exposición" value={e.exposure} min={0.6} max={1.6} step={0.05} shown={`${Math.round(e.exposure * 100)} %`} onChange={e.setExposure} />
            <button type="button" className={chip(false)} disabled={e.exposure === 1} onClick={() => e.setExposure(1)}>Exposición normal</button>
          </div>
        );
      case "visualizacion": {
        const profile = PROFILES[fx.quality];
        const active = [eff.ao ? "sombras suaves en esquinas" : null, eff.bloom ? "brillo de luces" : null, eff.reflections ? "reflejos del cielo" : null, eff.cine ? "color y viñeta de cine" : null, eff.msaa > 0 ? "suavizado de bordes" : null].filter(Boolean);
        return (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {VIEWS.map((v) => (
                <button key={v.id} type="button" className={chip(view === v.id)} aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.name}</button>
              ))}
              <button type="button" className={chip(underHouse)} aria-pressed={underHouse} onClick={toggleUnder}>Ver bajo la casa</button>
              <button type="button" className={chip(false)} onClick={() => { e.reset(house); setOpen(null); }}>Restaurar el entorno</button>
            </div>
            <div role="group" aria-label="Calidad de render" className="border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Calidad de render</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUALITY_IDS.map((id) => (
                  <button key={id} type="button" data-quality={id} title={PROFILES[id].hint} className={chip(fx.quality === id)} aria-pressed={fx.quality === id} onClick={() => fx.setQuality(id)}>{PROFILES[id].label}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-foreground/65">{profile.hint}</p>
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <Switch label="Sombras suaves en esquinas" hint="Oclusión ambiental" on={fx.ao} disabled={!profile.ao} onChange={fx.setAo} />
                <Switch label="Brillo de luces" hint="Se nota en el sol y las ventanas" on={fx.bloom} disabled={!profile.bloom} onChange={fx.setBloom} />
                <Switch label="Reflejos del cielo" hint="Siguen la hora del día" on={fx.reflections} disabled={!profile.reflections} onChange={fx.setReflections} />
                <Switch label="Color y viñeta de cine" on={fx.cine} disabled={!profile.post} onChange={fx.setCine} />
                <Switch label="Ajuste automático" hint="Baja la calidad si el visor va lento" on={fx.auto} onChange={fx.setAuto} />
              </div>
              <p className="mt-2 text-xs text-foreground/80" data-testid="render-status">
                {fx.failed
                  ? `Los efectos están desactivados: ${fx.failed}`
                  : active.length
                    ? `Efectos activos: ${active.join(", ")}.`
                    : "Sin efectos de postproducción: render simple."}
              </p>
              {fx.failed && <button type="button" className={`${chip(false)} mt-2`} onClick={() => fx.retry()}>Reintentar los efectos</button>}
              <p className="mt-2 text-xs text-foreground/65">La captura 4K y el video usan esta misma calidad. En celulares y equipos modestos arranca en Económico para cuidar la batería.</p>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div ref={root} className="border-b border-border py-3" data-testid="entorno-toolbar">
      <div role="toolbar" aria-label="Herramientas del visor" className="flex gap-1 overflow-x-auto pb-1">
        {GROUPS.map(({ id, name, Icon }) => (
          <button
            key={id}
            type="button"
            data-group={id}
            aria-expanded={open === id}
            aria-controls={`${panelId}-${id}`}
            onClick={() => setOpen(open === id ? null : id)}
            className={`${chip(open === id)} shrink-0 whitespace-nowrap`}
          >
            <Icon size={15} aria-hidden="true" />
            {name}
          </button>
        ))}
      </div>
      {open && (
        <div id={`${panelId}-${open}`} role="region" aria-label={GROUPS.find((g) => g.id === open)?.name} className="fade-up mt-2 border border-border bg-background p-4">
          {panel(open)}
        </div>
      )}
      <p role="status" aria-live="polite" data-testid="entorno-notice" className={`mt-2 text-xs text-foreground/80 ${e.notice ? "" : "sr-only"}`}>{e.notice}</p>
      <p role="status" aria-live="polite" data-testid="render-notice" className={`mt-2 text-xs text-foreground/80 ${fx.notice ? "" : "sr-only"}`}>{fx.notice}</p>
    </div>
  );
}

const finishName = (id: string): string => CATEGORIES.find((c) => c.id === id)?.name ?? id;
