import { Reveal } from "@/lib/motion";
import { CONTACT } from "@/data/projects";
import { SectionHeading } from "./SectionHeading";
import { SOCIALS } from "./socialLinks";

export function Social() {
  return (
    <section id="redes" aria-labelledby="redes-title" className="surface-dark border-t border-border">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal>
          <SectionHeading eyebrow="Redes sociales" title="Viví cada obra, paso a paso" id="redes-title">
            <p className="mt-8 max-w-3xl text-base leading-8 text-foreground/75 sm:text-lg">
              Si querés ver imágenes de los procesos de los proyectos y todas las imágenes de los proyectos, visitá exclusivamente nuestro{" "}
              <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary">Instagram</a>
              , donde también encontrás tips, procesos y mucho más. Todo el contenido también está en nuestras demás redes.
            </p>
          </SectionHeading>
        </Reveal>
        <ul className="mt-14 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SOCIALS.map(({ Icon, label, handle, href }, i) => (
            <Reveal as="li" key={label} delay={(i % 3) * 90} className="bg-background">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} de SCH Construcciones · ${handle}`}
                className="group flex min-h-24 items-center gap-5 px-6 py-5 transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
              >
                <Icon size={24} className="shrink-0 text-primary transition-colors duration-300 group-hover:text-primary-foreground" />
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-lg font-semibold">{label}</span>
                  <span className="mt-1 text-sm text-foreground/65 transition-colors duration-300 group-hover:text-primary-foreground/80">{handle}</span>
                </span>
              </a>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
