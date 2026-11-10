import { createFileRoute, notFound } from '@tanstack/react-router';
import { ProjectExperience } from '@/components/home/ProjectExperience';
import { PROJECT_STORIES } from '@/data/projectStories';
import { projectJsonLd } from '@/data/projectSeo';
import { publicPageHead, SITE_URL } from '@/data/servicios';

export const Route = createFileRoute('/proyectos/$slug')({
  staticData: { sitemap: true },
  loader: ({ params }) => {
    const project = PROJECT_STORIES.find(p => p.slug === params.slug);
    if (!project) throw notFound();
    return project;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: 'Obra no disponible | SCH Construcciones' }, { name: 'robots', content: 'noindex' }] };
    const title = `${loaderData.name} | Obras de SCH Construcciones`;
    const base = publicPageHead(`/proyectos/${loaderData.slug}`, title, loaderData.description);
    // Stable social image: the exact original cover shown in the page's archive.
    const image = `${SITE_URL}${loaderData.src}`;
    return { ...base, meta: [...base.meta, { property: 'og:image', content: image }, { name: 'twitter:image', content: image }, { property: 'og:image:alt', content: loaderData.alt }], scripts: projectJsonLd(loaderData).map(data => ({ type: 'application/ld+json', children: JSON.stringify(data) })) };
  },
  component: ProjectRoute,
});
function ProjectRoute() { const project = Route.useLoaderData(); return <ProjectExperience key={project.slug} project={project} />; }