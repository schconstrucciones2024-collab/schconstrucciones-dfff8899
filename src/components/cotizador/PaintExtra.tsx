import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Eye } from "lucide-react";
import type { FinishId } from "@/config/materials";
import {
  EXTERIOR_SWATCHES,
  INTERIOR_SWATCHES,
  PAINT_COATS,
  PAINT_DESDE_USD,
  PAINT_NO_INCLUYE,
  PAINT_TARIFFS,
  PAINT_TEXTOS,
  PAINT_ZONES,
  WOOD_STAINS,
  coatsLabel,
  colorName,
  colorText,
  formatRate,
  formatUyu,
  hexToRgb,
  isLight,
  normalizeHex,
  paintLineName,
  paintRateUsd,
  paintTarget,
  rgbToHex,
  woodStain,
  type PaintConfig,
  type PaintCoats,
  type PaintSurfaces,
  type PaintSystemId,
  type PaintZone,
  type Swatch,
  type WoodStainId,
} from "@/config/paint";
import { formatUSD, paintCounts, paintExtra, type LogisticsSelection } from "@/lib/cotizador";
import { Check3, Disclosure, List, Row, ToggleRow } from "./DeckExtra";

/** Una opción de presupuesto cuya pintura se cotiza: en el cotizador son todas las de la página; en el diseñador, la del diseño. */
export type PaintOption = {
  finish: FinishId;
  name: string;
  /** m² de pared (estimados en el cotizador, medidos sobre el diseño en el diseñador). */
  surfaces: PaintSurfaces;
  /** Color de la opción (variable CSS `--tone`), solo en el cotizador. */
  tone?: CSSProperties;
};

const m2 = (n: number) => `${Math.round(n)} m²`;
const unique = <T,>(items: T[]) => [...new Set(items)];

/** Sistemas de precio de las opciones, en las caras que se indican. */
function systemsOf(options: PaintOption[], zones: readonly PaintZone[]): PaintSystemId[] {
  return unique(
    options.flatMap((o) =>
      zones.flatMap((z) => {
        const system = paintTarget(o.finish, z).system;
        return system ? [system] : [];
      }),
    ),
  );
}

/** «Siding (acrílico exterior)»: qué se pinta en una cara y con qué producto, agrupando las opciones que coinciden. */
function describeZone(options: PaintOption[], zone: PaintZone) {
  const groups = new Map<string, string[]>();
  for (const o of options) {
    const t = paintTarget(o.finish, zone);
    const text = t.system
      ? `${paintLineName({ zone, system: t.system, sustrato: t.sustrato }).replace(/^(Exterior|Interior) · /, "")}`
      : t.sustrato.toLowerCase();
    groups.set(text, [...(groups.get(text) ?? []), o.name]);
  }
  return [...groups.entries()].map(([text, names]) => ({ text, names }));
}
const upper1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Opción «Pintura (opcional)». La usan el cotizador (`variant="page"`, con la superficie estimada de cada opción) y el paso
 * «Extras y opcionales» del diseñador 3D (`variant="panel"`, con la superficie medida sobre el diseño y los colores en vivo
 * sobre la casa). Los precios, textos y colores salen de `src/config/paint.ts`.
 */
