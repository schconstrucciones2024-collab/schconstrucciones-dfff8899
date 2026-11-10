import { useId, useState } from "react";
import type { BeforeAfterPair } from "@/data/beforeAfter";

/**
 * Comparador antes / después. Un control deslizante transparente cubre toda la imagen: así funciona con
 * mouse, dedo y teclado (flechas) sin código de arrastre propio.
 */
export function BeforeAfter({ pair }: { pair: BeforeAfterPair }) {
  const [position, setPosition] = useState(50);
  const id = useId();
  return (
    <figure>
      <div className="relative aspect-[4/3] w-full select-none overflow-hidden bg-card">
        <img src={pair.after} alt={pair.afterAlt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        <img src={pair.before} alt={pair.beforeAlt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
        <span className="absolute left-3 top-3 bg-background/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-sm">Antes</span>
        <span className="absolute right-3 top-3 bg-background/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-sm">Después</span>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-foreground" style={{ left: `${position}%` }}>
          <span className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-foreground bg-background/80 text-xs backdrop-blur-sm peer-focus-visible:ring-2">↔</span>
        </span>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label="Comparar antes y después: deslizá para ver cada imagen"
          aria-valuetext={`${position} % de la imagen del antes`}
          className="ba-range peer absolute inset-0 size-full cursor-ew-resize touch-pan-y opacity-0"
        />
      </div>
      {pair.caption && <figcaption className="mt-3 text-sm leading-6 text-foreground/70">{pair.caption}</figcaption>}
    </figure>
  );
}
