import laslu from '@/assets/premium/laslu-1600.webp.asset.json';
import lasluSmall from '@/assets/premium/laslu-800.webp.asset.json';
import diosa from '@/assets/premium/la-diosa-1600.webp.asset.json';
import diosaSmall from '@/assets/premium/la-diosa-800.webp.asset.json';
import bosque from '@/assets/premium/proyecto-2021-1600.webp.asset.json';
import bosqueSmall from '@/assets/premium/proyecto-2021-800.webp.asset.json';
import sueno from '@/assets/premium/mi-sueno-1600.webp.asset.json';
import suenoSmall from '@/assets/premium/mi-sueno-800.webp.asset.json';

/**
 * `focus`: punto de la foto que se conserva cuando el escritorio recorta arriba y abajo (object-position).
 * En celular ninguna foto se recorta: se muestra entera sobre un fondo desenfocado de la misma imagen.
 */
export const HERO_SCENES = [
  { id: 'lo-de-cata', focus: '50% 55%', name: 'Lo de Cata', src: '/images/hero-obra-1736.webp', small: '/images/hero-obra-movil.webp', alt: 'Casa celeste con piscina de Lo de Cata, Punta del Diablo' },
  { id: 'laslu', focus: '50% 62%', name: 'Laslu', src: laslu.url, small: lasluSmall.url, alt: 'Vivienda Laslu de SCH Construcciones en Punta del Diablo' },
  { id: 'la-diosa', focus: '50% 62%', name: 'La Diosa · La Clave del Diablo', src: diosa.url, small: diosaSmall.url, alt: 'Viviendas La Diosa, La Clave del Diablo, de SCH Construcciones' },
  { id: 'proyecto-2021', focus: '50% 58%', name: 'Proyecto 2021', src: bosque.url, small: bosqueSmall.url, alt: 'Cabaña en el bosque, proyecto 2021 de SCH Construcciones' },
  { id: 'mi-sueno', focus: '50% 62%', name: 'Mi Sueño', src: sueno.url, small: suenoSmall.url, alt: 'Vivienda Mi Sueño de SCH Construcciones en Punta del Diablo' },
] as const;

/** La casa principal del sitio: siempre abre el hero y es la que más tiempo se queda. */
export const HERO_MAIN_ID = 'lo-de-cata';

/** Tiempos del hero (milisegundos). La casa principal se queda más del doble que cada una de las otras obras. */
export const HERO_TIMING = { mainMs: 11000, otherMs: 4500, fadeMs: 1400 } as const;

export type HeroScene = (typeof HERO_SCENES)[number];

/**
 * Orden de una vuelta completa: la casa principal abre, pasan dos obras, vuelve la principal, pasan las otras dos
 * y la principal queda fija al final. Así nunca se mueve sola más de una vuelta y siempre termina en Lo de Cata.
 */
export function heroPlaylist(scenes: readonly { id: string }[] = HERO_SCENES): string[] {
  const others = scenes.filter(scene => scene.id !== HERO_MAIN_ID).map(scene => scene.id);
  const order: string[] = [HERO_MAIN_ID];
  for (let i = 0; i < others.length; i += 2) order.push(...others.slice(i, i + 2), HERO_MAIN_ID);
  return order;
}

/** Cuánto tiempo se queda una obra a la vista antes de pasar a la siguiente. */
export function heroDwellMs(id: string): number {
  return id === HERO_MAIN_ID ? HERO_TIMING.mainMs : HERO_TIMING.otherMs;
}
