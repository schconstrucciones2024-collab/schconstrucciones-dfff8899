import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Reveal } from "@/lib/motion";
import { LogisticsCalculator } from "./LogisticsCalculator";
import { CATEGORY_COLOR, SYSTEM_COLOR, tone } from "./palette";
import {
  AREA_MAX, AREA_MIN, SYSTEMS, EXCLUDED, createAreas, updateAreas, buildWhatsAppUrl,
  DEFAULT_LOGISTICS, buildSummary, clampArea, estimate, formatUSD, type CategoryId, type LogisticsSelection, type SystemId,
} from "@/lib/cotizador";

type Areas = Record<CategoryId, number>;

/** Nombre de la categoría con su color (el texto es el mismo que antes). */
function Named({ id, children }: { id: CategoryId; children: string }) {
  return <span style={tone(CATEGORY_COLOR[id])} className="font-semibold text-(--tone)">{children}</span>;
}

export function Cotizador() {
  // Keep #cotizar (and legacy #cotiza) anchored while content above (3D designer) loads and shifts layout.
  useEffect(() => {
    let timers: number[] = [];
    const follow = () => {
      timers.forEach(clearTimeout);
      timers = [];
      const h = window.location.hash;
      if (h !== "#cotizar" && h !== "#cotiza") return;
      if (h === "#cotiza") history.replaceState(null, "", "#cotizar");
      const go = () => document.getElementById("cotizar")?.scrollIntoView({ block: "start" });
      go();
      timers = [150, 500, 1200, 2500].map((ms) => window.setTimeout(go, ms));
    };
    follow();
    window.addEventListener("hashchange", follow);
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    return () => {
      stop();
      window.removeEventListener("hashchange", follow);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, []);
  const [areas, setAreas] = useState<Areas>(createAreas);
  const [system, setSystem] = useState<SystemId>("woodframe");
  const [syncBySystem, setSyncBySystem] = useState({ woodframe: false, tradicional: false });
  const sync = syncBySystem[system];
  const config = SYSTEMS[system];
  const categories = config.categories;
  const categoryNames = categories.map((c) => c.name).join(" · ");
  const [logistics, setLogistics] = useState<LogisticsSelection>(DEFAULT_LOGISTICS);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [fallback, setFallback] = useState("");

  const setArea = (id: CategoryId, v: number) => {
    setAreas((prev) => updateAreas(prev, system, id, v, sync));
    setCopyState("idle"); setFallback("");
  };
  const toggleSync = (on: boolean) => {
    setSyncBySystem((prev) => ({ ...prev, [system]: on }));
    const first = categories[0];
    if (on && first) setAreas((prev) => updateAreas(prev, system, first.id, prev[first.id], true));
    setCopyState("idle"); setFallback("");
  };
  const copy = async (categoryId?: CategoryId) => {
    const text = buildSummary(areas, logistics, system, categoryId);
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setCopyState("ok"); setFallback("");
    } catch {
      setCopyState("fail"); setFallback(text);
    }
  };
  const equal = categories.every((c) => areas[c.id] === areas[categories[0]?.id ?? "rustica"]);
  const valueFor = (id: CategoryId) => estimate(areas[id], categories.find((category) => category.id === id)?.price ?? 0);
  const r = valueFor("rustica"), m = valueFor("moderna"), w = valueFor("allwood");
  const maxValue = Math.max(1, ...categories.map((c) => valueFor(c.id)));

  return (
    <section id="cotizar" className="scroll-mt-20 bg-background" aria-labelledby="cotiza-title">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <p className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs"><span aria-hidden="true" className="h-px w-10 shrink-0 bg-primary" />Cotizá tu casa · Cotizador interactivo · Valores en USD</p>
        <h2 id="cotiza-title" className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-foreground sm:text-5xl lg:text-6xl">TU PROYECTO. TU SUPERFICIE. TU INVERSIÓN.</h2>
        <p className="mt-6 max-w-3xl text-lg text-foreground/75">Calculá el costo estimado de tu futura vivienda y compará nuestras {config.count} alternativas de construcción.</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground/55">Elegí los metros cuadrados que necesitás, explorá nuestras categorías y descubrí el valor estimado de tu proyecto con SCH CONSTRUCCIONES.</p>

        <Tabs value={system} onValueChange={(value) => { if (value === "woodframe" || value === "tradicional") { setSystem(value); setCopyState("idle"); setFallback(""); } }} className="mt-10">
          <TabsList aria-label="Sistema de construcción" className="grid h-auto w-full grid-cols-2 rounded-sm border border-border bg-card p-1 sm:w-fit">
            {(["woodframe", "tradicional"] as const).map((id) => (
              <TabsTrigger key={id} value={id} style={tone(SYSTEM_COLOR[id])} className="group min-h-12 min-w-0 gap-2 whitespace-normal rounded-sm px-3 text-sm text-foreground/75 transition-[background-color,color] duration-300 hover:text-foreground data-[state=active]:bg-(--tone) data-[state=active]:text-background sm:px-6">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--tone) transition-colors duration-300 group-data-[state=active]:bg-background" />
                {SYSTEMS[id].name}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={system} className="mt-0">
        <label className={`mt-8 flex cursor-pointer items-center gap-3 border p-4 text-sm text-foreground transition-[background-color,border-color] duration-300 sm:inline-flex ${sync ? "border-primary bg-primary/10" : "border-primary/30 bg-card hover:border-primary/60"}`}>
          <input type="checkbox" checked={sync} onChange={(e) => toggleSync(e.target.checked)} className="h-5 w-5 accent-primary" />
          COMPARAR LAS {config.count.toUpperCase()} OPCIONES CON LOS MISMOS m²
        </label>

        <div key={system} className={`fade-up mt-8 grid gap-5 ${system === "woodframe" ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {categories.map((c, i) => (
            <Reveal key={c.id} delay={i * 90} className="flex">
            <CategoryCard id={c.id} name={c.name} description={c.description} price={c.price} interior={c.interior} area={areas[c.id]} onChange={(v) => setArea(c.id, v)} materialsLabel={config.materialsLabel} onCopy={() => copy(c.id)} whatsappUrl={buildWhatsAppUrl(areas, logistics, system, c.id)} />
            </Reveal>
          ))}
        </div>

        {system === "woodframe" && <p className="mt-5 border border-border bg-card px-5 py-4 text-sm leading-6 text-foreground/75">
          <span className="font-semibold text-foreground">Revestimiento exterior:</span> las tres categorías llevan siding, modificable según el proyecto del cliente.
        </p>}


        <div className="mt-16">
          <h3 className="text-2xl font-semibold text-foreground">COMPARÁ TU INVERSIÓN</h3>
          <div className="mt-6">
            <table className="w-full text-left text-sm">
              <thead className="hidden text-xs uppercase tracking-[0.15em] text-foreground/50 sm:table-header-group"><tr><th className="py-3 pr-4">Categoría</th><th className="py-3 pr-4">Precio por m²</th><th className="py-3 pr-4">Superficie</th><th className="py-3 text-right">Inversión estimada</th></tr></thead>
              <tbody>{categories.map((c) => (
                <tr key={c.id} style={tone(CATEGORY_COLOR[c.id])} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-t border-border py-4 text-foreground sm:table-row sm:py-0"><td className="col-span-2 pb-2 font-semibold sm:py-4 sm:pr-4"><span aria-hidden="true" className="mr-3 inline-block size-2.5 rounded-full bg-(--tone) align-baseline" />{c.name}</td><td className="py-1 sm:py-4 sm:pr-4">USD {c.price}/m²</td><td className="py-1 text-right sm:py-4 sm:pr-4 sm:text-left">{areas[c.id]} m²</td><td className="col-span-2 pt-2 font-semibold text-(--tone) sm:py-4 sm:text-right"><span className="mr-2 font-normal text-foreground/75 sm:hidden">Inversión estimada</span><span key={valueFor(c.id)} className="tone-tick inline-block">{formatUSD(estimate(areas[c.id], c.price))}</span><span aria-hidden="true" className="mt-2 block h-1 overflow-hidden bg-foreground/10 sm:ml-auto sm:w-56"><span className="block h-full origin-left bg-(--tone) transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${valueFor(c.id) / maxValue})` }} /></span></td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-6 text-sm leading-7 text-foreground/70" aria-live="polite">
            {equal ? (
              <ul className="space-y-1">
                {system === "woodframe" ? <>
                <li><Named id="moderna">MODERNA</Named> cuesta {formatUSD(m - r)} más que <Named id="rustica">RÚSTICA</Named>.</li>
                <li><Named id="allwood">ALLWOOD</Named> cuesta {formatUSD(w - m)} más que <Named id="moderna">MODERNA</Named>.</li>
                <li><Named id="allwood">ALLWOOD</Named> cuesta {formatUSD(w - r)} más que <Named id="rustica">RÚSTICA</Named>.</li>
                </> : <li><Named id="clasica">CLÁSICA</Named> cuesta {formatUSD(valueFor("clasica") - valueFor("esencial"))} más que <Named id="esencial">ESENCIAL</Named>.</li>}
              </ul>
            ) : (
              <p>Las superficies seleccionadas son distintas, por lo que las diferencias de inversión no se deben solo a la categoría. Activá “Comparar las {config.count} opciones con los mismos m²” para ver la diferencia entre tarifas.</p>
            )}
          </div>
        </div>

        <LogisticsCalculator categories={categories} areas={areas} selection={logistics} onChange={(next) => { setLogistics(next); setCopyState("idle"); setFallback(""); }} />

        <div className="mt-16 grid gap-5 md:grid-cols-2">
          <div className="border border-primary/30 bg-card p-6 sm:p-8">
            <h3 className="text-xl font-semibold text-foreground">¿QUÉ INCLUYE TU PROYECTO CON SCH?</h3>
            <p className="mt-3 text-sm text-foreground/60">Las {config.count} categorías comparten las siguientes prestaciones incluidas en el precio base.</p>
            <ul className="mt-6 space-y-3">{config.included.map((t) => <li key={t} className="flex gap-3 text-sm text-foreground/85"><Check size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{t} <span className="sr-only">Incluido en {categoryNames}.</span></li>)}</ul>
            <p className="mt-5 text-xs text-foreground/50">Incluido en {categoryNames}</p>
          </div>
          <div className="border border-border bg-card p-6 sm:p-8">
            <h3 className="text-xl font-semibold text-foreground">ELEMENTOS NO INCLUIDOS EN EL PRECIO BASE</h3>
            <p className="mt-3 text-sm text-foreground/60">Para que puedas planificar tu inversión con transparencia, estos elementos no están incluidos en ninguna de nuestras {config.count} categorías y deben evaluarse por separado.</p>
            <ul className="mt-6 grid grid-cols-2 gap-3">{EXCLUDED.map((t) => <li key={t} className="flex gap-3 text-sm text-foreground/85"><X size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{t}</li>)}</ul>
          </div>
        </div>

        <div className="mt-10">
          <Button variant="ghost" type="button" onClick={() => copy()} className="inline-flex h-auto min-h-11 w-full whitespace-normal rounded-none items-center justify-center gap-2 border border-primary px-6 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto">
            <Copy size={16} aria-hidden="true" /> COPIAR RESUMEN DE MI COTIZACIÓN
          </Button>
          <p role="status" className="mt-3 min-h-5 text-sm text-foreground/75">{copyState === "ok" ? "Resumen copiado al portapapeles." : copyState === "fail" ? "No se pudo copiar automáticamente. Seleccioná el texto de abajo para copiarlo o reintentá." : ""}</p>
          {copyState === "fail" && (
            <div className="mt-2">
              <label htmlFor="resumen-cotizacion" className="text-xs uppercase tracking-[0.15em] text-foreground/50">Resumen de cotización</label>
              <textarea id="resumen-cotizacion" readOnly value={fallback} rows={12} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full border border-border bg-card p-4 text-sm text-foreground" />
              <Button variant="ghost" type="button" onClick={() => copy()} className="mt-2 min-h-11 text-sm text-primary underline">Reintentar copia</Button>
            </div>
          )}
        </div>

        <div className="mt-16 border border-primary/40 bg-card p-8 text-center sm:p-12">
          <h3 className="text-3xl font-semibold text-foreground">¿LISTO PARA HACER REALIDAD TU PROYECTO?</h3>
          <p className="mx-auto mt-4 max-w-2xl text-foreground/70">Ya conocés el valor estimado de tu futura vivienda.</p>
          <p className="mx-auto mt-2 max-w-2xl text-foreground/70">El próximo paso es conversar con SCH CONSTRUCCIONES para evaluar los detalles de tu proyecto y solicitar un presupuesto personalizado.</p>
          <a href={buildWhatsAppUrl(areas, logistics, system)} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex w-full items-center justify-center gap-2 bg-whatsapp px-7 py-4 text-sm font-semibold text-background sm:w-auto">
            <MessageCircle size={18} aria-hidden="true" /> SOLICITAR PRESUPUESTO POR WHATSAPP
          </a>
        </div>

          </TabsContent>
        </Tabs>
        <div className="mt-12 border-t border-border pt-8 text-sm text-foreground/60">
          <p className="font-semibold text-foreground">SCH CONSTRUCCIONES</p>
          <p className="mt-1 text-primary">Construimos confianza. Edificamos futuro.</p>
          <p className="mt-1">Punta del Diablo · Rocha · Uruguay</p>
          <p className="mt-4 max-w-4xl text-xs leading-6">“Los importes mostrados son estimaciones calculadas según la superficie seleccionada y la tarifa por metro cuadrado de cada categoría. El presupuesto definitivo deberá ser confirmado por SCH CONSTRUCCIONES según las características, los requerimientos y el alcance específico de cada proyecto.” Los elementos no incluidos deben evaluarse y presupuestarse por separado.</p>
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ id, name, description, price, interior, area, onChange, onCopy, materialsLabel, whatsappUrl }: { id: CategoryId; name: string; description: string; price: number; interior: string; area: number; onChange: (v: number) => void; onCopy: () => void; materialsLabel: string; whatsappUrl: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && (draft.trim() === "" || !Number.isFinite(Number(draft)) || Number(draft) < AREA_MIN || Number(draft) > AREA_MAX);
  const commit = () => { if (draft !== null) { onChange(clampArea(draft === "" ? area : draft)); setDraft(null); } };
  const inputId = `area-${id}`;
  return (
    <article style={tone(CATEGORY_COLOR[id])} className="tone-card flex w-full flex-col bg-card p-6 sm:p-7">
      <h3 className="flex items-center gap-3 text-2xl font-semibold tracking-wide text-foreground"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-(--tone) shadow-[0_0_0_5px_color-mix(in_oklab,var(--tone)_22%,transparent)]" />{name}</h3>
      <p className="mt-3 min-h-[72px] text-sm leading-6 text-foreground/60">{description}</p>

      <p className="mt-6 text-xs uppercase tracking-[0.15em] text-foreground/50">{materialsLabel}</p>
      <p className="mt-2 min-h-[144px] text-sm leading-6 text-foreground/85">{interior}</p>


      <p className="mt-6 text-xs uppercase tracking-[0.15em] text-foreground/50">Precio por metro cuadrado</p>
      <p className="mt-1 text-lg font-semibold text-foreground">USD {price}/m²</p>


      <label htmlFor={inputId} className="mt-6 text-xs uppercase tracking-[0.15em] text-foreground/50">Superficie de tu proyecto</label>
      <div className="mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <Button variant="ghost" type="button" aria-label={`Reducir superficie de ${name}`} onClick={() => onChange(area - 1)} disabled={area <= AREA_MIN} className="grid h-11 w-11 rounded-none p-0 place-items-center border border-border text-foreground transition-[border-color,color,transform] duration-200 hover:border-(--tone) hover:text-(--tone) active:scale-95 disabled:cursor-not-allowed disabled:border-dashed disabled:text-foreground/30 disabled:opacity-60 disabled:hover:border-border disabled:hover:text-foreground/30 focus-visible:outline-2 focus-visible:outline-(--tone)"><Minus size={16} /></Button>
        <div className="relative flex-1">
          <input id={inputId} type="number" inputMode="numeric" min={AREA_MIN} max={AREA_MAX} step={1} value={draft ?? area}
            onChange={(e) => { const v = e.target.value; setDraft(v); const n = Number(v); if (v !== "" && Number.isInteger(n) && n >= AREA_MIN && n <= AREA_MAX) onChange(n); }}
            onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
            aria-invalid={invalid} aria-describedby={`${inputId}-hint`}
            className="h-11 w-full border border-border bg-background px-3 pr-10 text-center text-lg font-semibold text-foreground focus:border-(--tone) focus:outline-none" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground/50">m²</span>
        </div>
        <Button variant="ghost" type="button" aria-label={`Aumentar superficie de ${name}`} onClick={() => onChange(area + 1)} disabled={area >= AREA_MAX} className="grid h-11 w-11 rounded-none p-0 place-items-center border border-border text-foreground transition-[border-color,color,transform] duration-200 hover:border-(--tone) hover:text-(--tone) active:scale-95 disabled:cursor-not-allowed disabled:border-dashed disabled:text-foreground/30 disabled:opacity-60 disabled:hover:border-border disabled:hover:text-foreground/30 focus-visible:outline-2 focus-visible:outline-(--tone)"><Plus size={16} /></Button>
      </div>
      <p id={`${inputId}-hint`} className={`mt-2 text-xs ${invalid ? "text-destructive" : "text-foreground/40"}`}>{invalid ? `Ingresá un número entre ${AREA_MIN} y ${AREA_MAX} m².` : `Entre ${AREA_MIN} y ${AREA_MAX} m².`}</p>
      <input type="range" min={AREA_MIN} max={AREA_MAX} step={1} value={area} onChange={(e) => { setDraft(null); onChange(Number(e.target.value)); }} aria-label={`Superficie de ${name} en m²`} className="mt-4 h-11 w-full cursor-pointer accent-(--tone)" />

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs uppercase tracking-[0.15em] text-foreground/50">Inversión estimada · {area} m²</p>
        <p className="mt-1 text-3xl font-semibold text-(--tone) sm:text-4xl" aria-live="polite"><span key={estimate(area, price)} className="tone-tick inline-block">{formatUSD(estimate(area, price))}</span></p>
      </div>
      <div className="mt-6 grid gap-2">
        <Button variant="ghost" type="button" onClick={onCopy} className="inline-flex h-auto min-h-11 rounded-none items-center justify-center gap-2 border border-border px-4 py-3 text-xs font-semibold text-foreground transition-colors hover:border-(--tone) hover:text-(--tone)"><Copy size={14} aria-hidden="true" /> Copiar cotización</Button>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-whatsapp px-4 py-3 text-xs font-semibold text-background"><MessageCircle size={14} aria-hidden="true" /> CONSULTAR ESTA OPCIÓN</a>
      </div>
    </article>
  );
}
