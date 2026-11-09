import { useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  BARANDA_PRECIO_ML,
  DECK_A_COTIZAR,
  DECK_INCLUYE,
  DECK_LIMITES,
  DECK_NO_INCLUYE,
  DECK_TECHADO_PRECIO_M2,
  DECK_TEXTOS,
  DEFAULT_DECK,
  deckArea,
  deckPrice,
  deckRailMl,
  type DeckConfig,
} from "@/config/deck";
import { deckExtra, formatUSD, type LogisticsSelection } from "@/lib/cotizador";

/** Números con coma decimal, como se escriben en Uruguay. */
const fmt = (n: number) => String(n).replace(".", ",");

/**
 * Opción «Deck y techado (opcional)». La usan el cotizador (`variant="page"`) y el paso «Deck y techado» del diseñador
 * 3D (`variant="panel"`); los dos leen y escriben el mismo `DeckConfig`, y los precios salen de `src/config/deck.ts`.
 */
export function DeckPanel({
  deck,
  onChange,
  logistics,
  variant,
  idPrefix,
  frontLength = null,
  children,
}: {
  deck: DeckConfig;
  onChange: (patch: Partial<DeckConfig>) => void;
  logistics: LogisticsSelection;
  /** Largo (m) del frente de la casa, donde hay un diseño: habilita «Cubrir todo el frente de la casa». */
  frontLength?: number | null;
  variant: "page" | "panel";
  idPrefix: string;
  /** Lo que va entre el precio del extra y los desplegables (en el cotizador, el resumen por categoría). */
  children?: ReactNode;
}) {
  const page = variant === "page";
  return (
    <section aria-labelledby={`${idPrefix}-title`} className={page ? "mt-16" : ""}>
      {page ? (
        <>
          <p className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs">
            <span aria-hidden="true" className="h-px w-10 shrink-0 bg-primary" />
            Extra opcional
          </p>
          <h3
            id={`${idPrefix}-title`}
            className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl"
          >
            {DECK_TEXTOS.titulo}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground/70">
            {DECK_TEXTOS.subtitulo}
          </p>
        </>
      ) : (
        <>
          <h4 id={`${idPrefix}-title`} className="sr-only">
            {DECK_TEXTOS.titulo}
          </h4>
          <p className="text-xs leading-5 text-foreground/70">{DECK_TEXTOS.subtitulo}</p>
        </>
      )}
      <p
        role="note"
        className="mt-4 border border-primary/30 bg-primary/5 px-4 py-3 text-xs font-medium leading-5 text-foreground sm:text-sm"
      >
        {DECK_TEXTOS.aviso}
      </p>

      <div
        className={
          page
            ? "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
            : "mt-4 space-y-4"
        }
      >
        <div className="space-y-3">
          <ToggleRow
            id={`${idPrefix}-deck`}
            label={DECK_TEXTOS.deckTitulo}
            description={DECK_TEXTOS.deck}
            checked={deck.enabled}
            onChange={(on) => onChange({ enabled: on, ...(on ? {} : { roofed: false }) })}
          />
          <ToggleRow
            id={`${idPrefix}-techo`}
            label={DECK_TEXTOS.techoTitulo}
            description={DECK_TEXTOS.techo}
            hint={
              deck.enabled
                ? `USD ${DECK_TECHADO_PRECIO_M2}/m², ya incluye el deck.`
                : DECK_TEXTOS.techoNecesitaDeck
            }
            checked={deck.roofed}
            disabled={!deck.enabled}
            onChange={(on) => onChange({ roofed: on })}
          />

          {deck.enabled && (
            <div className="space-y-4 border border-border bg-card p-4">
              <fieldset>
                <legend className="text-xs uppercase tracking-[0.15em] text-foreground/60">
                  {DECK_TEXTOS.medidas}
                </legend>
                {frontLength !== null && (
                  <div className="mt-2">
                    <Check3
                      id={`${idPrefix}-frente-completo`}
                      label={DECK_TEXTOS.frenteCompleto}
                      checked={deck.fullFront}
                      onChange={(on) => onChange({ fullFront: on })}
                    />
                    <p className="text-xs text-foreground/60">
                      {DECK_TEXTOS.frenteCompletoAyuda} ({fmt(frontLength)} m)
                    </p>
                  </div>
                )}
                <div className={`mt-3 grid gap-4 ${page ? "sm:grid-cols-2" : ""}`}>
                  <Measure
                    id={`${idPrefix}-frente`}
                    label={DECK_TEXTOS.frente}
                    value={deck.width}
                    min={DECK_LIMITES.frenteMin}
                    max={DECK_LIMITES.frenteTope}
                    sliderMax={Math.max(20, Math.ceil(deck.width / 5) * 5)}
                    onChange={(width) => onChange({ width, fullFront: false })}
                  />
                  <Measure
                    id={`${idPrefix}-profundidad`}
                    label={DECK_TEXTOS.profundidad}
                    value={deck.depth}
                    min={DECK_LIMITES.profundidadMin}
                    max={DECK_LIMITES.profundidadTope}
                    sliderMax={Math.max(10, Math.ceil(deck.depth / 5) * 5)}
                    onChange={(depth) => onChange({ depth })}
                  />
                </div>
                <p className="mt-2 text-xs text-foreground/60">
                  {fmt(deckArea(deck))} m² · {fmt(deck.width)} × {fmt(deck.depth)} m.{" "}
                  {Number.isFinite(DECK_LIMITES.frenteMax) &&
                  Number.isFinite(DECK_LIMITES.profundidadMax)
                    ? `Se cotiza online hasta ${DECK_LIMITES.frenteMax} m de frente y ${DECK_LIMITES.profundidadMax} m de profundidad.`
                    : DECK_TEXTOS.ajustable}
                </p>
              </fieldset>

              <fieldset>
                <legend className="text-xs uppercase tracking-[0.15em] text-foreground/60">
                  {DECK_TEXTOS.barandas}
                </legend>
                <div className="mt-2 grid gap-1 sm:grid-cols-3">
                  <Check3
                    id={`${idPrefix}-b-frente`}
                    label={DECK_TEXTOS.barandaFrente}
                    checked={deck.railFront}
                    onChange={(on) => onChange({ railFront: on })}
                  />
                  <Check3
                    id={`${idPrefix}-b-izq`}
                    label={DECK_TEXTOS.barandaIzquierda}
                    checked={deck.railLeft}
                    onChange={(on) => onChange({ railLeft: on })}
                  />
                  <Check3
                    id={`${idPrefix}-b-der`}
                    label={DECK_TEXTOS.barandaDerecha}
                    checked={deck.railRight}
                    onChange={(on) => onChange({ railRight: on })}
                  />
                </div>
                <p className="mt-1 text-xs text-foreground/60">
                  {DECK_TEXTOS.barandaNota} USD {BARANDA_PRECIO_ML} por metro lineal
                  {deckRailMl(deck) > 0 ? ` · ${fmt(deckRailMl(deck))} ml elegidos` : ""}.
                </p>
              </fieldset>

              <div className="flex items-center justify-between gap-3">
                <Check3
                  id={`${idPrefix}-escalones`}
                  label={DECK_TEXTOS.escalones}
                  checked={deck.steps}
                  onChange={(on) => onChange({ steps: on })}
                />
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                  {DECK_TEXTOS.escalonesPrecio}
                </span>
              </div>
            </div>
          )}
        </div>

        <PriceBlock deck={deck} logistics={logistics} />
      </div>

      {children}

      <div className="mt-6 space-y-2">
        <Disclosure title={DECK_TEXTOS.incluyeTitulo}>
          <p className="text-sm font-semibold text-foreground">{DECK_INCLUYE.deckTitulo}</p>
          <List items={DECK_INCLUYE.deck} icon="check" />
          <p className="mt-4 text-sm font-semibold text-foreground">{DECK_INCLUYE.techoTitulo}</p>
          <List items={DECK_INCLUYE.techo} icon="check" />
          <p className="mt-4 text-xs leading-5 text-foreground/70">{DECK_INCLUYE.nota}</p>
        </Disclosure>
        <Disclosure title={DECK_TEXTOS.noIncluyeTitulo}>
          <List items={DECK_NO_INCLUYE} icon="x" />
        </Disclosure>
      </div>
    </section>
  );
}

