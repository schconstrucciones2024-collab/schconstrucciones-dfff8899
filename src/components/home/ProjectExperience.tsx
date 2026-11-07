import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, MessageCircle, Share2, Expand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROJECT_STORIES, type ProjectStory } from '@/data/projectStories';
import { SITE_URL } from '@/data/servicios';
import { whatsappUrl } from '@/lib/contactInquiry';
import { Reveal } from '@/lib/motion';
import { Lightbox } from './Lightbox';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { ConversionEvents, conversionEvent } from './ConversionEvents';

export function ProjectExperience({ project }: { project: ProjectStory }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const index = PROJECT_STORIES.findIndex(p => p.slug === project.slug);
  const next = PROJECT_STORIES[(index + 1) % PROJECT_STORIES.length];
  const share = async () => {
    const url = `${SITE_URL}/proyectos/${project.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: `${project.name} · SCH Construcciones`, text: project.subtitle, url });
      else { await navigator.clipboard.writeText(url); setStatus('Enlace copiado.'); }
      conversionEvent('project_share', { section: 'proyecto', item: project.slug });
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('Podés compartir el enlace de esta página.'); }
  };
  return <>
    <SiteHeader home={false} /><ConversionEvents />
    <main id="contenido" className="overflow-x-clip">
      <section className="relative isolate min-h-[88svh] overflow-hidden bg-background" aria-labelledby="obra-title">
        <picture className="absolute inset-0 -z-20"><source media="(max-width: 767px)" srcSet={project.photoSmall} /><img src={project.photo} alt={project.alt} fetchPriority="high" width={1600} height={1987} className={`h-full w-full ${project.photo === project.src ? 'object-contain' : 'object-cover'}`} /></picture>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-background/20" />
        <div className="mx-auto flex min-h-[88svh] max-w-7xl flex-col justify-end px-5 pb-14 pt-32 lg:px-8">
          <Link to="/" hash="proyectos" className="mb-8 inline-flex min-h-11 items-center gap-2 self-start text-xs uppercase text-foreground/85"><ArrowLeft className="size-4" /> Todas las obras</Link>
          <p className="text-xs uppercase text-primary">SCH Construcciones · {project.year}</p>
          <h1 id="obra-title" className="mt-4 font-display text-4xl font-medium sm:text-6xl lg:text-7xl">{project.name}</h1>
          <p className="mt-5 text-lg text-foreground/85">{project.subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={() => setOpen(true)} className="h-auto min-h-12 rounded-none px-6 py-3"><Expand /> Ver galería</Button>
            <Button onClick={share} variant="outline" className="h-auto min-h-12 rounded-none bg-background/50 px-6 py-3"><Share2 /> Compartir obra</Button>
          </div><p role="status" className="mt-3 text-sm text-primary">{status}</p>
        </div>
      </section>
      <section className="surface-light">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <Reveal><p className="text-xs uppercase text-primary">La intervención</p><h2 className="mt-5 font-display text-3xl font-medium sm:text-4xl">{project.subtitle}</h2><p className="mt-7 max-w-xl text-base leading-8 text-background/75">{project.description}</p></Reveal>
          <Reveal><dl className="divide-y divide-background/15 border-y border-background/15">
            {[["Proyecto", project.name], ...(project.location ? [["Ubicación", project.location]] : []), ["Portfolio", project.year]].map(([label, value]) => <div key={label} className="grid grid-cols-2 gap-4 py-5"><dt className="text-xs uppercase text-background/60">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>)}
          </dl><p className="mt-5 text-sm leading-7 text-background/65">Las fichas originales de la galería conservan la información documentada de esta obra.</p>
          <Button asChild className="mt-7 h-auto min-h-14 rounded-none whitespace-normal px-6 py-4"><a href={whatsappUrl(`Hola SCH, vi el proyecto ${project.name} y quiero consultar por mi obra.`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Quiero hablar de mi proyecto</a></Button></Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8" aria-labelledby="archivo-title">
        <h2 id="archivo-title" className="font-display text-3xl font-medium">Archivo de la obra</h2>
        <div className="mt-10 grid items-start gap-6 sm:grid-cols-2">
          {project.images.map((image, i) => <Button key={image} onClick={() => setOpen(true)} variant="ghost" aria-label={`Ampliar imagen ${i + 1} de ${project.name}`} className="h-auto w-full rounded-none p-0 hover:bg-transparent"><img src={image} alt={`${project.name}: ${i === 0 ? 'presentación de la obra' : 'documentación original ' + i}`} width={1600} height={1987} loading="lazy" className="h-auto w-full" /></Button>)}
        </div>
        {next && <Link to="/proyectos/$slug" params={{ slug: next.slug }} className="mt-16 flex items-center justify-between gap-5 border-t border-border py-8"><span><span className="text-xs uppercase text-primary">Siguiente obra</span><span className="mt-2 block font-display text-2xl">{next.name}</span></span><ArrowRight className="size-6" /></Link>}
      </section>
    </main><SiteFooter home={false} /><FloatingWhatsApp />
    {open && <Lightbox project={project} onClose={() => setOpen(false)} />}
  </>;
}