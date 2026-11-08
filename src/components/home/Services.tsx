import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICE_LINKS } from "@/data/servicios";
import { whatsappUrl } from "@/lib/contactInquiry";
import { Reveal } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const GROUPS = [
  {
    question: "¿Tenés un terreno y querés construir?",
    title: "Obra nueva",
    items: ["Construcción de viviendas", "Wood Frame", "Construcción tradicional", "Obra nueva"],
    value: "Planificamos y ejecutamos tu vivienda con el sistema que mejor se adapta a tu terreno, tiempos y presupuesto.",
    message: "Hola SCH, quiero consultar por la construcción de una vivienda.",
  },
  {
    question: "¿Querés ampliar tu vivienda?",
    title: "Ampliaciones y remodelaciones",
    items: ["Ampliaciones", "Remodelaciones", "Reformas integrales"],
    value: "Sumamos espacio y funcionalidad a lo que ya tenés, integrando la obra nueva con la existente.",
    message: "Hola SCH, estoy interesado en una ampliación.",
  },
  {
    question: "¿Necesitás renovar tu propiedad?",
    title: "Terminaciones e instalaciones",
    items: ["Drywall y yeso", "Pintura", "Instalaciones eléctricas completas", "Instalaciones sanitarias completas"],
    value: "Resolvemos terminaciones e instalaciones completas para que tu propiedad funcione y se vea como corresponde.",
    message: "Hola SCH, necesito renovar mi propiedad.",
  },
];

export function Services() {
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="surface-dark">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal><SectionHeading eyebrow="Servicios" title="Una solución para cada etapa de tu propiedad" id="servicios-title" /></Reveal>
        <ul className="mt-14 grid gap-px border border-border bg-border lg:grid-cols-3">
          {GROUPS.map((g, i) => (
            <Reveal as="li" key={g.title} delay={i * 110} className="group relative flex flex-col bg-background p-8 sm:p-10">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-700 group-hover:scale-x-100 motion-reduce:transition-none" />
              <span className="font-display text-sm text-primary">0{i + 1}</span>
              <p className="mt-6 font-display text-2xl font-medium leading-snug">{g.question}</p>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60">{g.title}</h3>
              <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm text-foreground/85">
                {g.items.map((item) => <li key={item} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-primary" />{item}</li>)}
              </ul>
              <p className="mt-6 flex-1 text-base leading-7 text-foreground/70">{g.value}</p>
              <Button asChild className="mt-8 h-auto min-h-12 rounded-none whitespace-normal px-5 py-3 text-xs uppercase tracking-[0.14em]">
                <a href={whatsappUrl(g.message)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Consultar por WhatsApp</a>
              </Button>
            </Reveal>
          ))}
        </ul>
        <Reveal className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-foreground/60">Conocé cada servicio en detalle</p>
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
