import { useRef } from "react";
import { Reveal, useSectionProgress } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const STEPS = [
  "Análisis de tu idea/plano.",
  "Presupuesto transparente y sin costo.",
  "Ejecución premium (Tradicional o Wood Frame).",
  "Entrega de tu nuevo hogar.",
];

export function Process() {
  const listRef = useRef<HTMLOListElement>(null);
  useSectionProgress(listRef);
  return (
    <section id="proceso" aria-labelledby="proceso-title" className="texture-dark relative isolate bg-secondary">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal><SectionHeading eyebrow="Proceso de trabajo" title="Cuatro pasos. Un resultado impecable." id="proceso-title" /></Reveal>
        <ol ref={listRef} className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <span aria-hidden="true" className="process-line absolute inset-x-0 top-0 hidden h-px bg-primary lg:block" />
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step} delay={i * 120} className="relative border-t border-foreground/20 pt-8">
              <span aria-hidden="true" className="absolute -top-px left-0 h-px w-16 bg-primary" />
              <span className="font-display text-6xl font-light leading-none text-primary">0{i + 1}</span>
              <p className="mt-8 max-w-[16rem] text-lg leading-8 text-foreground/85">{step}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
