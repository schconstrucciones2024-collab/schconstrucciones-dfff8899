import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode, type RefObject } from "react";

/**
 * Sistema de movimiento de SCH.
 * - Solo anima `transform` y `opacity`.
 * - Respeta `prefers-reduced-motion`.
 * - Si el JavaScript falla o aún no se ejecutó, el contenido queda visible: nada se oculta desde el HTML inicial.
 */

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Mouse o trackpad (no táctil): los efectos que siguen al puntero solo se activan ahí. */
const finePointer = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

type RevealProps = {
  as?: ElementType;
  delay?: number;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
};

/** Retraso de entrada para las animaciones CSS (`animation-delay: var(--d)`). */
export const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** Hace aparecer su contenido (opacidad + desplazamiento) cuando entra en pantalla. */
export function Reveal({ as: Tag = "div", delay: wait = 0, className = "", children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === "undefined") return;
    // Lo que ya se ve al cargar (o quedó arriba al volver a una ancla) no se oculta: evita parpadeos.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setPending(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPending(false);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style = wait ? delay(wait) : undefined;
  return (
    <Tag ref={ref} data-reveal={pending ? "pending" : undefined} className={`reveal ${className}`} style={style} {...rest}>
      {children}
    </Tag>
  );
}

/** `true` cuando la página bajó más de `threshold` px. */
export function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > threshold));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return scrolled;
}

/** Parallax discreto: desplaza el elemento hasta `maxShift` px (variable CSS `--shift`) mientras el hero está en pantalla. */
export function useParallax(ref: RefObject<HTMLElement | null>, factor = 0.14, maxShift = 90) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > window.innerHeight * 1.2) return;
        el.style.setProperty("--shift", `${Math.min(y * factor, maxShift).toFixed(1)}px`);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [ref, factor, maxShift]);
}

/**
 * Palabras que suben desde una máscara (efecto editorial). Dentro de un <Reveal> entran al verse en pantalla;
 * dentro de `.hero-words` lo hacen al cargar. El texto sigue siendo texto normal para lectores de pantalla y buscadores.
 */
export function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="word"><span className="word-i" style={{ "--i": index } as CSSProperties}>{word}</span></span>
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

/** Cuenta de `from` a `to` cuando entra en pantalla. Sin movimiento (o sin JavaScript) muestra el valor final. */
export function CountUp({ to, from = 0, duration = 1800, prefix = "", suffix = "", className = "" }: { to: number; from?: number; duration?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const finalText = `${prefix}${to}${suffix}`;
  useEffect(() => {
    const el = ref.current;
    const node = el?.firstChild;
    if (!el || !node || reducedMotion() || typeof IntersectionObserver === "undefined") return;
    let frame = 0;
    let started = false;
    const run = () => {
      started = true;
      const begin = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - begin) / duration);
        const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
        node.nodeValue = t >= 1 ? finalText : `${prefix}${Math.round(from + (to - from) * eased)}${suffix}`;
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    node.nodeValue = `${prefix}${from}${suffix}`;
    const observer = new IntersectionObserver((entries) => {
      if (!started && entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); run(); }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); node.nodeValue = finalText; };
  }, [to, from, duration, prefix, suffix, finalText]);
  return <span ref={ref} className={`tabular-nums ${className}`}>{finalText}</span>;
}

/** Barra fina de avance de lectura arriba de todo (escala en X con el scroll). */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        el.style.setProperty("--sp", (max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0).toFixed(4));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={ref} aria-hidden="true" className="scroll-progress" />;
}

/** Avance de una sección (0 a 1) mientras cruza la pantalla, en la variable CSS `--p` del elemento. */
export function useSectionProgress(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) { el.style.setProperty("--p", "1"); return; }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const travel = window.innerHeight * 0.75 + rect.height * 0.35;
        el.style.setProperty("--p", Math.min(1, Math.max(0, (window.innerHeight * 0.85 - rect.top) / travel)).toFixed(3));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); cancelAnimationFrame(frame); };
  }, [ref]);
}

/** Atrae suavemente el elemento hacia el puntero (variables `--mx` y `--my`; la clase `.magnetic` aplica el transform). Solo con mouse. */
export function useMagnetic<T extends HTMLElement>(ref: RefObject<T | null>, strength = 0.28, limit = 10) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !finePointer()) return;
    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) * strength;
      const dy = (event.clientY - (rect.top + rect.height / 2)) * strength;
      el.style.setProperty("--mx", `${Math.max(-limit, Math.min(limit, dx)).toFixed(1)}px`);
      el.style.setProperty("--my", `${Math.max(-limit, Math.min(limit, dy)).toFixed(1)}px`);
    };
    const leave = () => { el.style.setProperty("--mx", "0px"); el.style.setProperty("--my", "0px"); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [ref, strength, limit]);
}

/** Inclina el elemento hasta `max` grados hacia el puntero (variables `--rx` y `--ry`; la clase `.tilt` aplica el transform). Solo con mouse. */
export function useTilt<T extends HTMLElement>(ref: RefObject<T | null>, max = 4) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !finePointer()) return;
    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--rx", `${(-y * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 2 * max).toFixed(2)}deg`);
    };
    const leave = () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [ref, max]);
}

/** Luz suave que sigue al puntero dentro de `container` (variables `--sx` y `--sy` del elemento `.spotlight`). Solo con mouse. */
export function useSpotlight(container: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = container.current;
    if (!el || reducedMotion() || !finePointer()) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--sx", `${(event.clientX - rect.left).toFixed(0)}px`);
        el.style.setProperty("--sy", `${(event.clientY - rect.top).toFixed(0)}px`);
        el.dataset.spot = "on";
      });
    };
    const leave = () => { cancelAnimationFrame(frame); delete el.dataset.spot; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(frame); };
  }, [container]);
}

/** Mientras el hero sale de pantalla: su contenido sube más lento y se atenúa (variable `--hp`, de 0 a 1). */
export function useHeroExit(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.8)));
        el.style.setProperty("--hp", p.toFixed(3));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => { window.removeEventListener("scroll", update); cancelAnimationFrame(frame); };
  }, [ref]);
}
