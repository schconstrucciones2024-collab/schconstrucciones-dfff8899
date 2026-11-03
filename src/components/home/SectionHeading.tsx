import type { ReactNode } from "react";
import { Words } from "@/lib/motion";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  /** Id del `h2` (para `aria-labelledby` de la sección). */
  id: string;
  className?: string;
  children?: ReactNode;
};

/** Encabezado de sección: rótulo con filete + título. Hereda el color de la superficie donde esté (clara u oscura). */
export function SectionHeading({ eyebrow, title, id, className = "", children }: SectionHeadingProps) {
  return (
    <div className={className}>
      <p className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs">
        <span aria-hidden="true" className="h-px w-10 bg-primary" />
        {eyebrow}
      </p>
      <h2 id={id} className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] sm:text-5xl lg:text-6xl"><Words text={title} /></h2>
      {children}
    </div>
  );
}
