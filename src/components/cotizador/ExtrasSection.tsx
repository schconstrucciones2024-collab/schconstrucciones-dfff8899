import { useState, type ReactNode } from "react";
import { Check, Flame, PaintRoller, Warehouse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXTRAS_TEXTOS, EXTRA_CARDS, type ExtraId } from "@/config/extras";
import type { DeckConfig } from "@/config/deck";
import { paintIsActive, type PaintConfig, type PaintZone } from "@/config/paint";
import { parrilleroIsActive, type ParrilleroConfig } from "@/config/parrillero";
import type { ParrilleroNotice } from "@/config/parrilleroGeometry";
import type { LogisticsSelection } from "@/lib/cotizador";
import { DeckPanel } from "./DeckExtra";
import { PaintPanel, type PaintOption } from "./PaintExtra";
import { ParrilleroPanel } from "./ParrilleroExtra";

const ICONS: Record<ExtraId, typeof Warehouse> = { deck: Warehouse, pintura: PaintRoller, parrillero: Flame };

function IconBox({ Icon, size }: { Icon: typeof Warehouse; size: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary ${size === "lg" ? "size-11" : "size-8"}`}
    >
      <Icon size={size === "lg" ? 20 : 16} />
    </span>
  );
}

/** «Agregado» (con tilde) u «Opcional»: si el extra está sumado a la cotización. */
function Badge({ on, boxed = false }: { on: boolean; boxed?: boolean }) {
  const text = on ? EXTRAS_TEXTOS.agregado : EXTRAS_TEXTOS.opcional;
  return boxed ? (
    <span
      className={`inline-flex shrink-0 items-center gap-1 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
        on ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground/60"
      }`}
    >
      {on && <Check size={12} aria-hidden="true" />}
      {text}
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${on ? "text-primary" : "text-foreground/55"}`}>
      {on && <Check size={12} aria-hidden="true" />}
      {text}
    </span>
  );
}

/**
 * Sección «Extras y opcionales»: la lista de extras que se pueden sumar a la vivienda (hoy, deck, pintura y parrillero) y el panel del que
 * se está mirando. La usan el cotizador de la página (`variant="page"`) y el último paso del diseñador (`variant="panel"`);
 * los dos leen y escriben los mismos datos y los precios salen de `config/deck.ts`, `config/paint.ts` y `config/parrillero.ts`.
 *
 * Para sumar otro extra: ver el encabezado de `config/extras.ts`.
 */
