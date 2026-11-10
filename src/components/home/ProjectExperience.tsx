import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Expand, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROJECT_STORIES, type ProjectStory } from '@/data/projectStories';
import { beforeAfterFor } from '@/data/beforeAfter';
import { SITE_URL } from '@/data/servicios';
import { whatsappUrl } from '@/lib/contactInquiry';
import { Reveal } from '@/lib/motion';
import { BeforeAfter } from './BeforeAfter';
import { Lightbox } from './Lightbox';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { ConversionEvents } from './ConversionEvents';
import { ShareButtons } from './ShareButtons';

const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.22em] text-primary';

export function ProjectExperience({ project }: { project: ProjectStory }) {
  const [open, setOpen] = useState(false);
  const index = PROJECT_STORIES.findIndex(p => p.slug === project.slug);
  const next = PROJECT_STORIES[(index + 1) % PROJECT_STORIES.length];
  const pairs = beforeAfterFor(project.slug);
  const url = `${SITE_URL}/proyectos/${project.slug}`;
  const facts: [string, string][] = [
    ['Proyecto', project.name],
    ...(project.location ? [['Ubicación', project.location] as [string, string]] : []),
    ['Año', project.year],
    ...project.data,
  ];
  return <>
    <SiteHeader home={false} /><ConversionEvents />
    <main id="contenido" className="overflow-x-clip">
      <section className="relative isolate min-h-[88svh] overflow-hidden bg-background" aria-labelledby="obra-title">
        <picture className="absolute inset-0 -z-20"><source media="(max-width: 767px)" srcSet={project.photoSmall} /><img src={project.photo} alt={project.alt} fetchPriority="high" width={1600} height={1987} className={`h-full w-full ${project.photo === project.src ? 'object-contain' : 'object-cover'}`} /></picture>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-background/20" />
        <div className="mx-auto flex min-h-[88svh] max-w-7xl flex-col justify-end px-5 pb-14 pt-32 lg:px-8">
          <Link to="/" hash="proyectos" className="mb-8 inline-flex min-h-11 items-center gap-2 self-start text-xs uppercase tracking-[0.14em] text-foreground/85 transition-colors hover:text-primary"><ArrowLeft className="size-4" /> Todas las obras</Link>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">SCH Construcciones · {project.year}{project.location ? ` · ${project.location}` : ''}</p>
          <h1 id="obra-title" className="mt-4 font-display text-4xl font-medium sm:text-6xl lg:text-7xl">{project.name}</h1>
          <p className="mt-5 max-w-2xl text-lg text-foreground/85">{project.subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={() => setOpen(true)} className="h-auto min-h-12 rounded-none px-6 py-3"><Expand /> Ver galería</Button>
            <Button asChild variant="outline" className="h-auto min-h-12 rounded-none bg-background/50 px-6 py-3"><a href={whatsappUrl(`Hola SCH, vi el proyecto ${project.name} y quiero consultar por mi obra.`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Quiero algo así</a></Button>
          </div>
        </div>
      </section>

      <section className="surface-light" aria-labelledby="intervencion-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-2 lg:gap-20 lg:px-8 lg:py-28">
          <Reveal>
            <p className={labelClass}>La intervención</p>
            <h2 id="intervencion-title" className="mt-5 font-display text-3xl font-medium sm:text-4xl">{project.subtitle}</h2>
            <p className="mt-7 max-w-xl text-base leading-8 text-background/75">{project.description}</p>
            {project.spaces.length > 0 && (
              <>
                <h3 className="mt-10 text-xs font-semibold uppercase tracking-[0.22em] text-background/60">Espacios y trabajos</h3>
                <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {project.spaces.map(space => <li key={space} className="flex gap-3 text-sm leading-6 text-background/80"><span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-primary" />{space}</li>)}
                </ul>
              </>
            )}
            {project.note && <p className="mt-8 border-l-2 border-primary pl-4 text-sm leading-7 text-background/70">{project.note}</p>}
          </Reveal>
          <Reveal>
            <h3 className="sr-only">Ficha de la obra</h3>
            <dl className="divide-y divide-background/15 border-y border-background/15">
              {facts.map(([label, value]) => <div key={label} className="grid grid-cols-2 gap-4 py-5"><dt className="text-xs uppercase tracking-[0.14em] text-background/60">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>)}
            </dl>
            <p className="mt-5 text-sm leading-7 text-background/65">Datos tomados de la ficha original de la obra, que también encontrás en la galería.</p>
            <Button asChild className="mt-7 h-auto min-h-14 rounded-none whitespace-normal px-6 py-4"><a href={whatsappUrl(`Hola SCH, vi el proyecto ${project.name} y quiero hablar de mi proyecto.`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Quiero hablar de mi proyecto</a></Button>
          </Reveal>
        </div>
      </section>

      {pairs.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pt-20 lg:px-8" aria-labelledby="antes-despues-title">
          <h2 id="antes-despues-title" className="font-display text-3xl font-medium">Antes y después</h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">{pairs.map(pair => <BeforeAfter key={pair.before} pair={pair} />)}</div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8" aria-labelledby="archivo-title">
        <h2 id="archivo-title" className="font-display text-3xl font-medium">Archivo de la obra</h2>
        <div className="mt-10 grid items-start gap-6 sm:grid-cols-2">
          {project.images.map((image, i) => <Button key={image} onClick={() => setOpen(true)} variant="ghost" aria-label={`Ampliar imagen ${i + 1} de ${project.name}`} className="h-auto w-full rounded-none p-0 hover:bg-transparent"><img src={image} alt={`${project.name}: ${i === 0 ? 'presentación de la obra' : 'documentación original ' + i}`} width={1600} height={1987} loading="lazy" className="h-auto w-full transition-transform duration-700 hover:scale-[1.02] motion-reduce:transition-none" /></Button>)}
        </div>

        <div className="mt-16 border-t border-border pt-10">
          <h2 className="font-display text-2xl font-medium">Compartí esta obra</h2>
          <div className="mt-6"><ShareButtons url={url} title={`${project.name} · SCH Construcciones`} text={project.subtitle} item={project.slug} /></div>
        </div>

        {next && <Link to="/proyectos/$slug" params={{ slug: next.slug }} className="group mt-12 flex items-center justify-between gap-5 border-t border-border py-8"><span><span className="text-xs uppercase tracking-[0.2em] text-primary">Siguiente obra</span><span className="mt-2 block font-display text-2xl">{next.name}</span></span><ArrowRight className="size-6 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" /></Link>}
      </section>
    </main><SiteFooter home={false} /><FloatingWhatsApp />
    {open && <Lightbox project={project} onClose={() => setOpen(false)} />}
  </>;
}
