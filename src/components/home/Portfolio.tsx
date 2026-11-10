import { useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Expand, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROJECT_STORIES, type ProjectStory } from "@/data/projectStories";
import { whatsappUrl } from "@/lib/contactInquiry";
import { responsive } from "@/lib/img";
import { Reveal, useTilt } from "@/lib/motion";
import { Lightbox } from "./Lightbox";
import { SectionHeading } from "./SectionHeading";

/** Las portadas son afiches 4:5 con el título de la obra incluido: se muestran enteras, sin recortar. */
function Poster({ project, sizes, onOpen, priority = false }: { project: ProjectStory; sizes: string; onOpen: () => void; priority?: boolean }) {
  const image = responsive(project.src);
  const tiltRef = useRef<HTMLSpanElement>(null);
  useTilt(tiltRef, 3);
  return (
    <Button variant="ghost" type="button" onClick={onOpen} aria-label={`Ver galería de ${project.name}`} className="group block h-auto w-full whitespace-normal rounded-none p-0 text-left hover:bg-transparent">
      <span ref={tiltRef} className="tilt relative block aspect-[1600/1987] overflow-hidden bg-card">
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes={sizes}
          alt={project.alt}
          width={1600}
          height={1987}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05] motion-reduce:transition-none"
        />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-background/80 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground opacity-0 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Expand aria-hidden="true" className="size-3.5" /> {project.images.length} imágenes
        </span>
      </span>
    </Button>
  );
}

function FactRows({ project, limit }: { project: ProjectStory; limit?: number }) {
  return (
    <dl className="divide-y divide-border border-y border-border text-sm">
      {project.data.slice(0, limit).map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-foreground/60">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Obra más reciente, a gran formato: portada, datos documentados y acciones. */
function Featured({ project, onOpen }: { project: ProjectStory; onOpen: () => void }) {
  return (
    <Reveal className="grid items-center gap-10 border-t border-primary/40 pt-10 lg:grid-cols-12 lg:gap-16">
      <div className="mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none">
        <Poster project={project} sizes="(min-width: 1024px) 40vw, 92vw" onOpen={onOpen} priority />
      </div>
      <div className="lg:col-span-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">Obra más reciente · {project.year}</p>
        <h3 className="mt-4 font-display text-3xl font-medium leading-tight sm:text-5xl">{project.name}</h3>
        {project.location && <p className="mt-3 text-sm uppercase tracking-[0.18em] text-foreground/60">{project.location}</p>}
        <p className="mt-6 max-w-2xl text-base leading-8 text-foreground/80">{project.description}</p>
        <div className="mt-8 max-w-xl"><FactRows project={project} /></div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-auto min-h-12 rounded-none px-6 py-3 text-xs uppercase tracking-[0.14em]">
            <Link to="/proyectos/$slug" params={{ slug: project.slug }}>Conocer la obra <ArrowUpRight aria-hidden="true" /></Link>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-12 rounded-none px-6 py-3 text-xs uppercase tracking-[0.14em]">
            <a href={whatsappUrl(`Hola SCH, vi el proyecto ${project.name} y quiero consultar por mi obra.`)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Quiero algo así</a>
          </Button>
        </div>
      </div>
    </Reveal>
  );
}

function Card({ project, index, onOpen }: { project: ProjectStory; index: number; onOpen: () => void }) {
  return (
    <Reveal as="li" delay={(index % 3) * 90}>
      <Poster project={project} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw" onOpen={onOpen} />
      <div className="mt-5 border-t border-border pt-4 transition-colors duration-500 hover:border-primary">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{project.year}{project.location ? ` · ${project.location.split(",")[0]}` : ""}</p>
        <h3 className="mt-1.5 font-display text-xl font-medium leading-snug">{project.name}</h3>
        <p className="mt-2 text-sm leading-6 text-foreground/65">{project.subtitle}</p>
        <div className="mt-4"><FactRows project={project} limit={index % 2 === 0 ? 3 : 4} /></div>
        <Link to="/proyectos/$slug" params={{ slug: project.slug }} className="group mt-3 inline-flex min-h-11 items-center gap-2 border-b border-primary/50 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:border-primary">
          Conocer la obra <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </Reveal>
  );
}

export function Portfolio() {
  const [selected, setSelected] = useState<ProjectStory | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const [featured, ...rest] = PROJECT_STORIES;

  return (
    <>
      <section id="proyectos" aria-labelledby="proyectos-title" className="surface-dark">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
          <Reveal>
            <SectionHeading eyebrow="Proyectos" title="Resultados que perduran" id="proyectos-title">
              <p className="mt-8 max-w-xl text-base leading-8 text-foreground/75 sm:text-lg">Obras reales de SCH, con las superficies y los espacios documentados en cada ficha. Tocá una portada para ver la galería o entrá a la obra para conocer su historia.</p>
            </SectionHeading>
          </Reveal>
          <div className="mt-16">
            {featured && <Featured project={featured} onOpen={() => setSelected(featured)} />}
          </div>
          <ul className="masonry mt-20" aria-label="Más obras de SCH Construcciones">
            {rest.map((project, i) => <Card key={project.slug} project={project} index={i} onOpen={() => setSelected(project)} />)}
          </ul>
        </div>
      </section>
      {/* Fuera de la sección: así el visor queda por encima del header fijo (la sección crea su propio contexto de apilado). */}
      {selected && <Lightbox project={selected} onClose={close} />}
    </>
  );
}
