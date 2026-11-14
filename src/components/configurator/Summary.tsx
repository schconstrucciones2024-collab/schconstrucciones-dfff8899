import { useEffect, useMemo, useState } from "react";
import { Copy, Share2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  configPrice,
  configWhatsAppText,
  configWhatsAppUrl,
  FINISH_NAMES,
  FOUNDATION_NAMES,
  roofName,
} from "@/config/pricing";
import { exteriorThickness, systemOf } from "@/config/systems";
import { LOGISTICS_ZONES, SYSTEMS, deckExtra, formatUSD, nextBonusHint, paintCounts, paintExtra, withExtras } from "@/lib/cotizador";
import { BonusNote, ExclusionNote, IncluyeAccordion } from "@/components/cotizador/PrecioTradicional";
import type { TradicionalId } from "@/config/tradicional";
import { DECK_TEXTOS } from "@/config/deck";
import { PAINT_TEXTOS, coatsLabel, paintIsActive } from "@/config/paint";
import { paintSurfacesOf } from "./paintSurfaces";
import { resolveDeck } from "@/config/deckGeometry";
import { detectRooms } from "@/config/geometry";
import { designUrl, suggestedOpenings, useConfigurator } from "@/store/useConfigurator";
export function Summary({ full = false }: { full?: boolean }) {
  const { config: c, update } = useConfigurator(),
    [copied, setCopied] = useState(false),
    [fallback, setFallback] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.href), []);
  const link = origin ? designUrl(c, origin) : "";
  // El deck tal cual se ve y se cotiza: con «frente completo», del ancho del frente de la casa.
  const deck = resolveDeck(c.deck, c.contour, exteriorThickness(c.finish));
  // La pintura se mide sobre las paredes del diseño solo si está agregada (recorrer el diseño no es gratis).
  const paintOn = paintIsActive(c.paint),
    paintSurfaces = useMemo(() => (paintOn ? paintSurfacesOf(c) : { exterior: 0, interior: 0 }), [c, paintOn]),
    paintQuote = paintOn ? paintExtra(c.paint, c.finish, paintSurfaces, c.logistics) : undefined;
  const input = {
      ...c,
      deck,
      paintSurfaces,
      extraOpenings: Math.max(0, c.openings.length - suggestedOpenings(c).length),
      openings: c.openings.length,
      roomsCount: c.walls.reduce((n, w) => n + detectRooms(c.contour, w).length, 0),
      stairsCount: c.stairs.length,
      countersCount: c.counters.length,
      designLink: link,
    },
    p = configPrice(input),
    text = configWhatsAppText(input),
    rows = withExtras(p.total, deckExtra(deck, c.logistics), paintQuote),
    extrasOn = deck.enabled || paintOn,
    tradicional = systemOf(c.finish) === "tradicional",
    paintPending = !!paintQuote && !paintCounts(paintQuote);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setFallback(true);
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${systemOf(c.finish) === "tradicional" ? "Mi vivienda" : "Mi cabaña"} · SCH Construcciones`, text, url: link });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFallback(true);
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        setFallback(true);
      }
    }
  };
  return (
    <div className={full ? "space-y-5" : "border-t border-border pt-5"}>
      {full && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
            {[
              ["Superficie", `${Number(c.m2.toFixed(2))} m²`],
              ["Plantas", `${c.floors} · ${(c.m2 / c.floors).toFixed(1)} m² por planta`],
              ["Sistema", SYSTEMS[systemOf(c.finish)].name],
              ["Precio por m²", `${formatUSD(p.rate)}/m²${p.bonus ? ` (-${p.bonus.discount}%)` : ""}`],
              ["Terminación", FINISH_NAMES[c.finish]],
              ["Fundación", FOUNDATION_NAMES[c.foundation]],
              ["Techo", roofName(c.roofType, c.finish)],
              ["Aberturas", String(c.openings.length)],
              ["Suelo", c.ground==="arena"?"Suelo de arena":"Suelo firme con césped"],
              ["Ambientes", String(input.roomsCount)],
              ["Escaleras", String(input.stairsCount)],
              ["Mesadas", String(input.countersCount)],
              ["Deck y techado", deck.enabled ? `${deck.roofed ? "Deck techado" : "Deck"} · ${Number(deck.width)} × ${Number(deck.depth)} m` : "No agregado"],
              ["Pintura", paintOn ? `${coatsLabel(c.paint.coats)} · ${[c.paint.exterior && "exterior", c.paint.interior && "interior"].filter(Boolean).join(" e ")}` : "No agregada"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="mb-1 text-xs text-foreground/60">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <label className="block text-xs text-foreground/75">
            Zona de la obra
            <select
              className="config-input mt-2"
              value={c.logistics.zoneId}
              onChange={(e) => {
                const zone = LOGISTICS_ZONES.find((z) => z.id === e.target.value);
                if (zone) update({ logistics: { ...c.logistics, zoneId: zone.id } });
              }}
            >
              {LOGISTICS_ZONES.map((z) => (
                <option value={z.id} key={z.id}>
                  {z.label} · {z.max}%
                </option>
              ))}
            </select>
          </label>
          {c.logistics.zoneId === "far" && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={c.logistics.separateTrip}
                onChange={(e) =>
                  update({ logistics: { ...c.logistics, separateTrip: e.target.checked } })
                }
              />
              Cotizar el viaje aparte
            </label>
          )}
          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-2">
              <dt>Obra base</dt>
              <dd>{formatUSD(p.base)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Ajustes</dt>
              <dd>{formatUSD(p.adjustments)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Logística ({p.percentage}%)</dt>
              <dd>{p.surcharge === null ? "A cotizar" : formatUSD(p.surcharge)}</dd>
            </div>
          </dl>
        </>
      )}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase text-foreground/60">
            {p.total === null ? "Inversión · obra base" : "Inversión estimada"}
          </p>
          <strong className="mt-1 block font-display text-3xl font-medium text-primary">
            {formatUSD(p.total ?? p.obra)}
          </strong>
        </div>
        <span className="mb-1 text-xs text-foreground/60">
          {Number(c.m2.toFixed(2))} m² · {c.floors} planta{c.floors > 1 ? "s" : ""}
        </span>
      </div>
      {tradicional && (
        <div className="mb-4 space-y-3">
          {/* Bonificación por superficie (5% desde 65 m², 8% desde 90 m²), la misma que aplica el cotizador. */}
          <BonusNote variant="panel" compact={!full} className="" bonus={p.bonus} hint={nextBonusHint({ id: c.finish }, c.m2)} />
          <ExclusionNote />
          {full && <IncluyeAccordion variant="panel" option={c.finish as TradicionalId} />}
        </div>
      )}
      {extrasOn && (
        <dl aria-label="Vivienda y extras opcionales" className="mb-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-2">
            <dt>{DECK_TEXTOS.vivienda}{p.total === null ? " · obra base" : ""}</dt>
            <dd>{formatUSD(p.total ?? p.obra)}</dd>
          </div>
          {deck.enabled && paintOn && (
            <>
              <div className="flex justify-between gap-2 pl-3 text-xs text-foreground/70">
                <dt>Deck y techado</dt>
                <dd>{deckExtra(deck, c.logistics).total === null ? "A cotizar" : formatUSD(deckExtra(deck, c.logistics).total ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2 pl-3 text-xs text-foreground/70">
                <dt>Pintura</dt>
                <dd>{paintQuote && paintCounts(paintQuote) ? (paintQuote.total === null ? "A cotizar aparte" : formatUSD(paintQuote.total)) : PAINT_TEXTOS.aCotizar}</dd>
              </div>
            </>
          )}
          {!(paintPending && !deck.enabled) && (
            <div className="flex justify-between gap-2">
              <dt>{DECK_TEXTOS.extras}</dt>
              <dd>{rows.extras === null ? "A cotizar" : formatUSD(rows.extras)}</dd>
            </div>
          )}
          {paintPending && !deck.enabled && (
            <div className="flex justify-between gap-2">
              <dt>Pintura</dt>
              <dd>{PAINT_TEXTOS.aCotizar}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2 font-semibold text-primary">
            <dt>{DECK_TEXTOS.totalConExtras}</dt>
            <dd>{rows.totalConExtras === null ? "A cotizar" : formatUSD(rows.totalConExtras)}</dd>
          </div>
          {paintPending && <p className="pt-1 text-[11px] font-normal leading-5 text-foreground/60">{PAINT_TEXTOS.revoque}</p>}
          <p className="pt-1 text-[11px] font-normal leading-5 text-foreground/60">{paintOn ? PAINT_TEXTOS.letraChica : DECK_TEXTOS.letraChica}</p>
        </dl>
      )}
      <Button
        asChild
        className="min-h-12 w-full gap-2 bg-whatsapp text-primary-foreground hover:bg-whatsapp/90"
      >
        <a href={configWhatsAppUrl(input)} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} />
          Consultar por WhatsApp
        </a>
      </Button>
      {full && (
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="min-h-11 flex-1 gap-2" onClick={copy}>
            <Copy size={15} />
            {copied ? "Copiado" : "Copiar resumen"}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={share}
            title="Compartir mi diseño"
            aria-label="Compartir mi diseño"
          >
            <Share2 size={17} />
          </Button>
        </div>
      )}
      {fallback && (
        <textarea
          readOnly
          className="config-input mt-3 h-44 text-xs"
          value={link+"\n\n"+text}
          aria-label="Resumen de tu cabaña para copiar"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
      <p className="mt-3 text-[11px] leading-5 text-foreground/60">
        Valor estimativo. Presupuesto final a medida y sin cargo.
      </p>
    </div>
  );
}
