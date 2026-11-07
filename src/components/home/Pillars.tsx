import { CheckCircle2, Ruler, ShieldCheck, History } from "lucide-react";
import { Reveal } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const PILLARS = [
  { Icon: ShieldCheck, title: "Confianza", text: "Una empresa familiar que entiende la responsabilidad de construir para otras familias." },
  { Icon: History, title: "Experiencia", text: "Más de 40 años de trayectoria familiar. Desde 2015, construyendo en Punta del Diablo." },
  { Icon: CheckCircle2, title: "Profesionalismo", text: "Planificación, organización, ejecución y atención a los detalles en cada etapa." },
  { Icon: Ruler, title: "Eficiencia", text: "Soluciones constructivas adaptadas a tu proyecto y a las necesidades de tu familia." },
];

export function Pillars() {
  return (
    <section id="pilares" aria-labelledby="pilares-title" className="surface-light">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal>
          <SectionHeading eyebrow="Nuestros pilares" title="Construir es una responsabilidad." id="pilares-title" />
          <p className="mt-8 max-w-3xl font-display text-xl font-medium leading-relaxed text-background/80 sm:text-2xl">
            Materiales premium + Planificación + Cumplimiento = Construir es una responsabilidad..
          </p>
        </Reveal>
        <ul className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 md:gap-10">
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
