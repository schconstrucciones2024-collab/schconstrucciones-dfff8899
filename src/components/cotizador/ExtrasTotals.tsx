import { DECK_TEXTOS, type DeckConfig } from "@/config/deck";
import { PAINT_TEXTOS, paintIsActive, estimatePaintSurfaces, type PaintConfig } from "@/config/paint";
import { PARRILLERO_NOMBRES, PARRILLERO_TEXTOS, formatUSDRef, formatUYU, parrilleroIsActive, type ParrilleroConfig } from "@/config/parrillero";
import {
  calculateLogistics,
  deckExtra,
  estimateFor,
  formatUSD,
  paintCounts,
  paintExtra,
  parrilleroExtra,
  withExtras,
  type Category,
  type CategoryId,
  type LogisticsSelection,
  type SystemId,
} from "@/lib/cotizador";
import { CATEGORY_COLOR, tone } from "./palette";

/**
 * «Vivienda + extras opcionales» por categoría: el precio de la vivienda (que no cambia), lo que suma cada extra elegido
 * (deck, pintura y parrillero, con el costo logístico de la zona) y el total con extras. Se muestra solo si hay algún extra agregado.
 */
export function ExtrasTotals({
  categories,
  areas,
  system,
  logistics,
  deck,
  paint,
  parrillero,
}: {
  categories: Category[];
  areas: Record<CategoryId, number>;
  system: SystemId;
  logistics: LogisticsSelection;
  deck: DeckConfig;
  paint: PaintConfig;
  parrillero: ParrilleroConfig;
}) {
  const paintOn = paintIsActive(paint),
    parrOn = parrilleroIsActive(parrillero);
  if (!deck.enabled && !paintOn && !parrOn) return null;
  const money = (v: number | null, pending: string) => (v === null ? pending : formatUSD(v));
  const dq = deckExtra(deck, logistics),
    rq = parrilleroExtra(parrillero, logistics);
  return (
    <div className="mt-8" aria-live="polite">
      <h4 className="text-xs uppercase tracking-[0.15em] text-foreground/60">
        {DECK_TEXTOS.vivienda} + {DECK_TEXTOS.extras}
      </h4>
      <div className={`mt-3 grid gap-5 ${categories.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {categories.map((category) => {
          const base = estimateFor(category, areas[category.id]),
            pq = paintExtra(paint, category.id, estimatePaintSurfaces(areas[category.id], system), logistics),
            rows = withExtras(calculateLogistics(base, logistics).total, dq, pq, rq),
            paintPending = paintOn && !paintCounts(pq),
            parts: [string, string][] = [];
          if (deck.enabled) parts.push(["Deck y techado", money(dq.total, "A cotizar")]);
          if (paintOn) parts.push(["Pintura", paintCounts(pq) ? money(pq.total, "A cotizar aparte") : PAINT_TEXTOS.aCotizar]);
          if (parrOn)
            parts.push([
              `${PARRILLERO_TEXTOS.titulo} · ${PARRILLERO_NOMBRES[parrillero.finish]}`,
              rq.total === null || rq.totalUyu === null ? "A cotizar" : `${formatUYU(rq.totalUyu)} (ref. ${formatUSDRef(rq.total)})`,
            ]);
          // Con un solo extra se ve igual que siempre; con dos (o con pintura a cotizar) se abre el detalle de cada uno.
          const split = parts.length > 1 || paintPending;
          return (
            <article
              key={category.id}
              style={tone(CATEGORY_COLOR[category.id])}
              className="border border-border border-t-2 border-t-(--tone) bg-card p-5"
            >
              <h5 className="flex items-center gap-3 font-semibold text-foreground">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-(--tone)" />
                {category.name} · {areas[category.id]} m²
              </h5>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-foreground/60">{DECK_TEXTOS.vivienda}</dt>
                  <dd className="font-semibold text-foreground">{money(rows.vivienda, "A cotizar aparte")}</dd>
                </div>
                {split &&
                  parts.map(([label, value]) => (
                    <div key={label} className="flex flex-wrap justify-between gap-2 pl-3 text-xs">
                      <dt className="text-foreground/60">{label}</dt>
                      <dd className="font-semibold text-foreground">{value}</dd>
                    </div>
                  ))}
                {(!split || rows.extras !== 0) && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-foreground/60">{DECK_TEXTOS.extras}</dt>
                    <dd className="font-semibold text-foreground">{money(rows.extras, "A cotizar")}</dd>
                  </div>
                )}
                <div className="border-t border-border pt-4">
                  <dt className="text-xs text-foreground/60">{DECK_TEXTOS.totalConExtras}</dt>
                  <dd className="mt-2 text-2xl font-semibold text-(--tone)">{money(rows.totalConExtras, "A cotizar")}</dd>
                </div>
              </dl>
              {paintPending && <p className="mt-3 text-[11px] leading-5 text-foreground/60">La pintura de revoque se presupuesta aparte y no está sumada.</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