export function PaintPanel({
  paint,
  onChange,
  logistics,
  options,
  variant,
  idPrefix,
  nota,
  onLook,
  children,
}: {
  paint: PaintConfig;
  onChange: (patch: Partial<PaintConfig>) => void;
  logistics: LogisticsSelection;
  options: PaintOption[];
  variant: "page" | "panel";
  idPrefix: string;
  /** De dónde sale la superficie (estimada o medida). */
  nota: string;
  /** Diseñador: botones para mirar la casa por fuera o por dentro y ver el color elegido. */
  onLook?: (zone: PaintZone) => void;
  /** Lo que va entre el precio del extra y los desplegables (en el cotizador, el resumen por categoría). */
  children?: ReactNode;
}) {
  const page = variant === "page",
    systems = systemsOf(options, PAINT_ZONES.filter((z) => paint[z])),
    allSystems = systemsOf(options, PAINT_ZONES),
    // Hay paredes elegidas que no están en la lista de precios (construcción tradicional): se cotizan aparte.
    pending = options.some((o) => PAINT_ZONES.some((z) => paint[z] && paintTarget(o.finish, z).system === null)),
    has = (zone: PaintZone, kind: "color" | "madera") => paint[zone] && options.some((o) => paintTarget(o.finish, zone).kind === kind),
    single = options.length === 1 ? options[0] : undefined;
  return (
    <section aria-labelledby={`${idPrefix}-title`}>
      <h4 id={`${idPrefix}-title`} className="sr-only">
        {PAINT_TEXTOS.titulo}
      </h4>
      <p className="text-xs leading-5 text-foreground/70">{PAINT_TEXTOS.subtitulo}</p>
      <p
        role="note"
        className="mt-4 border border-primary/30 bg-primary/5 px-4 py-3 text-xs font-medium leading-5 text-foreground sm:text-sm"
      >
        {PAINT_TEXTOS.aviso}
      </p>

      <div className={page ? "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" : "mt-4 space-y-4"}>
        <div className="min-w-0 space-y-3">
          <ToggleRow
            id={`${idPrefix}-pintura`}
            label={PAINT_TEXTOS.agregar}
            description={PAINT_TEXTOS.agregarDescripcion}
            hint={`Desde ${formatRate(PAINT_DESDE_USD)}/m² con ${coatsLabel(2)}, mano de obra y materiales incluidos.`}
            checked={paint.enabled}
            onChange={(on) => onChange({ enabled: on })}
          />

          {paint.enabled && (
            <div className="space-y-6 border border-border bg-card p-4 sm:p-5">
              <fieldset className="min-w-0">
                <legend className="text-xs uppercase tracking-[0.15em] text-foreground/60">{PAINT_TEXTOS.dondeTitulo}</legend>
                <div className={`mt-2 grid gap-2 ${page ? "sm:grid-cols-2" : ""}`}>
                  {PAINT_ZONES.map((zone) => (
                    <ZoneCard
                      key={zone}
                      id={`${idPrefix}-${zone}`}
                      zone={zone}
                      checked={paint[zone]}
                      onChange={(on) => onChange(zone === "exterior" ? { exterior: on } : { interior: on })}
                      groups={describeZone(options, zone)}
                      single={single}
                      paint={paint}
                    />
                  ))}
                </div>
                {!paint.exterior && !paint.interior && (
                  <p role="status" className="mt-2 text-xs text-destructive">
                    Elegí al menos una superficie para calcular la pintura.
                  </p>
                )}
              </fieldset>

              <CoatsSelector
                idPrefix={idPrefix}
                value={paint.coats}
                onChange={(coats) => onChange({ coats })}
                systems={systems.length > 0 ? systems : allSystems}
              />

              {(paint.exterior || paint.interior) && (
                <div className="space-y-5 border-t border-border pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h5 className="text-xs uppercase tracking-[0.15em] text-foreground/60">{PAINT_TEXTOS.colorTitulo}</h5>
                    {onLook && (
                      <div className="flex gap-2">
                        {PAINT_ZONES.filter((z) => paint[z]).map((z) => (
                          <button
                            key={z}
                            type="button"
                            onClick={() => onLook(z)}
                            className="inline-flex min-h-11 items-center gap-2 border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <Eye size={14} aria-hidden="true" />
                            Ver {z === "exterior" ? "el exterior" : "el interior"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* En el diseñador el color se ve sobre la casa en 3D: ahí el dibujo sobra. */}
                  {!onLook && <PaintPreview paint={paint} options={options} />}

                  {paint.exterior && (
                    <ColorField
                      id={`${idPrefix}-color-ext`}
                      zone="exterior"
                      label={PAINT_TEXTOS.colorExterior}
                      hint={`${upper1(describeZone(options, "exterior").map((g) => g.text).join(" · "))}.`}
                      value={paint.exteriorColor}
                      swatches={EXTERIOR_SWATCHES}
                      wide={page}
                      onChange={(exteriorColor) => onChange({ exteriorColor })}
                    />
                  )}
                  {has("interior", "color") && (
                    <ColorField
                      id={`${idPrefix}-color-int`}
                      zone="interior"
                      label={PAINT_TEXTOS.colorInterior}
                      hint={`${upper1(
                        describeZone(options.filter((o) => paintTarget(o.finish, "interior").kind === "color"), "interior")
                          .map((g) => (options.length > 1 ? `${g.names.join(", ")}: ${g.text}` : g.text))
                          .join(" · "),
                      )}.`}
                      value={paint.interiorColor}
                      swatches={INTERIOR_SWATCHES}
                      wide={page}
                      onChange={(interiorColor) => onChange({ interiorColor })}
                    />
                  )}
                  {has("interior", "madera") && (
                    <WoodStainPicker
                      idPrefix={idPrefix}
                      value={paint.woodColor}
                      onChange={(woodColor) => onChange({ woodColor })}
                      names={options.length > 1 ? options.filter((o) => paintTarget(o.finish, "interior").kind === "madera").map((o) => o.name) : []}
                    />
                  )}
                  <p className="text-[11px] leading-5 text-foreground/60">{PAINT_TEXTOS.colorAyuda}</p>
                </div>
              )}
              {pending && (
                <p role="note" className="border border-border bg-background px-4 py-3 text-xs leading-5 text-foreground/80">
                  {PAINT_TEXTOS.revoque}
                </p>
              )}
            </div>
          )}
        </div>

        <PriceBlock paint={paint} options={options} logistics={logistics} nota={nota} />
      </div>

      {children}

      <div className="mt-6 space-y-2">
        <Disclosure title={PAINT_TEXTOS.incluyeTitulo}>
          <PriceTables systems={allSystems} coats={paint.coats} />
          <p className="mt-4 text-xs leading-5 text-foreground/70">{PAINT_TEXTOS.comoSeCalcula}</p>
        </Disclosure>
        <Disclosure title={PAINT_TEXTOS.noIncluyeTitulo}>
          <List items={PAINT_NO_INCLUYE} icon="x" />
          <p className="mt-3 text-xs text-foreground/60">{PAINT_TEXTOS.noIncluyeNota}</p>
        </Disclosure>
      </div>
    </section>
  );
}

/* ─────────────────────────── Qué se pinta ─────────────────────────── */

function ZoneCard({
  id,
  zone,
  checked,
  onChange,
  groups,
  single,
  paint,
}: {
  id: string;
  zone: PaintZone;
  checked: boolean;
  onChange: (on: boolean) => void;
  groups: { text: string; names: string[] }[];
  single?: PaintOption;
  paint: PaintConfig;
}) {
  const target = single ? paintTarget(single.finish, zone) : null,
    rate = target?.system ? paintRateUsd(target.system, paint.coats) : null;
  return (
    <div className={`border p-3 transition-colors ${checked ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
      <Check3 id={id} label={zone === "exterior" ? PAINT_TEXTOS.exterior : PAINT_TEXTOS.interior} checked={checked} onChange={onChange} />
      <ul className="ml-8 space-y-0.5 text-xs leading-5 text-foreground/70">
        {groups.map((g) => (
          <li key={g.text}>
            {groups.length > 1 ? (
              <>
                <span className="font-semibold text-foreground/85">{g.names.join(", ")}:</span> {g.text}
              </>
            ) : (
              upper1(g.text)
            )}
          </li>
        ))}
      </ul>
      {single && checked && (
        <p className="ml-8 mt-1 text-xs font-medium text-foreground/70">
          {m2(single.surfaces[zone])}
          {rate !== null ? ` · ${formatRate(rate)}/m²` : ` · ${PAINT_TEXTOS.aCotizar}`}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────── Manos ─────────────────────────── */

function CoatsSelector({
  idPrefix,
  value,
  onChange,
  systems,
}: {
  idPrefix: string;
  value: PaintCoats;
  onChange: (coats: PaintCoats) => void;
  systems: PaintSystemId[];
}) {
  const rateText = (coats: PaintCoats) => {
    if (systems.length === 0) return PAINT_TEXTOS.aCotizar;
    const rates = systems.map((s) => paintRateUsd(s, coats)),
      lo = Math.min(...rates),
      hi = Math.max(...rates);
    return lo === hi ? `${formatRate(lo)}/m²` : `${formatRate(lo)} a ${formatRate(hi).replace("USD ", "")}/m²`;
  };
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs uppercase tracking-[0.15em] text-foreground/60">{PAINT_TEXTOS.manosTitulo}</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PAINT_COATS.map((n) => {
          const id = `${idPrefix}-manos-${n}`;
          return (
            <label key={n} htmlFor={id} className="block cursor-pointer">
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-manos`}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="peer sr-only"
              />
              <span className="flex h-full min-h-[5.25rem] flex-col items-center justify-center gap-0.5 border border-border bg-background px-1 py-3 text-center transition-colors hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                <span className="text-sm font-semibold text-foreground">{coatsLabel(n)}</span>
                <span className="text-[11px] font-medium leading-4 text-foreground/65">{rateText(n)}</span>
                {n === 2 && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">{PAINT_TEXTOS.manosDefecto}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-foreground/60">{PAINT_TEXTOS.manosAyuda}</p>
    </fieldset>
  );
}

/* ─────────────────────────── Color (selector RGB) ─────────────────────────── */

const CHANNELS = [
  { name: "R", label: "Rojo", accent: "#e5484d" },
  { name: "G", label: "Verde", accent: "#30a46c" },
  { name: "B", label: "Azul", accent: "#3e63dd" },
] as const;

/**
 * Elección de un color: muestras para arrancar y, abajo, el selector RGB (el color del sistema, tres controles y el código).
 * El cambio se ve enseguida en la vista previa y, en el diseñador, sobre la casa en 3D.
 */
function ColorField({
  id,
  zone,
  label,
  hint,
  value,
  swatches,
  wide,
  onChange,
}: {
  id: string;
  zone: PaintZone;
  label: string;
  hint: string;
  value: string;
  swatches: readonly Swatch[];
  /** En la página hay lugar para las diez muestras en una fila; en el panel del diseñador, de a cinco. */
  wide: boolean;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const rgb = hexToRgb(value),
    selected = normalizeHex(value);
  const setChannel = (i: number, raw: number) => {
    const next = [...rgb];
    next[i] = Math.min(255, Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0)));
    onChange(rgbToHex(next[0] ?? 0, next[1] ?? 0, next[2] ?? 0));
  };
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-12 shrink-0 border border-border shadow-inner"
          style={{ backgroundColor: value }}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-foreground/70" aria-live="polite">
            {colorName(value, zone)} · {colorText(value)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-foreground/60">{hint}</p>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/55">{PAINT_TEXTOS.paletaTitulo}</p>
      <div className={`mt-2 grid grid-cols-5 gap-2 ${wide ? "sm:grid-cols-10" : ""}`}>
        {swatches.map((s) => {
          const on = selected === s.hex;
          return (
            <button
              key={s.hex}
              type="button"
              aria-pressed={on}
              aria-label={`${s.nombre} (${s.hex.toUpperCase()})`}
              title={s.nombre}
              onClick={() => onChange(s.hex)}
              style={{ backgroundColor: s.hex }}
              className={`relative grid h-11 w-full place-items-center border transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-card" : "border-border"
              }`}
            >
              {on && <Check size={16} aria-hidden="true" className={isLight(s.hex) ? "text-black/70" : "text-white"} />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border border-border bg-background p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/55">{PAINT_TEXTOS.rgbTitulo}</p>
        <div className="mt-2 flex items-center gap-3">
          <label htmlFor={`${id}-picker`} className="sr-only">
            {`${label}: abrir el selector de color`}
          </label>
          <input
            id={`${id}-picker`}
            type="color"
            value={value}
            onChange={(e) => {
              const n = normalizeHex(e.target.value);
              if (n) onChange(n);
            }}
            className="h-11 w-14 shrink-0 cursor-pointer border border-border bg-background p-1"
          />
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-hex`} className="block text-[11px] text-foreground/60">
              Código
            </label>
            <input
              id={`${id}-hex`}
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={7}
              value={draft ?? value.toUpperCase()}
              aria-invalid={draft !== null && normalizeHex(draft) === null}
              onChange={(e) => {
                const text = e.target.value;
                setDraft(text);
                const n = normalizeHex(text);
                if (n) onChange(n);
              }}
              onBlur={() => setDraft(null)}
              onKeyDown={(e) => e.key === "Enter" && setDraft(null)}
              className="h-11 w-full border border-border bg-card px-3 font-mono text-sm font-semibold uppercase tracking-wider text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-destructive"
            />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {CHANNELS.map((ch, i) => (
            <div key={ch.name} className="flex items-center gap-3">
              <label htmlFor={`${id}-${ch.name}`} className="w-14 shrink-0 text-xs text-foreground/70">
                <span className="font-semibold text-foreground">{ch.name}</span> {ch.label}
              </label>
              <input
                id={`${id}-${ch.name}`}
                type="range"
                min={0}
                max={255}
                step={1}
                value={rgb[i] ?? 0}
                onChange={(e) => setChannel(i, Number(e.target.value))}
                style={{ accentColor: ch.accent }}
                className="h-9 min-w-0 flex-1 cursor-pointer"
              />
              <input
                aria-label={`${label}: ${ch.label} (0 a 255)`}
                type="number"
                inputMode="numeric"
                min={0}
                max={255}
                value={rgb[i] ?? 0}
                onChange={(e) => setChannel(i, Number(e.target.value))}
                className="h-9 w-16 shrink-0 border border-border bg-card px-2 text-center text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-foreground/55">{PAINT_TEXTOS.rgbAyuda}</p>
      </div>
    </fieldset>
  );
}

/* ─────────────────────────── Tono de la madera ─────────────────────────── */

function WoodStainPicker({
  idPrefix,
  value,
  onChange,
  names,
}: {
  idPrefix: string;
  value: WoodStainId;
  onChange: (id: WoodStainId) => void;
  names: string[];
}) {
  const current = woodStain(value);
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-foreground">{PAINT_TEXTOS.tonoMadera}</legend>
      <p className="mt-1 text-xs text-foreground/60">
        {names.length > 0 ? `${names.join(" y ")}: paredes interiores de madera.` : "Paredes interiores de madera."} {current.nombre}:{" "}
        {current.descripcion}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WOOD_STAINS.map((s) => {
          const id = `${idPrefix}-madera-${s.id}`;
          return (
            <label key={s.id} htmlFor={id} className="block cursor-pointer">
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-madera`}
                value={s.id}
                checked={value === s.id}
                onChange={() => onChange(s.id)}
                className="peer sr-only"
              />
              <span className="block border border-border bg-background p-1.5 transition-colors hover:border-primary/60 peer-checked:border-primary peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                <WoodSwatch id={s.id} className="h-12 w-full" />
                <span className="mt-1.5 flex items-center justify-between gap-1 px-0.5">
                  <span className="text-xs font-semibold text-foreground">{s.nombre}</span>
                  {value === s.id && <Check size={14} aria-hidden="true" className="shrink-0 text-primary" />}
                </span>
                {s.transparente && <span className="block px-0.5 text-[10px] leading-4 text-foreground/60">Transparente</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Muestra de un tono de madera: color de base, vetas verticales y, en Cristal, el brillo del barniz transparente. */
function WoodSwatch({ id, className = "" }: { id: WoodStainId; className?: string }) {
  const s = woodStain(id);
  const grain = "repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 2px, rgba(0,0,0,0) 2px 10px)";
  const knots = "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, rgba(255,255,255,0) 1px 6px)";
  const sheen = "linear-gradient(115deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 52%)";
  return (
    <span
      aria-hidden="true"
      className={`block ${className}`}
      style={{
        backgroundColor: s.muestra,
        backgroundImage: s.transparente ? `${sheen}, ${grain}, ${knots}` : `${grain}, ${knots}`,
      }}
    />
  );
}

/* ─────────────────────────── Vista previa ─────────────────────────── */

/**
 * Dibujo de la casa con los colores elegidos: el exterior de frente y un rincón del interior. Es una referencia rápida;
 * en el diseñador el color se ve sobre la casa real.
 */
function PaintPreview({ paint, options }: { paint: PaintConfig; options: PaintOption[] }) {
  const wood = options.some((o) => paintTarget(o.finish, "interior").kind === "madera"),
    colored = options.some((o) => paintTarget(o.finish, "interior").kind === "color"),
    // Con las dos clases de interior (cotizador con varias opciones) se dibujan los dos rincones.
    rooms: ("color" | "madera")[] = [...(colored ? (["color"] as const) : []), ...(wood ? (["madera"] as const) : [])];
  const none = "#d6d6d2",
    // Solo el siding lleva tablas horizontales; el revoque de la construcción tradicional es liso.
    siding = options.some((o) => paintTarget(o.finish, "exterior").system === "siding"),
    ext = paint.exterior ? paint.exteriorColor : none,
    stain = woodStain(paint.woodColor);
  const W = 134 + rooms.length * 100 - 6;
  return (
    <figure className="border border-border bg-background p-3">
      <svg
        viewBox={`0 0 ${W} 150`}
        role="img"
        aria-label="Vista previa de los colores elegidos"
        style={{ maxWidth: `${Math.round(W * 1.7)}px` }}
        className="mx-auto block h-auto w-full"
      >
        {/* Exterior */}
        <rect x="0" y="136" width={W} height="14" fill="currentColor" opacity="0.06" />
        <polygon points="14,62 70,20 126,62" fill="#4a4f55" />
        <rect x="22" y="62" width="96" height="74" fill={ext} />
        {siding &&
          [72, 82, 92, 102, 112, 122, 132].map((y) => (
            <line key={y} x1="22" x2="118" y1={y} y2={y} stroke="#000" strokeOpacity="0.1" />
          ))}
        <rect x="32" y="92" width="22" height="44" fill="#000" fillOpacity="0.32" />
        <rect x="76" y="82" width="30" height="26" fill="#bcd3e0" stroke="#000" strokeOpacity="0.25" />
        <line x1="91" x2="91" y1="82" y2="108" stroke="#000" strokeOpacity="0.25" />
        <text x="70" y="148" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.6">
          {paint.exterior ? "Exterior" : "Exterior · sin pintura"}
        </text>
        {/* Interior */}
        {rooms.map((kind, i) => {
          const x = 134 + i * 100,
            painted = paint.interior,
            fill = !painted ? none : kind === "madera" ? stain.muestra : paint.interiorColor;
          return (
            <g key={kind}>
              <rect x={x} y="30" width="88" height="106" fill={fill} />
              {kind === "madera" && painted &&
                [0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <line key={n} x1={x + 11 * (n + 1)} x2={x + 11 * (n + 1)} y1="30" y2="136" stroke="#000" strokeOpacity="0.12" />
                ))}
              {kind === "madera" && painted && stain.transparente && (
                <polygon points={`${x},30 ${x + 40},30 ${x},100`} fill="#fff" fillOpacity="0.25" />
              )}
              <rect x={x + 28} y="54" width="32" height="34" fill="#bcd3e0" stroke="#000" strokeOpacity="0.25" />
              <rect x={x} y="128" width="88" height="8" fill="#000" fillOpacity="0.14" />
              <rect x={x} y="136" width="88" height="14" fill="#b38b5d" />
              <text x={x + 44} y="148" textAnchor="middle" fontSize="8" fill="#fff" opacity="0.95">
                {!painted ? "Interior · sin pintura" : kind === "madera" ? "Interior · madera" : "Interior"}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/* ─────────────────────────── Precio ─────────────────────────── */

function PriceBlock({
  paint,
  options,
  logistics,
  nota,
}: {
  paint: PaintConfig;
  options: PaintOption[];
  logistics: LogisticsSelection;
  nota: string;
}) {
  const quotes = options.map((o) => ({ option: o, quote: paintExtra(paint, o.finish, o.surfaces, logistics) })),
    multi = options.length > 1;
  return (
    <div className="border border-border bg-card p-5" aria-live="polite" aria-atomic="true">
      {!paint.enabled ? (
        <>
          <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">Precio del extra</p>
          <p className="mt-2 text-2xl font-semibold text-primary">Desde {formatRate(PAINT_DESDE_USD)}/m²</p>
          <p className="mt-1 text-xs leading-5 text-foreground/70">
            Con {coatsLabel(2)}, mano de obra y materiales incluidos. Activá la pintura para calcular la tuya.
          </p>
        </>
      ) : !paint.exterior && !paint.interior ? (
        <>
          <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">Total del extra</p>
          <p className="mt-2 text-lg font-semibold text-foreground">Elegí qué paredes pintar</p>
        </>
      ) : (
        <>
          <div className={multi ? "divide-y divide-border" : ""}>
            {quotes.map(({ option, quote }) => (
              <div key={option.finish} style={option.tone} className={multi ? "py-4 first:pt-0 last:pb-0" : ""}>
                {multi && (
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--tone)" />
                    {option.name}
                  </p>
                )}
                <dl className="space-y-3 text-sm">
                  {quote.lines.map((l) => (
                    <Row
                      key={l.zone}
                      label={`${paintLineName(l)} · ${m2(l.area)}${l.rate === null ? "" : ` × ${formatRate(l.rate)}`}`}
                      value={l.subtotal === null ? PAINT_TEXTOS.aCotizar : formatUSD(l.subtotal)}
                    />
                  ))}
                  {paintCounts(quote) && (quote.percentage > 0 || quote.separateTrip) && (
                    <Row
                      label={`Logística${quote.separateTrip ? "" : ` · ${quote.percentage}%`}`}
                      value={quote.surcharge === null ? "A cotizar aparte" : formatUSD(quote.surcharge)}
                    />
                  )}
                </dl>
                <div className={`border-t border-border pt-3 ${multi ? "mt-3" : "mt-4"}`}>
                  <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">{multi ? "Total de la pintura" : "Total del extra"}</p>
                  <p className={`mt-1 font-semibold ${multi ? "text-2xl text-(--tone)" : "text-3xl text-primary"}`}>
                    {!paintCounts(quote) ? PAINT_TEXTOS.aCotizar : quote.total === null ? "A cotizar aparte" : formatUSD(quote.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-foreground/60">{nota}</p>
        </>
      )}
      <p className="mt-4 text-[11px] leading-5 text-foreground/60">{PAINT_TEXTOS.letraChica}</p>
    </div>
  );
}

/** Las fichas de cada trabajo, renglón por renglón, en pesos y en dólares por m². Resalta el total de las manos elegidas. */
function PriceTables({ systems, coats }: { systems: PaintSystemId[]; coats: PaintCoats }) {
  const shown = systems.length > 0 ? systems : (["siding", "yeso", "madera"] as PaintSystemId[]);
  return (
    <div className="space-y-6">
      <p className="text-xs text-foreground/60">
        {PAINT_TEXTOS.tablaTitulo}. Mano de obra y materiales incluidos. Pesos y dólares por m² (USD 1 = $U 40).
      </p>
      {shown.map((id) => {
        const t = PAINT_TARIFFS[id];
        return (
          <div key={id}>
            <p className="text-sm font-semibold text-foreground">
              {t.nombre} <span className="font-normal text-foreground/70">· {t.producto}</span>
            </p>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="sr-only">{`${t.nombre}: precio por m² de cada trabajo`}</caption>
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-foreground/55">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Trabajo</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">$U/m²</th>
                  <th scope="col" className="py-1.5 text-right font-medium">USD/m²</th>
                </tr>
              </thead>
              <tbody>
                {[t.preparacion, ...t.manos].map((step, i) => {
                  const included = i === 0 || i <= coats;
                  return (
                    <tr key={step.label} className={`border-t border-border ${included ? "" : "opacity-45"}`}>
                      <th scope="row" className="py-2 pr-3 font-normal text-foreground/85">{step.label}</th>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatUyu(step.uyu)}</td>
                      <td className="py-2 text-right tabular-nums">{formatRate(step.usd)}</td>
                    </tr>
                  );
                })}
                {PAINT_COATS.map((n) => (
                  <tr key={n} className={`border-t ${n === coats ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-foreground/80"}`}>
                    <th scope="row" className="py-2 pl-2 pr-3 font-semibold">
                      Total {coatsLabel(n)}
                      {n === coats ? " · elegido" : ""}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatUyu(t.totales[n].uyu)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatRate(t.totales[n].usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
