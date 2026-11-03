import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { Project } from "@/data/projects";
import { responsive, thumbnail } from "@/lib/img";

/**
 * Visor de galería. Se monta solo mientras está abierto.
 * Teclado: Esc cierra, ← → cambian de imagen, Tab queda dentro del visor y al cerrar el foco vuelve a la obra.
 * Táctil: deslizar a los costados cambia de imagen.
 */
export function Lightbox({ project, onClose }: { project: Project; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const total = project.images.length;
  const go = useCallback((step: number) => setIndex((current) => (current + step + total) % total), [total]);

  // Al abrir: bloquear el scroll de la página y enfocar el botón de cerrar. Al cerrar: devolver el foco a la obra.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key === "ArrowLeft") { go(-1); return; }
      if (event.key === "ArrowRight") { go(1); return; }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const onTouchStart = (event: TouchEvent) => { touchStart.current = event.touches[0]?.clientX ?? null; };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStart.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) > 50) go(delta > 0 ? -1 : 1);
  };

  const image = responsive(project.images[index]);
  const arrow = "absolute top-1/2 z-10 inline-flex size-12 -translate-y-1/2 items-center justify-center border border-foreground/25 bg-background/70 text-foreground backdrop-blur-sm transition-colors hover:border-primary hover:text-primary";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="galeria-titulo"
      className="lightbox-in fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{project.year}</p>
          <p id="galeria-titulo" className="truncate font-display text-lg font-medium sm:text-xl">{project.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="text-xs font-semibold tabular-nums text-foreground/70" aria-live="polite">{index + 1} / {total}</p>
          <button type="button" data-autofocus onClick={onClose} aria-label="Cerrar galería" className="inline-flex size-12 items-center justify-center border border-foreground/25 text-foreground transition-colors hover:border-primary hover:text-primary">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <img
          key={index}
          src={image.src}
          srcSet={image.srcSet}
          sizes="(min-width: 1024px) 70vw, 100vw"
          alt={`${project.name}, imagen ${index + 1} de ${total}`}
          decoding="async"
          className="lightbox-photo absolute inset-y-0 left-1/2 h-full w-full max-w-5xl -translate-x-1/2 object-contain px-2 sm:px-20"
        />
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Imagen anterior" className={`${arrow} left-2 sm:left-6`}><ArrowLeft aria-hidden="true" className="size-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Imagen siguiente" className={`${arrow} right-2 sm:right-6`}><ArrowRight aria-hidden="true" className="size-5" /></button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex justify-center gap-2 px-4 py-4">
          {project.images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver imagen ${i + 1} de ${total}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-16 w-12 overflow-hidden border transition-opacity ${i === index ? "border-primary opacity-100" : "border-foreground/20 opacity-55 hover:opacity-100"}`}
            >
              <img src={thumbnail(url)} alt="" width={48} height={64} loading="lazy" decoding="async" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
