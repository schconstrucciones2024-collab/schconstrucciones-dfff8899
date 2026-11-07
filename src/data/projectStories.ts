import { PROJECTS, type Project } from './projects';
import { HERO_SCENES } from './heroScenes';

const DETAILS = [
  ['barbacoa', 'Barbacoa · Punta del Diablo', 'Un espacio para compartir', 'Proyecto de barbacoa en Punta del Diablo. La galería conserva la presentación y los datos originales de la obra.'],
  ['laslu', 'Laslu', 'Una vivienda con identidad propia', 'Laslu es una obra de SCH Construcciones en Punta del Diablo, presentada en el portfolio de 2024.'],
  ['ampliacion-en-proceso', 'Ampliación en proceso', 'Crecer desde lo existente', 'Una ampliación documentada durante su ejecución en 2023. Las imágenes conservan el estado en proceso de la intervención.'],
  ['mi-sueno', 'Mi Sueño', 'Un hogar, una historia', 'Mi Sueño forma parte de las viviendas de SCH Construcciones en Punta del Diablo. Las fotografías y la ficha original documentan el proyecto de 2023.'],
  ['lo-de-cata', 'Lo de Cata', 'La casa celeste junto a la piscina', 'La vivienda Lo de Cata, en Punta del Diablo, es una de las obras protagonistas de SCH. Su fotografía con piscina forma parte de la identidad del sitio.'],
  ['proyecto-2021', 'Cabaña en el bosque', 'Habitar entre los árboles', 'Una cabaña del portfolio de 2021 en Punta del Diablo. La obra y su entorno se conservan en las imágenes originales del proyecto.'],
  ['ampliacion', 'Ampliación', 'Más posibilidades para una vivienda', 'Intervención de ampliación realizada entre 2020 y 2021. La presentación original reúne las imágenes y los datos documentados de la obra.'],
  ['transformacion-contenedor', 'Transformación de contenedor', 'Una nueva vida para un espacio', 'Transformación de un contenedor realizada por SCH Construcciones. La galería muestra la presentación y la ficha originales.'],
  ['la-diosa', 'La Diosa', 'La Clave del Diablo', 'La Diosa – La Clave del Diablo es una obra de Punta del Diablo documentada en el portfolio de 2019–2020.'],
  ['pequenas-diablitas', 'Pequeñas Diablitas', 'Construir en Punta del Diablo', 'Pequeñas Diablitas forma parte del portfolio de 2015, año en que la familia comenzó a construir en Punta del Diablo.'],
  ['le-sirenuse', 'Le Sirenuse', 'Parte de nuestra trayectoria', 'Un proyecto de la trayectoria de SCH. La galería conserva su presentación y las imágenes que cuentan su historia.'],
  ['complejo-alvear', 'Complejo Alvear', 'Obras que forman nuestra historia', 'Complejo Alvear forma parte de la trayectoria de SCH Construcciones. Sus imágenes originales presentan el proyecto y su historia.'],
] as const;

export type ProjectStory = Project & { slug: string; subtitle: string; description: string; photo: string; photoSmall: string; location?: string };
export const PROJECT_STORIES: ProjectStory[] = DETAILS.flatMap(([slug, name, subtitle, description]) => {
  const project = PROJECTS.find(p => p.name === name);
  if (!project) return [];
  const scene = HERO_SCENES.find(s => s.id === slug);
  return [{ ...project, slug, subtitle, description, photo: scene?.src ?? project.src, photoSmall: scene?.small ?? project.src, ...(project.alt.includes('Punta del Diablo') || name === 'Pequeñas Diablitas' ? { location: 'Punta del Diablo, Rocha' } : {}) }];
});
export const projectPaths = () => PROJECT_STORIES.map(p => ({ path: `/proyectos/${p.slug}` }));