function ToggleRow({
  id,
  label,
  description,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start gap-4 border p-4 transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border bg-card"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-describedby={`${id}-desc`}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <label
          htmlFor={id}
          className={`block min-h-6 text-sm font-semibold text-foreground ${disabled ? "" : "cursor-pointer"}`}
        >
          {label}
        </label>
        <p id={`${id}-desc`} className="mt-1 text-xs leading-5 text-foreground/70">
          {description}
        </p>
        {hint && <p className="mt-1 text-xs font-medium text-foreground/60">{hint}</p>}
      </div>
    </div>
  );
}

function Check3({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-primary"
      />
      {label}
    </label>
  );
}

const STEP_BOTON = 0.5;
const aDecimas = (n: number) => Math.round(n * 10) / 10;

/**
 * Medida en metros, a gusto del cliente: botones − y +, número (acepta coma o punto, se actualiza mientras se escribe y
 * vuelve al valor válido al salir del campo) y un deslizador que se estira si la medida pasa de su recorrido.
 */
function Measure({
  id,
  label,
  value,
  min,
  max,
  sliderMax,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  sliderMax: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parse = (text: string) => Number(text.trim().replace(",", "."));
  const typed = draft === null ? value : parse(draft);
  const invalid =
    draft !== null &&
    (draft.trim() === "" || !Number.isFinite(typed) || typed < min || typed > max);
  const bump = (delta: number) => {
    setDraft(null);
    onChange(Math.min(max, Math.max(min, aDecimas(value + delta))));
  };
  const boton =
    "h-11 w-11 shrink-0 border border-border bg-background text-xl font-semibold leading-none text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-foreground/70">
        {label}
      </label>
      <div className="mt-1 flex items-stretch gap-2">
        <button
          type="button"
          aria-label={`${DECK_TEXTOS.masChico}: ${label}`}
          className={boton}
          disabled={value <= min}
          onClick={() => bump(-STEP_BOTON)}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft ?? fmt(value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            const n = parse(text);
            if (text.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => e.key === "Enter" && setDraft(null)}
          className="h-11 min-w-0 flex-1 border border-border bg-background px-3 text-center text-base font-semibold text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-destructive"
        />
        <button
          type="button"
          aria-label={`${DECK_TEXTOS.masGrande}: ${label}`}
          className={boton}
          disabled={value >= max}
          onClick={() => bump(STEP_BOTON)}
        >
          +
        </button>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={Math.max(sliderMax, value)}
        step={0.1}
        value={value}
        onChange={(e) => {
          setDraft(null);
          onChange(aDecimas(Number(e.target.value)));
        }}
        className="mt-2 h-6 w-full cursor-pointer accent-primary"
      />
      {invalid && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-destructive">
          Ingresá un número entre {fmt(min)} y {fmt(max)} m.
        </p>
      )}
    </div>
  );
}

