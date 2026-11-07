import { useRef } from "react";
import { Reveal, useSectionProgress } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const STEPS = [
  ["Primer contacto", "Conocemos tu idea, necesidades y objetivos."],
  ["Planificación", "Evaluamos el proyecto, sus características y posibilidades."],
  ["Presupuestación", "Presentamos una propuesta clara y detallada."],
  ["Ejecución", "Desarrollamos los trabajos con organización y seguimiento."],
  ["Entrega", "Finalizamos la obra y verificamos sus terminaciones."],
];

export function Process() {
  const listRef = useRef<HTMLOListElement>(null);
  useSectionProgress(listRef);
  return (
    <section id="proceso" aria-labelledby="proceso-title" className="texture-dark relative isolate bg-secondary">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal><SectionHeading eyebrow="Proceso de trabajo" title="De la primera idea a la entrega." id="proceso-title" /></Reveal>
        <ol ref={listRef} className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          <span aria-hidden="true" className="process-line absolute inset-x-0 top-0 hidden h-px bg-primary lg:block" />
          {STEPS.map(([title, step], i) => (
            <Reveal as="li" key={title} delay={i * 120} className="relative border-t border-foreground/20 pt-8">
              <span aria-hidden="true" className="absolute -top-px left-0 h-px w-16 bg-primary" />
              <span className="font-display text-6xl font-light leading-none text-primary">0{i + 1}</span>
              <h3 className="mt-6 font-display text-xl font-medium">{title}</h3>
              <p className="mt-3 max-w-[16rem] text-lg leading-8 text-foreground/85">{step}</p>
            </Reveal>
          ))}
        </ol>
        <Reveal className="mt-14 border-t border-border pt-8"><p className="max-w-3xl text-base leading-8 text-foreground/80">Materiales y pagos organizados según las etapas de ejecución acordadas. Trabajamos por avance de obra: cobramos lo ejecutado.</p></Reveal>
      </div>
    </section>
  );
}
