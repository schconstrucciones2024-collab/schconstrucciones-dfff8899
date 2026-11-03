import { CheckCircle2, Leaf, ShieldCheck } from "lucide-react";
import { Reveal } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const PILLARS = [
  { Icon: ShieldCheck, title: "Confianza", text: "Valores familiares y transparencia real." },
  { Icon: CheckCircle2, title: "Profesionalismo", text: "Resultados que hablan por sí solos." },
  { Icon: Leaf, title: "Sostenibilidad", text: "Soluciones modernas y procesos claros." },
];

export function Pillars() {
  return (
    <section id="pilares" aria-labelledby="pilares-title" className="surface-light">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal>
          <SectionHeading eyebrow="Nuestros pilares" title="Resultados que perduran décadas" id="pilares-title" />
          <p className="mt-8 max-w-3xl font-display text-xl font-medium leading-relaxed text-background/80 sm:text-2xl">
            Materiales premium + Planificación + Cumplimiento = Resultados que perduran décadas.
          </p>
        </Reveal>
        <ul className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {PILLARS.map(({ Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 110} className="border-t-2 border-primary pt-7">
              <Icon aria-hidden="true" className="size-7 text-primary" strokeWidth={1.5} />
              <h3 className="mt-6 font-display text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-base leading-7 text-background/70">{text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
