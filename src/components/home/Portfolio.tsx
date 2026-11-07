import { useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PROJECT_STORIES } from "@/data/projectStories";
import { ArrowUpRight } from "lucide-react";
import { PROJECTS, type Project } from "@/data/projects";
import { responsive } from "@/lib/img";
import { Reveal, useTilt } from "@/lib/motion";
import { Lightbox } from "./Lightbox";
import { SectionHeading } from "./SectionHeading";

/** Las portadas son afiches 4:5 con el título de la obra incluido: se muestran enteras, sin recortar. */
function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const image = responsive(project.src);
  const tiltRef = useRef<HTMLSpanElement>(null);
  useTilt(tiltRef, 3);
  return (
    <Button variant="ghost" type="button" onClick={onOpen} aria-label={`Ver galería de ${project.name}`} className="group block h-auto w-full whitespace-normal rounded-none p-0 text-left hover:bg-transparent">
      <span ref={tiltRef} className="tilt relative block aspect-[1600/1987] overflow-hidden bg-card">
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"
          alt={project.alt}
          width={1600}
          height={1987}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
        />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </span>
      <span className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-4 transition-colors duration-500 group-hover:border-primary">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{project.year}</span>
          <span className="mt-1.5 block font-display text-xl font-medium leading-snug">{project.name}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 pb-0.5 text-xs font-medium text-foreground/70 transition-colors group-hover:text-primary">
          {project.images.length} imágenes <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </span>
    </Button>
  );
}

export function Portfolio() {
  const [selected, setSelected] = useState<Project | null>(null);
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      <section id="proyectos" aria-labelledby="proyectos-title" className="surface-dark">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
          <Reveal>
            <SectionHeading eyebrow="Proyectos" title="Resultados que perduran" id="proyectos-title">
              <p className="mt-8 max-w-xl text-base leading-8 text-foreground/75 sm:text-lg">Viviendas, ampliaciones y espacios que forman nuestra historia en Punta del Diablo y Uruguay.</p>
            </SectionHeading>
          </Reveal>
          <ul className="portfolio-grid mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
            {PROJECTS.map((project, i) => (
              <Reveal as="li" key={project.alt} delay={(i % 3) * 90}>
                <ProjectCard project={project} onOpen={() => setSelected(project)} />
                {PROJECT_STORIES[i] && <Link to="/proyectos/$slug" params={{ slug: PROJECT_STORIES[i].slug }} className="mt-4 inline-flex min-h-11 items-center gap-3 border-b border-primary/50 text-xs uppercase text-primary">Conocer la obra <ArrowUpRight className="size-4" /></Link>}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
      {/* Fuera de la sección: así el visor queda por encima del header fijo (la sección crea su propio contexto de apilado). */}
      {selected && <Lightbox project={selected} onClose={close} />}
    </>
  );
}
