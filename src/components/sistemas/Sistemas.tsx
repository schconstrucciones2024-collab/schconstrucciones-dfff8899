import { lazy, Suspense, useEffect, useId, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { ArrowLeftRight, Eye, EyeOff, Focus, Layers3, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Reveal } from "@/lib/motion";
import { SectionHeading } from "@/components/home/SectionHeading";
import { SECTION_COPY, SYSTEMS, type LayerInfo, type OptionDef, type SystemId } from "@/config/wallSystems";
import { VIEWS, initialWallState, layersInUse, optionsOf, wallReducer, type Side } from "@/lib/wallState";

const WallViewer = lazy(() => import("./WallViewer"));

const SYSTEM_IDS: SystemId[] = ["woodframe", "tradicional"];
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-warm)]";

/** Texto corto con lo elegido en una pared (para la leyenda al comparar). */
function summarize(system: SystemId, options: Record<string, string>): string {
  return SYSTEMS[system].options
    .map((o) => o.values.find((v) => v.value === options[o.key])?.label)
    .filter(Boolean)
    .join(" · ");
}

function OptionGroup({ def, value, onPick }: { def: OptionDef; value: string; onPick: (v: string) => void }) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const n = def.values.length;
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + n) % n;
    onPick(def.values[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={id} className="mt-6 first:mt-0">
      <p id={id} className="text-[11px] font-semibold uppercase tracking-[0.22em] text-background/60">{def.label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {def.values.map((v, i) => {
          const on = v.value === value;
          return (
            <button
              key={v.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(v.value)}
              onKeyDown={(e) => move(e, i)}
              className={`min-h-11 border px-4 text-left text-sm transition-[background-color,color,border-color,transform] duration-300 active:scale-[0.98] ${focusRing} ${on ? "border-primary bg-primary text-primary-foreground" : "border-background/20 bg-transparent text-background/80 hover:border-primary hover:text-primary"}`}
            >
              {v.label}
              {v.hint && <span className={`ml-2 text-[10px] uppercase tracking-[0.16em] ${on ? "text-primary-foreground/80" : "text-background/50"}`}>{v.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LayerRow({ index, info, present, selected, hidden, onSelect, onToggle }: {
  index: number; info: LayerInfo; present: boolean; selected: boolean; hidden: boolean; onSelect: () => void; onToggle: () => void;
}) {
  return (
    <li className={`flex items-stretch border-b border-background/15 transition-colors duration-300 ${selected ? "bg-primary/10" : ""} ${present ? "" : "opacity-50"}`}>
      <button
        type="button"
        onClick={onSelect}
        disabled={!present}
        aria-pressed={selected}
        className={`flex min-h-12 flex-1 items-center gap-4 px-3 py-2.5 text-left ${focusRing} disabled:cursor-not-allowed`}
      >
        <span aria-hidden="true" className={`font-display text-sm font-semibold tabular-nums ${selected ? "text-primary" : "text-background/45"}`}>{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className={`block text-sm font-semibold leading-tight ${hidden ? "text-background/45 line-through" : ""}`}>{info.name}</span>
          <span className="mt-0.5 block text-xs leading-snug text-background/60">
            {present ? info.short : "No se incluye con esta opción"}
            {info.optional && present && <span className="ml-2 border border-primary/50 px-1.5 py-px text-[10px] uppercase tracking-[0.14em] text-primary">Opcional</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={!present}
        aria-pressed={hidden}
        aria-label={hidden ? `Mostrar ${info.name}` : `Ocultar ${info.name}`}
        title={hidden ? "Mostrar capa" : "Ocultar capa"}
        className={`flex min-h-12 w-12 shrink-0 items-center justify-center text-background/70 transition-colors hover:text-primary ${focusRing} disabled:cursor-not-allowed`}
      >
        {hidden ? <EyeOff aria-hidden="true" className="size-[18px]" /> : <Eye aria-hidden="true" className="size-[18px]" />}
      </button>
    </li>
  );
}

function InfoCard({ info }: { info: LayerInfo }) {
  const rows: [string, string][] = [["Qué es", info.description], ["Para qué sirve", info.role], ["Qué te aporta", info.benefit], ["Material", info.material], ["Textura", info.texture]];
  return (
    <div key={info.id + info.short} className="fade-up border border-primary/40 bg-background/[0.04] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Ficha de la capa</p>
      <h3 className="mt-2 font-display text-xl font-semibold leading-tight">{info.name}</h3>
      {info.optional && <p className="mt-2 text-sm font-medium text-primary">{info.optional}</p>}
      <dl className="mt-4 space-y-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-background/55">{k}</dt>
            <dd className="mt-0.5 text-sm leading-6 text-background/85">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Sistemas() {
  const [state, dispatch] = useReducer(wallReducer, undefined, () => initialWallState());
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [zoom, setZoom] = useState({ n: 0, factor: 1 });
  /** En pantallas táctiles el 3D arranca "bloqueado" para no atrapar el scroll de la página: se activa con un toque. */
  const [locked, setLocked] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  /** Si la persona ya tocó algún control del visor, no se la "ayuda" con la separación inicial. */
  const touched = useRef(false);
  const explodeNow = useRef(0);

  // El visor 3D (y sus texturas) se descarga recién cuando la sección está por aparecer.
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: "500px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = holder.current;
    if (!el || !window.matchMedia("(pointer: coarse)").matches) return;
    setLocked(true);
    // al sacar el visor de la pantalla se vuelve a bloquear
    const observer = new IntersectionObserver((entries) => { if (entries.every((e) => !e.isIntersecting)) setLocked(true); });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  explodeNow.current = state.explode;

  // Una sola vez, cuando el visor ya se ve entero, las capas se separan solas hasta la mitad para mostrar que se pueden
  // abrir. No toma el scroll de la página: si la persona toca algo o prefiere menos movimiento, no pasa nada.
  useEffect(() => {
    const el = holder.current;
    if (!near || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      timer = setTimeout(() => { if (!touched.current && explodeNow.current === 0) dispatch({ type: "explode", value: 0.55 }); }, 900);
    }, { threshold: 0.6 });
    observer.observe(el);
    return () => { observer.disconnect(); if (timer) clearTimeout(timer); };
  }, [near]);

  const def = SYSTEMS[state.system];
  const per = state.per[state.system];
  const editingOptions = optionsOf(state, state.compare ? state.editing : "A");
  const infos = useMemo(() => def.layers(editingOptions), [def, editingOptions]);
  const inUse = layersInUse(state);
  const selectedInfo = infos.find((l) => l.id === state.selected) ?? null;
  const optionsB = state.compare ? per.B : null;

  const onTabKey = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + SYSTEM_IDS.length) % SYSTEM_IDS.length;
    dispatch({ type: "system", system: SYSTEM_IDS[next]! });
    tabs.current[next]?.focus();
  };

  const ariaLabel = `Visor 3D interactivo de una pared ${def.label}${state.compare ? " (comparando dos alternativas)" : ""}. Cada capa se puede seleccionar, ocultar y separar. Las mismas funciones están disponibles en los controles de al lado.`;
  const dragHint = "Girá con el mouse o con el dedo · Acercá con la rueda o pellizcando · Tocá una capa para ver su ficha";

  return (
    <section id="sistemas" aria-labelledby="sistemas-title" className="surface-light scroll-mt-20">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal>
          <SectionHeading eyebrow={SECTION_COPY.eyebrow} title={SECTION_COPY.title} id="sistemas-title" />
          <p className="mt-8 max-w-3xl text-base leading-8 text-background/75 sm:text-lg">{SECTION_COPY.subtitle}</p>
        </Reveal>

        <Reveal delay={120} className="mt-14">
          <div role="tablist" aria-label="Sistema constructivo" className="grid gap-px border border-background/15 bg-background/15 sm:grid-cols-2">
            {SYSTEM_IDS.map((id, i) => {
              const on = state.system === id;
              return (
                <button
                  key={id}
                  ref={(el) => { tabs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`sistema-tab-${id}`}
                  aria-selected={on}
                  aria-controls="sistema-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => dispatch({ type: "system", system: id })}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`group relative min-h-[5.5rem] px-6 py-5 text-left transition-colors duration-500 ${focusRing} ${on ? "bg-background text-foreground" : "bg-[var(--color-warm)] text-background hover:bg-background/5"}`}
                >
                  <span className={`font-display text-2xl font-semibold leading-tight ${on ? "text-foreground" : ""}`}>{SYSTEMS[id].label}</span>
                  <span className={`mt-1 block text-sm ${on ? "text-foreground/70" : "text-background/65"}`}>{SYSTEMS[id].tagline}</span>
                  <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary transition-transform duration-500 ${on ? "scale-x-100" : "scale-x-0"}`} />
                </button>
              );
            })}
          </div>
        </Reveal>

        <div id="sistema-panel" role="tabpanel" aria-labelledby={`sistema-tab-${state.system}`} className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Visor */}
          <div className="min-w-0 lg:col-span-8">
            <div ref={holder} onPointerDownCapture={() => { touched.current = true; }} onKeyDownCapture={() => { touched.current = true; }} className="relative isolate flex flex-col overflow-hidden border border-background/15 bg-gradient-to-b from-[#f1eee6] to-[#d8d2c4] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.5)]">
              {/* Vistas y comparar: sobre el visor en pantallas grandes, arriba en celulares (así no tapan el modelo) */}
              <div className="order-1 flex min-w-0 flex-wrap items-start justify-between gap-2 p-3 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:z-10">
                <div role="group" aria-label="Vista de la cámara" className="flex min-w-0 max-w-full gap-px overflow-x-auto border border-background/20 bg-background/20 lg:pointer-events-auto lg:backdrop-blur-sm">
                  {VIEWS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={state.view === v.id}
                      onClick={() => { dispatch({ type: "view", view: v.id }); setResetKey((k) => k + 1); }}
                      className={`min-h-11 shrink-0 whitespace-nowrap px-3 text-xs font-medium transition-colors ${focusRing} ${state.view === v.id ? "bg-background text-foreground" : "bg-[#f1eee6]/90 text-background hover:text-primary"}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state.compare}
                  onClick={() => dispatch({ type: "compare", on: !state.compare })}
                  className={`inline-flex min-h-11 items-center gap-2 border px-3 text-xs font-medium transition-colors lg:pointer-events-auto lg:backdrop-blur-sm ${focusRing} ${state.compare ? "border-background bg-background text-foreground" : "border-background/20 bg-[#f1eee6]/90 text-background hover:text-primary"}`}
                >
                  <ArrowLeftRight aria-hidden="true" className="size-4" />
                  Comparar alternativas
                </button>
              </div>

              <div role="img" aria-label={ariaLabel} className="relative order-2 h-[46svh] min-h-[300px] w-full sm:h-[56svh] lg:h-[640px]">
                {failed ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-background">
                    <p className="max-w-md text-base leading-7">No pudimos iniciar el visor 3D en este dispositivo. Las capas, las opciones y las fichas de al lado siguen funcionando.</p>
                    <button type="button" onClick={() => { setFailed(false); setMountKey((k) => k + 1); }} className={`min-h-11 border border-background/30 px-5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary ${focusRing}`}>Reintentar</button>
                  </div>
                ) : (
                  <ClientOnly fallback={null}>
                    {near ? (
                      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-background/60">Cargando el visor 3D…</div>}>
                        <WallViewer
                          key={mountKey}
                          system={state.system}
                          optionsA={per.A}
                          optionsB={optionsB}
                          hidden={per.hidden}
                          selected={state.selected}
                          explode={state.explode}
                          view={state.view}
                          resetKey={resetKey}
                          zoom={zoom}
                          locked={locked}
                          onSelect={(id) => dispatch({ type: "select", id })}
                          onFail={() => setFailed(true)}
                        />
                      </Suspense>
                    ) : null}
                  </ClientOnly>
                )}
                {locked && near && !failed && (
                  <button type="button" onClick={() => setLocked(false)} className={`absolute inset-0 flex items-end justify-center bg-background/5 pb-6 text-sm font-semibold text-background ${focusRing}`}>
                    <span className="border border-background/30 bg-[#f1eee6]/95 px-5 py-3">Tocá para mover el modelo 3D</span>
                  </button>
                )}
              </div>

              {/* Acciones: separar capas, zoom y encuadre */}
              <div className="order-3 flex min-w-0 flex-wrap items-end justify-between gap-2 p-3 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-0 lg:z-10">
                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 lg:pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "toggleExplode" })}
                    className={`inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-background hover:text-foreground ${focusRing}`}
                  >
                    <Layers3 aria-hidden="true" className="size-4" />
                    {state.explode > 0.5 ? "Armar la pared" : "Separar las capas"}
                  </button>
                  <label className="flex min-h-11 min-w-0 max-w-full items-center gap-3 border border-background/20 bg-[#f1eee6]/90 px-3 text-xs font-medium text-background lg:backdrop-blur-sm">
                    <span>Separación</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(state.explode * 100)}
                      onChange={(e) => dispatch({ type: "explode", value: Number(e.target.value) / 100 })}
                      className={`h-1.5 w-20 min-w-0 cursor-pointer accent-primary sm:w-32 ${focusRing}`}
                    />
                  </label>
                </div>
                <div className="flex gap-px border border-background/20 bg-background/20 lg:pointer-events-auto lg:backdrop-blur-sm">
                  {[
                    { label: "Acercar", Icon: ZoomIn, factor: 0.8 },
                    { label: "Alejar", Icon: ZoomOut, factor: 1.25 },
                  ].map(({ label, Icon, factor }) => (
                    <button key={label} type="button" aria-label={label} title={label} onClick={() => setZoom((z) => ({ n: z.n + 1, factor }))} className={`flex size-11 items-center justify-center bg-[#f1eee6]/90 text-background transition-colors hover:text-primary ${focusRing}`}>
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </button>
                  ))}
                  <button type="button" aria-label="Volver a encuadrar" title="Volver a encuadrar" onClick={() => setResetKey((k) => k + 1)} className={`flex size-11 items-center justify-center bg-[#f1eee6]/90 text-background transition-colors hover:text-primary ${focusRing}`}>
                    <Focus aria-hidden="true" className="size-[18px]" />
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-6 text-background/60">{dragHint}</p>

            {state.compare && (
              <div className="fade-up mt-5 grid gap-px border border-background/15 bg-background/15 text-sm sm:grid-cols-2" aria-live="polite">
                {(["A", "B"] as Side[]).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={state.editing === side}
                    onClick={() => dispatch({ type: "editing", side })}
                    className={`px-4 py-3 text-left transition-colors ${focusRing} ${state.editing === side ? "bg-background text-foreground" : "bg-[var(--color-warm)] hover:bg-background/5"}`}
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Pared {side}{side === "A" ? " · a la izquierda" : " · a la derecha"}{state.editing === side ? " · editando con las opciones" : ""}</span>
                    <span className="mt-1 block leading-snug">{summarize(state.system, per[side])}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Opciones, capas y ficha */}
          <div className="min-w-0 lg:col-span-4">
            <div>
              {state.compare && (
                <p className="mb-5 border-l-2 border-primary pl-3 text-sm leading-6 text-background/75">
                  Las opciones modifican la <strong>pared {state.editing}</strong>. Elegí la otra en la leyenda de abajo del visor para cambiarla.
                </p>
              )}
              {def.options.map((o) => (
                <OptionGroup key={o.key} def={o} value={editingOptions[o.key] ?? o.initial} onPick={(value) => dispatch({ type: "option", key: o.key, value })} />
              ))}
            </div>

            <div className="mt-10">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-background/60">Capas, de adentro hacia afuera</h3>
                {per.hidden.length > 0 && (
                  <button type="button" onClick={() => dispatch({ type: "showAll" })} className={`text-xs font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`}>Mostrar todas</button>
                )}
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-background/45">Interior de la casa</p>
              <ol className="mt-1 border-t border-background/15">
                {infos.map((info, i) => (
                  <LayerRow
                    key={info.id}
                    index={i}
                    info={info}
                    present={inUse.includes(info.id)}
                    selected={state.selected === info.id}
                    hidden={per.hidden.includes(info.id)}
                    onSelect={() => dispatch({ type: "select", id: info.id })}
                    onToggle={() => dispatch({ type: "toggleLayer", id: info.id })}
                  />
                ))}
              </ol>
              <p className="mt-2 text-right text-[11px] uppercase tracking-[0.2em] text-background/45">Exterior</p>
            </div>

            <div className="mt-8" aria-live="polite">
              {selectedInfo ? <InfoCard info={selectedInfo} /> : (
                <p className="border border-dashed border-background/25 p-5 text-sm leading-6 text-background/65">Tocá una capa en el 3D o en la lista para ver qué es, para qué sirve, qué te aporta y de qué material está hecha.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => { dispatch({ type: "restore" }); setResetKey((k) => k + 1); }}
              className={`mt-8 inline-flex min-h-11 items-center gap-2 border border-background/25 px-4 text-sm font-semibold transition-colors hover:border-primary hover:text-primary ${focusRing}`}
            >
              <Undo2 aria-hidden="true" className="size-4" />
              Restaurar el original
            </button>
          </div>
        </div>

        <Reveal className="mt-20 border-t border-background/15 pt-12">
          <blockquote className="max-w-4xl font-display text-2xl font-medium leading-snug sm:text-3xl lg:text-4xl">{SECTION_COPY.quote}</blockquote>
          <p className="mt-8 max-w-3xl text-sm leading-7 text-background/60">{SECTION_COPY.disclaimer}</p>
        </Reveal>
      </div>
    </section>
  );
}
