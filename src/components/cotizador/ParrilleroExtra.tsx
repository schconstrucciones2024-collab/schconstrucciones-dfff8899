import { Button } from "@/components/ui/button";
import {
  PARRILLERO_FINISHES,
  PARRILLERO_LADOS,
  PARRILLERO_NOMBRES,
  PARRILLERO_PASO_PANEL,
  PARRILLERO_PRECIOS,
  PARRILLERO_SIDES,
  PARRILLERO_TEXTOS,
  formatUSDRef,
  formatUYU,
  normalizeRot,
  parrilleroEnSuLugar,
  type ParrilleroConfig,
  type ParrilleroFinish,
  type ParrilleroSide,
} from "@/config/parrillero";
// Solo el tipo: el panel se usa en la página de inicio y no debe arrastrar la geometría 3D.
import type { ParrilleroNotice } from "@/config/parrilleroGeometry";
import { formatUSD, parrilleroExtra, type LogisticsSelection } from "@/lib/cotizador";
import { Disclosure, List, Row, ToggleRow } from "./DeckExtra";

/** Lo que dice cada terminación debajo de su nombre. */
const FINISH_RESUMEN: Record<ParrilleroFinish, string> = {
  ladrillo: "Ladrillo a la vista, con sus juntas, por fuera.",
  revoque: "Revoque fino mate por fuera. Misma forma y mismo hogar refractario.",
};

/**
 * Opción «Parrilleros SCH (opcional)». La usan el cotizador de la página (`variant="page"`, con su propio estado) y el paso
 * «Extras» del diseñador 3D (`variant="panel"`, con el estado del diseño); en los dos casos lo que se elige es el mismo
 * `ParrilleroConfig`, y los precios, medidas y textos salen de `config/parrillero.ts`.
 *
 * Elegir una terminación lo agrega al presupuesto; el interruptor lo agrega o lo quita sin perder lo elegido.
 */
