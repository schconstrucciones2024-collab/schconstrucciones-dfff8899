import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Hammer, Ruler } from "lucide-react";
import { SERVICE_LINKS } from "@/data/servicios";
import { Reveal } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const SERVICES = [
  { Icon: Building2, title: "Sistema Tradicional y Wood Frame", text: "Construcción rápida, eficiente y para toda la vida." },
  { Icon: Hammer, title: "Reformas y Ampliaciones", text: "Transformamos tus ideas en espacios reales." },
  { Icon: Ruler, title: "Proyectos Integrales", text: "Diseño, eficiencia y terminaciones premium." },
];

export function Services() {
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="surface-dark">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal><SectionHeading eyebrow="Qué hacemos" title="Soluciones para cada etapa" id="servicios-title" /></Reveal>
        <ul className="mt-14 grid divide-y divide-border border border-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {SERVICES.map(({ Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 110} className="group relative p-8 transition-colors duration-500 hover:bg-foreground/[0.04] sm:p-10">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-700 ease-out group-hover:scale-x-100 motion-reduce:transition-none" />
              <Icon aria-hidden="true" className="size-8 text-primary" strokeWidth={1.5} />
              <span className="mt-12 block font-display text-sm font-medium tracking-[0.2em] text-primary">0{i + 1}</span>
              <h3 className="mt-3 font-display text-2xl font-medium leading-snug">{title}</h3>
              <p className="mt-4 text-base leading-7 text-foreground/70">{text}</p>
            </Reveal>
          ))}
        </ul>
        <Reveal className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-foreground/60">Conocé cada sistema en detalle</p>
          <ul className="flex flex-wrap gap-3">
            {SERVICE_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="group inline-flex min-h-11 items-center gap-2 border border-foreground/25 px-5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
                  {link.label} <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
