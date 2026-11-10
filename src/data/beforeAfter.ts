/**
 * Pares "antes y después" con fotografías reales de SCH.
 *
 * Por ahora no hay ningún par documentado entre las fotos cargadas, así que la lista está vacía y la sección
 * "Antes y después" no se muestra en ninguna obra (no se inventan imágenes).
 *
 * Para sumar uno: subir las dos fotos a public/images/ (por ejemplo `antes-despues/la-diosa-antes.webp` y
 * `antes-despues/la-diosa-despues.webp`) y agregar acá una línea con el slug de la obra.
 */
export type BeforeAfterPair = {
  /** Slug de la obra (ver src/data/projectStories.ts). */
  slug: string;
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  caption?: string;
};

export const BEFORE_AFTER: BeforeAfterPair[] = [];

export const beforeAfterFor = (slug: string): BeforeAfterPair[] => BEFORE_AFTER.filter((pair) => pair.slug === slug);