export function ExtrasSection({
  variant,
  idPrefix,
  logistics,
  deck,
  onDeckChange,
  frontLength = null,
  paint,
  onPaintChange,
  paintOptions,
  paintNota,
  onPaintLook,
  parrillero,
  onParrilleroChange,
  parrilleroNotices,
  onExpandDeck,
  initial = "deck",
  children,
}: {
  variant: "page" | "panel";
  idPrefix: string;
  logistics: LogisticsSelection;
  deck: DeckConfig;
  onDeckChange: (patch: Partial<DeckConfig>) => void;
  /** Largo (m) del frente de la casa, donde hay un diseño. */
  frontLength?: number | null;
  paint: PaintConfig;
  onPaintChange: (patch: Partial<PaintConfig>) => void;
  paintOptions: PaintOption[];
  /** De dónde sale la superficie que se pinta (estimada o medida sobre el diseño). */
  paintNota: string;
  /** Diseñador: mirar la casa por fuera o por dentro para ver el color. */
  onPaintLook?: (zone: PaintZone) => void;
  parrillero: ParrilleroConfig;
  onParrilleroChange: (patch: Partial<ParrilleroConfig>) => void;
  /** Diseñador: avisos del parrillero sobre el lugar, el deck y el techo. */
  parrilleroNotices?: ParrilleroNotice[];
  /** Diseñador: agranda el deck para que rodee al parrillero (solo si hay deck y hace falta). */
  onExpandDeck?: () => void;
  initial?: ExtraId;
  /** Lo que va debajo del extra elegido (en el cotizador, el resumen por categoría con todos los extras). */
  children?: ReactNode;
}) {
  const [active, setActive] = useState<ExtraId>(initial),
    page = variant === "page",
    added: Record<ExtraId, boolean> = {
      deck: deck.enabled,
      pintura: paintIsActive(paint),
      parrillero: parrilleroIsActive(parrillero),
    };
  return (
    <section aria-labelledby={`${idPrefix}-title`} className={page ? "mt-16" : ""}>
      {page ? (
        <>
          <p className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs">
            <span aria-hidden="true" className="h-px w-10 shrink-0 bg-primary" />
            {EXTRAS_TEXTOS.eyebrow}
          </p>
          <h3 id={`${idPrefix}-title`} className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
            {EXTRAS_TEXTOS.titulo}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground/70">{EXTRAS_TEXTOS.subtitulo}</p>
        </>
      ) : (
        <h4 id={`${idPrefix}-title`} className="sr-only">
          {EXTRAS_TEXTOS.titulo}
        </h4>
      )}

      <Tabs value={active} onValueChange={(v) => setActive(v as ExtraId)} className={page ? "mt-6" : "mt-1"}>
        <TabsList
          aria-label={EXTRAS_TEXTOS.listaEtiqueta}
          className={`grid h-auto w-full gap-3 rounded-none bg-transparent p-0 ${page ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 gap-2"}`}
        >
          {EXTRA_CARDS.map((card) => {
            const Icon = ICONS[card.id],
              on = added[card.id];
            return (
              <TabsTrigger
                key={card.id}
                value={card.id}
                className={`group h-auto w-full min-w-0 justify-start whitespace-normal rounded-none border border-border bg-card text-left text-foreground shadow-none transition-colors hover:border-primary/60 data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-primary ${
                  page ? "items-start gap-4 p-4 sm:p-5 sm:max-lg:last:odd:col-span-2" : "flex-col items-stretch gap-2 p-3 last:odd:col-span-2"
                }`}
              >
                {page ? (
                  <>
                    <IconBox Icon={Icon} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold leading-6 text-foreground">{card.titulo}</span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-foreground/70">{card.resumen}</span>
                      <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.1em] text-primary">{card.desde}</span>
                    </span>
                    <Badge on={on} boxed />
                  </>
                ) : (
                  <>
                    <span className="flex w-full items-center gap-2">
                      <IconBox Icon={Icon} size="sm" />
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-foreground">{card.titulo}</span>
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">{card.desde}</span>
                    <Badge on={on} />
                  </>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="deck" className="mt-6 focus-visible:ring-0 focus-visible:ring-offset-0">
          <DeckPanel
            deck={deck}
            onChange={onDeckChange}
            logistics={logistics}
            variant={variant}
            idPrefix={`${idPrefix}-deck`}
            frontLength={frontLength}
            embedded
          />
        </TabsContent>
        <TabsContent value="pintura" className="mt-6 focus-visible:ring-0 focus-visible:ring-offset-0">
          <PaintPanel
            paint={paint}
            onChange={onPaintChange}
            logistics={logistics}
            options={paintOptions}
            variant={variant}
            idPrefix={`${idPrefix}-paint`}
            nota={paintNota}
            onLook={onPaintLook}
          />
        </TabsContent>
        <TabsContent value="parrillero" className="mt-6 focus-visible:ring-0 focus-visible:ring-offset-0">
          <ParrilleroPanel
            parrillero={parrillero}
            onChange={onParrilleroChange}
            logistics={logistics}
            variant={variant}
            idPrefix={`${idPrefix}-parrillero`}
            notices={parrilleroNotices}
            onExpandDeck={onExpandDeck}
            embedded
          />
        </TabsContent>
      </Tabs>

      {children}
    </section>
  );
}
