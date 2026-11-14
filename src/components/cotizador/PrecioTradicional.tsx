import { BadgePercent, Check, ChevronDown, Info } from "lucide-react";
import { TRADICIONAL_TEXTOS, incluyeFor, type TradicionalId } from "@/config/tradicional";
import { formatUSD, type VolumeBonus } from "@/lib/cotizador";

/**
 * Lo que explica el precio de la construcción tradicional. Lo comparten el cotizador (tarjetas, resumen) y el diseñador 3D
 * (selector de sistema, terminación, resumen), así que se ve igual en los dos y lee de los mismos datos
 * (`config/tradicional.ts` + `volumeBonus` de `lib/cotizador.ts`).
 *
 *  · `BonusNote`: «¡Bonificación por superficie aplicada!» + precio por m² efectivo, o la pista del próximo tramo.
 *  · `IncluyeAccordion`: «Ver qué incluye este precio» con los cinco puntos que justifican el valor.
 *  · `ExclusionNote`: nota aclaratoria de lo que no incluye, debajo del total.
 *
 * `variant="card"` toma el color de la tarjeta (`--tone`); `variant="panel"` usa el color de la marca (panel del diseñador).
 */
type Variant = "card" | "panel";

export function BonusNote({ bonus, hint, variant = "card", compact = false, className }: { bonus: VolumeBonus | null; hint?: string | null; variant?: Variant; compact?: boolean; className?: string }) {
  const card = variant === "card";
  return (
    <div aria-live="polite" className={className ?? (compact ? "mt-2" : "mt-3")}>
      {bonus ? (
        <div
          className={`flex gap-2.5 border p-3 ${card ? "border-(--tone)/40 bg-(--tone)/10" : "border-primary/40 bg-primary/10"}`}
        >
          <BadgePercent aria-hidden="true" size={compact ? 16 : 18} className={`mt-0.5 shrink-0 ${card ? "text-(--tone)" : "text-primary"}`} />
          <div className="min-w-0">
            <p className={`font-semibold text-foreground ${compact ? "text-xs leading-5" : "text-sm leading-5"}`}>{TRADICIONAL_TEXTOS.bonificacion(bonus.discount)}</p>
            <p className="mt-1 text-xs leading-5 text-foreground/75">
              {TRADICIONAL_TEXTOS.precioEfectivo}: <strong className="whitespace-nowrap font-semibold text-foreground">{formatUSD(bonus.rate)}/m²</strong>{" "}
              <s className="whitespace-nowrap text-foreground/55">{formatUSD(bonus.baseRate)}/m²</s>
              {!compact && (
                <>
                  {" "}
                  · {TRADICIONAL_TEXTOS.ahorro}: {formatUSD(bonus.saving)}
                </>
              )}
            </p>
          </div>
        </div>
      ) : hint ? (
        <p className="text-xs leading-5 text-foreground/60">{hint}</p>
      ) : null}
    </div>
  );
}

export function IncluyeAccordion({ option, variant = "card", className = "" }: { option?: TradicionalId; variant?: Variant; className?: string }) {
  const items = incluyeFor(option);
  return (
    <details className={`group border border-border bg-background ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Check aria-hidden="true" size={15} className={variant === "card" ? "text-(--tone)" : "text-primary"} />
          {TRADICIONAL_TEXTOS.verIncluye}
        </span>
        <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-foreground/60 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="border-t border-border px-3 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/60">{TRADICIONAL_TEXTOS.incluyeTitulo}</p>
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2.5">
              <Check aria-hidden="true" size={14} className={`mt-1 shrink-0 ${variant === "card" ? "text-(--tone)" : "text-primary"}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5 text-foreground">{item.titulo}</p>
                <p className="mt-0.5 text-xs leading-5 text-foreground/70">{item.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function ExclusionNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex gap-2 border-l-2 border-foreground/25 bg-foreground/5 px-3 py-2.5 text-[11px] leading-5 text-foreground/70 ${className}`}>
      <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-foreground/60" />
      <span>{TRADICIONAL_TEXTOS.exclusiones}</span>
    </p>
  );
}
