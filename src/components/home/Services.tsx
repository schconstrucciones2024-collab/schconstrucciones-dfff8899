import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICE_GROUPS } from "@/data/serviceCatalog";
import { SERVICE_LINKS } from "@/data/servicios";
import { whatsappUrl } from "@/lib/contactInquiry";
import { Reveal } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const COLUMNS: Record<number, string> = { 3: "lg:grid-cols-3", 4: "xl:grid-cols-4" };
const labelClass = "text-[10px] font-semibold uppercase tracking-[0.22em] text-primary";

export function Services() {
  return (
    <section id="servicios" aria-labelledby="servicios-title" className="surface-dark">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal>
          <SectionHeading eyebrow="Servicios" title="Una solución para cada etapa de tu propiedad" id="servicios-title">
            <p className="mt-8 max-w-3xl text-base leading-8 text-foreground/75 sm:text-lg">
              Once servicios en tres caminos. Elegí el que se parece a tu situación y escribinos: cada botón abre WhatsApp con un mensaje listo sobre ese servicio.
            </p>
          </SectionHeading>
        </Reveal>

        {SERVICE_GROUPS.map((group, g) => (
          <div key={group.id} className="mt-16 first-of-type:mt-14">
            <Reveal className="flex flex-col gap-6 border-t border-primary/40 pt-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className={labelClass}>0{g + 1} · {group.title}</p>
                <h3 className="mt-3 font-display text-2xl font-medium leading-snug sm:text-3xl">{group.question}</h3>
              </div>
              <Button asChild className="group h-auto min-h-12 shrink-0 rounded-none whitespace-normal px-6 py-3 text-xs uppercase tracking-[0.14em]">
                <a href={whatsappUrl(group.message)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" /> {group.cta} <ArrowRight aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
                </a>
              </Button>
            </Reveal>

            <ul className={`mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 ${COLUMNS[group.services.length] ?? "lg:grid-cols-3"}`}>
              {group.services.map((service, i) => (
                <Reveal as="li" key={service.id} delay={i * 80} className="group/card relative flex flex-col bg-background p-6 sm:p-7">
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-700 group-hover/card:scale-x-100 motion-reduce:transition-none" />
                  <h4 className="font-display text-xl font-medium leading-snug">{service.title}</h4>
                  <dl className="mt-5 flex-1 space-y-4 text-sm leading-6">
                    <div><dt className={labelClass}>Qué resuelve</dt><dd className="mt-1.5 text-foreground/75">{service.problem}</dd></div>
                    <div><dt className={labelClass}>Qué aporta</dt><dd className="mt-1.5 text-foreground/75">{service.value}</dd></div>
                  </dl>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-4">
                    <a href={whatsappUrl(service.message)} target="_blank" rel="noopener noreferrer" aria-label={`Consultar por WhatsApp: ${service.title}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:text-foreground">
                      <MessageCircle aria-hidden="true" className="size-4" /> Consultar
                    </a>
                    {service.to && (
                      <Link to={service.to} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-foreground/70 transition-colors hover:text-primary">
                        Ver detalle <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        ))}

        <Reveal className="mt-14 flex flex-col gap-4 sm:flex-row sm:items-center">
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
