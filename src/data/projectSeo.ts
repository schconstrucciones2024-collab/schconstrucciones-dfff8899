import { COPYRIGHT_HOLDER, copyrightNotice } from "@/config/legal";
import { SITE_URL } from "./servicios";
import type { ProjectStory } from "./projectStories";

/** Título de la pestaña y de la vista previa de una obra. Las obras anteriores a SCH lo dicen, para no atribuírselas a la marca. */
export const projectPageTitle = (project: Pick<ProjectStory, "name" | "preSCH">): string =>
  project.preSCH ? `${project.name} | Antes de SCH: obra de la Familia Sánchez` : `${project.name} | Obras de SCH Construcciones`;

/** Quién hizo la obra: SCH Construcciones o, en las obras anteriores a la marca, la Familia Sánchez. */
const creatorOf = (preSCH?: boolean) =>
  preSCH
    ? { "@type": "Organization", name: "Familia Sánchez", url: SITE_URL, description: "Familia de constructores que hoy trabaja bajo el nombre de SCH Construcciones." }
    : { "@type": "GeneralContractor", name: "SCH Construcciones", url: SITE_URL };

/** Datos estructurados (schema.org) de la página de una obra: la obra misma y su ruta de navegación. */
export function projectJsonLd(project: Pick<ProjectStory, "slug" | "name" | "description" | "src" | "location" | "preSCH">) {
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
      creator: creatorOf(project.preSCH),
      copyrightHolder: { "@type": "Organization", name: COPYRIGHT_HOLDER, url: SITE_URL },
      copyrightNotice: copyrightNotice(),
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
