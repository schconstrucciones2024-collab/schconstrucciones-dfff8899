import { PROJECTS, type Project } from './projects';
import { HERO_SCENES } from './heroScenes';
import { PROJECT_FACTS, type ProjectFacts } from './projectFacts';

/** Orden y nombres de las obras: slug de la URL y nombre del portfolio (src/data/projects.ts). */
const DETAILS = [
  ['barbacoa', 'Barbacoa · Punta del Diablo'],
  ['laslu', 'Laslu'],
  ['ampliacion-en-proceso', 'Ampliación en proceso'],
  ['mi-sueno', 'Mi Sueño'],
  ['lo-de-cata', 'Lo de Cata'],
  ['proyecto-2021', 'Cabaña en el bosque'],
  ['ampliacion', 'Ampliación'],
  ['transformacion-contenedor', 'Transformación de contenedor'],
  ['la-diosa', 'La Diosa'],
  ['pequenas-diablitas', 'Pequeñas Diablitas'],
  ['le-sirenuse', 'Le Sirenuse'],
  ['complejo-alvear', 'Complejo Alvear'],
] as const;

export type ProjectStory = Project & Omit<ProjectFacts, 'description'> & { slug: string; description: string; photo: string; photoSmall: string };

export const PROJECT_STORIES: ProjectStory[] = DETAILS.flatMap(([slug, name]) => {
  const project = PROJECTS.find(p => p.name === name);
  const facts = PROJECT_FACTS[slug];
  if (!project || !facts) return [];
  const scene = HERO_SCENES.find(s => s.id === slug);
  return [{ ...project, ...facts, slug, photo: scene?.src ?? project.src, photoSmall: scene?.small ?? project.src }];
});
export const projectPaths = () => PROJECT_STORIES.map(p => ({ path: `/proyectos/${p.slug}` }));