export function ParrilleroPanel({
  parrillero,
  onChange,
  logistics,
  variant,
  idPrefix,
  notices = [],
  onExpandDeck,
  embedded = false,
}: {
  parrillero: ParrilleroConfig;
  onChange: (patch: Partial<ParrilleroConfig>) => void;
  logistics: LogisticsSelection;
  variant: "page" | "panel";
  idPrefix: string;
  /** Diseñador: avisos sobre el lugar, el deck y el techo (en la página no hay diseño y no se muestran). */
  notices?: ParrilleroNotice[];
  /** Diseñador: agranda el deck lo justo para que rodee al parrillero. Si no hay deck o no hace falta, no se pasa. */
  onExpandDeck?: () => void;
  /** Dentro de «Extras y opcionales»: sin título ni margen propios (los pone la sección). */
  embedded?: boolean;
}) {
  const page = variant === "page",
    T = PARRILLERO_TEXTOS;
  return (
    <section aria-labelledby={`${idPrefix}-title`} className={page && !embedded ? "mt-16" : ""}>
      <h4 id={`${idPrefix}-title`} className="sr-only">
        {T.titulo}
      </h4>
      <p className="text-xs leading-5 text-foreground/70">{T.descripcion}</p>
      <p
        role="note"
        className="mt-4 border border-primary/30 bg-primary/5 px-4 py-3 text-xs font-medium leading-5 text-foreground sm:text-sm"
      >
        {T.aviso}
      </p>

      <div className={page ? "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" : "mt-4 space-y-4"}>
        <div className="min-w-0 space-y-3">
          <FinishSelector idPrefix={idPrefix} parrillero={parrillero} onChange={onChange} />
          <ToggleRow
            id={`${idPrefix}-agregar`}
            label={parrillero.enabled ? T.quitar : T.agregar}
            description={T.terminacionAyuda}
            checked={parrillero.enabled}
            onChange={(on) => onChange({ enabled: on })}
          />

          {parrillero.enabled && (
            <div className="space-y-4 border border-border bg-card p-4">
              <SideSelector idPrefix={idPrefix} value={parrillero.side} onChange={(side) => onChange({ side })} />
              <ToggleRow
                id={`${idPrefix}-mesada`}
                label={T.mesada}
                description={T.mesadaAyuda}
                checked={parrillero.sink}
                onChange={(sink) => onChange({ sink })}
              />
              {!page && <MoverYGirar parrillero={parrillero} onChange={onChange} />}
              {notices.length > 0 && (
                <ul className="space-y-2" aria-label="Avisos del parrillero">
                  {notices.map((n) => (
                    <li
                      key={n.text}
                      role={n.level === "error" ? "alert" : "note"}
                      className={`border p-3 text-xs leading-5 ${
                        n.level === "error" ? "border-destructive/60 bg-destructive/5 text-foreground" : "border-border bg-background text-foreground/80"
                      }`}
                    >
                      {n.text}
                    </li>
                  ))}
                </ul>
              )}
              {onExpandDeck && (
                <div>
                  <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal rounded-none" onClick={onExpandDeck}>
                    {T.ampliarDeck}
                  </Button>
                  <p className="mt-2 text-xs text-foreground/60">{T.ampliarDeckAyuda}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <PriceBlock parrillero={parrillero} logistics={logistics} />
          <Disclosure title="Qué incluye">
            <List items={T.incluye} icon="check" />
          </Disclosure>
          <Disclosure title="Qué no incluye">
            <List items={T.noIncluye} icon="x" />
          </Disclosure>
        </div>
      </div>
    </section>
  );
}

/**
 * Mover y girar el parrillero con botones (solo en el diseñador 3D, donde hay una casa): lo mismo que se hace arrastrándolo y
 * con su botón de giro, pero de a pasos fijos y sin necesidad de apuntar bien en una pantalla chica. `dx`/`dz` van en el marco
 * de la fachada (x a la derecha de quien la mira, z hacia afuera); el giro positivo es el de la escena 3D (antihorario visto
 * desde arriba), o sea «a la izquierda» para quien mira la casa de frente.
 */
function MoverYGirar({ parrillero, onChange }: { parrillero: ParrilleroConfig; onChange: (patch: Partial<ParrilleroConfig>) => void }) {
  const T = PARRILLERO_TEXTOS,
    paso = PARRILLERO_PASO_PANEL,
    redondear = (n: number) => Math.round(n * 100) / 100,
    mover = (ddx: number, ddz: number) =>
      onChange({ dx: redondear(parrillero.dx + ddx), dz: redondear(parrillero.dz + ddz) }),
    girar = (grados: number) => onChange({ rot: normalizeRot(parrillero.rot + grados) }),
    boton = "h-auto min-h-11 whitespace-normal rounded-none px-2 text-sm";
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs uppercase tracking-[0.15em] text-foreground/60">{T.mover}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className={boton} data-testid="parrillero-izquierda" onClick={() => mover(-paso, 0)}>
          ← {T.izquierda}
        </Button>
        <Button type="button" variant="outline" className={boton} data-testid="parrillero-derecha" onClick={() => mover(paso, 0)}>
          {T.derecha} →
        </Button>
        <Button type="button" variant="outline" className={boton} data-testid="parrillero-hacia-casa" onClick={() => mover(0, -paso)}>
          ↑ {T.haciaCasa}
        </Button>
        <Button type="button" variant="outline" className={boton} data-testid="parrillero-hacia-afuera" onClick={() => mover(0, paso)}>
          ↓ {T.haciaAfuera}
        </Button>
        <Button type="button" variant="outline" className={boton} data-testid="parrillero-girar-izquierda" onClick={() => girar(90)}>
          ↺ {T.girarIzquierda}
        </Button>
        <Button type="button" variant="outline" className={boton} data-testid="parrillero-girar-derecha" onClick={() => girar(-90)}>
          ↻ {T.girarDerecha}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="mt-2 h-auto min-h-11 w-full whitespace-normal rounded-none text-sm"
        data-testid="parrillero-volver"
        disabled={parrilleroEnSuLugar(parrillero)}
        onClick={() => onChange({ dx: 0, dz: 0, rot: 0 })}
      >
        {T.volverLugar}
      </Button>
      <p className="mt-1 text-xs text-foreground/60">{T.moverAyuda}</p>
    </fieldset>
  );
}

/** Las dos terminaciones, como tarjetas con su precio: elegir una la deja marcada y suma el parrillero al presupuesto. */
function FinishSelector({
  idPrefix,
  parrillero,
  onChange,
}: {
  idPrefix: string;
  parrillero: ParrilleroConfig;
  onChange: (patch: Partial<ParrilleroConfig>) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs uppercase tracking-[0.15em] text-foreground/60">{PARRILLERO_TEXTOS.terminacion}</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {PARRILLERO_FINISHES.map((f) => {
          const id = `${idPrefix}-terminacion-${f}`,
            price = PARRILLERO_PRECIOS[f],
            selected = parrillero.enabled && parrillero.finish === f;
          return (
            <label key={f} htmlFor={id} className="block cursor-pointer">
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-terminacion`}
                value={f}
                checked={selected}
                onChange={() => onChange({ finish: f, enabled: true })}
                className="peer sr-only"
              />
              <span className="flex h-full flex-col border border-border bg-card p-4 transition-colors hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-foreground">{PARRILLERO_NOMBRES[f]}</span>
                  {selected && (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Elegido</span>
                  )}
                </span>
                <span className="mt-1 text-xs leading-5 text-foreground/70">{FINISH_RESUMEN[f]}</span>
                <span className="mt-3 block text-lg font-semibold text-foreground">{formatUYU(price.uyu)}</span>
                <span className="block text-xs text-foreground/60">Referencia {formatUSDRef(price.usd)}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-foreground/60">{PARRILLERO_TEXTOS.terminacionAyuda}</p>
    </fieldset>
  );
}

/** Lateral de la casa, mirando la fachada de la entrada desde afuera. */
function SideSelector({ idPrefix, value, onChange }: { idPrefix: string; value: ParrilleroSide; onChange: (side: ParrilleroSide) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs uppercase tracking-[0.15em] text-foreground/60">{PARRILLERO_TEXTOS.ubicacion}</legend>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {PARRILLERO_SIDES.map((s) => {
          const id = `${idPrefix}-lado-${s}`;
          return (
            <label key={s} htmlFor={id} className="block cursor-pointer">
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-lado`}
                value={s}
                checked={value === s}
                onChange={() => onChange(s)}
                className="peer sr-only"
              />
              <span className="flex min-h-11 items-center justify-center border border-border bg-background px-3 py-2 text-center text-sm font-semibold text-foreground transition-colors hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                {PARRILLERO_LADOS[s]}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-foreground/60">{PARRILLERO_TEXTOS.ubicacionAyuda}</p>
    </fieldset>
  );
}

/** Precio fijo en pesos con su referencia en dólares; con logística de la zona, el recargo y el total del extra. */
function PriceBlock({ parrillero, logistics }: { parrillero: ParrilleroConfig; logistics: LogisticsSelection }) {
  const T = PARRILLERO_TEXTOS,
    q = parrilleroExtra(parrillero, logistics),
    desde = PARRILLERO_PRECIOS.ladrillo;
  return (
    <div className="border border-border bg-card p-5" aria-live="polite" aria-atomic="true">
      {!parrillero.enabled ? (
        <>
          <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">Precio del extra</p>
          <p className="mt-2 text-2xl font-semibold text-primary">Desde {formatUYU(desde.uyu)}</p>
          <p className="mt-1 text-xs leading-5 text-foreground/70">
            Referencia {formatUSDRef(desde.usd)}. Elegí una terminación para sumarlo a tu presupuesto.
          </p>
        </>
      ) : (
        <>
          <dl className="space-y-3 text-sm">
            <Row label={`${T.nombre} · ${PARRILLERO_NOMBRES[q.finish]}`} value={formatUYU(q.uyu)} />
            <Row label={T.referencia} value={formatUSDRef(q.usd)} />
            {(q.percentage > 0 || q.separateTrip) && (
              <Row
                label={`${T.logistica}${q.separateTrip ? "" : ` · ${q.percentage}%`}`}
                value={q.surcharge === null ? "A cotizar aparte" : formatUSD(q.surcharge)}
              />
            )}
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">{T.totalExtra}</p>
            <p className="mt-1 text-3xl font-semibold text-primary">{q.totalUyu === null ? "A cotizar aparte" : formatUYU(q.totalUyu)}</p>
            {q.total !== null && <p className="mt-1 text-xs text-foreground/60">Referencia {formatUSDRef(q.total)}</p>}
          </div>
        </>
      )}
      <p className="mt-4 text-[11px] leading-5 text-foreground/60">{T.letraChica}</p>
    </div>
  );
}