/** Precio del extra: m² × tarifa + barandas, con el costo logístico de la zona de la obra. Los escalones no suman. */
function PriceBlock({ deck, logistics }: { deck: DeckConfig; logistics: LogisticsSelection }) {
  const extra = deckExtra(deck, logistics);
  const sample = deckPrice({ ...DEFAULT_DECK, enabled: true });
  return (
    <div className="border border-border bg-card p-5" aria-live="polite" aria-atomic="true">
      {!deck.enabled ? (
        <>
          <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">Precio del extra</p>
          <p className="mt-2 text-2xl font-semibold text-primary">
            Desde {formatUSD(sample.subtotal ?? 0)}
          </p>
          <p className="mt-1 text-xs text-foreground/70">
            Deck de {fmt(sample.area)} m² ({fmt(DEFAULT_DECK.width)} × {fmt(DEFAULT_DECK.depth)} m).
            Activá el deck para calcular el tuyo.
          </p>
        </>
      ) : !extra.quotable ? (
        <>
          <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">Total del extra</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{DECK_A_COTIZAR}</p>
          <p className="mt-2 text-xs leading-5 text-foreground/70">{DECK_TEXTOS.fueraDeLimite}</p>
        </>
      ) : (
        <>
          <dl className="space-y-3 text-sm">
            <Row
              label={`${deck.roofed ? "Deck techado" : "Deck"} · ${fmt(extra.area)} m² × USD ${extra.rate}`}
              value={formatUSD(extra.deck ?? 0)}
            />
            {extra.railMl > 0 && (
              <Row
                label={`Barandas · ${fmt(extra.railMl)} ml × USD ${BARANDA_PRECIO_ML}`}
                value={formatUSD(extra.rails ?? 0)}
              />
            )}
            {deck.steps && (
              <Row label={DECK_TEXTOS.escalones} value={DECK_TEXTOS.escalonesPrecio} />
            )}
            {(extra.percentage > 0 || extra.separateTrip) && (
              <Row
                label={`${DECK_TEXTOS.logistica}${extra.separateTrip ? "" : ` · ${extra.percentage}%`}`}
                value={extra.surcharge === null ? "A cotizar aparte" : formatUSD(extra.surcharge)}
              />
            )}
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">
              Total del extra
            </p>
            <p className="mt-1 text-3xl font-semibold text-primary">
              {extra.total === null ? "A cotizar aparte" : formatUSD(extra.total)}
            </p>
          </div>
        </>
      )}
      <p className="mt-4 text-[11px] leading-5 text-foreground/60">{DECK_TEXTOS.letraChica}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border border-border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

function List({ items, icon }: { items: readonly string[]; icon: "check" | "x" }) {
  const Icon = icon === "check" ? Check : X;
  return (
    <ul className="mt-2 space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-sm leading-6 text-foreground/85">
          <Icon
            size={16}
            aria-hidden="true"
            className={`mt-1 shrink-0 ${icon === "check" ? "text-primary" : "text-accent"}`}
          />
          {t}
        </li>
      ))}
    </ul>
  );
}
