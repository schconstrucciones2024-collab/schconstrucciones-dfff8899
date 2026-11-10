import { SITE_URL } from "./servicios";
import type { ProjectStory } from "./projectStories";

/** Datos estructurados (schema.org) de la página de una obra: la obra misma y su ruta de navegación. */
export function projectJsonLd(project: Pick<ProjectStory, "slug" | "name" | "description" | "src" | "location">) {
  const url = `${SITE_URL}/proyectos/${project.slug}`;
  const image = `${SITE_URL}${project.src}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: project.name,
      description: project.description,
      url,
      image,
      ...(project.location ? { locationCreated: { "@type": "Place", name: project.location } } : {}),
      creator: { "@type": "GeneralContractor", name: "SCH Construcciones", url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Proyectos", item: `${SITE_URL}/#proyectos` },
        { "@type": "ListItem", position: 3, name: project.name, item: url },
      ],
    },
  ];
}
