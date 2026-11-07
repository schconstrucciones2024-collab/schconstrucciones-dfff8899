import laslu from '@/assets/premium/laslu-1600.webp.asset.json';
import lasluSmall from '@/assets/premium/laslu-800.webp.asset.json';
import diosa from '@/assets/premium/la-diosa-1600.webp.asset.json';
import diosaSmall from '@/assets/premium/la-diosa-800.webp.asset.json';
import bosque from '@/assets/premium/proyecto-2021-1600.webp.asset.json';
import bosqueSmall from '@/assets/premium/proyecto-2021-800.webp.asset.json';
import sueno from '@/assets/premium/mi-sueno-1600.webp.asset.json';
import suenoSmall from '@/assets/premium/mi-sueno-800.webp.asset.json';

export const HERO_SCENES = [
  { id: 'lo-de-cata', name: 'Lo de Cata', src: '/images/hero-obra-1736.webp', small: '/images/hero-obra-movil.webp', alt: 'Casa celeste con piscina de Lo de Cata, Punta del Diablo' },
  { id: 'laslu', name: 'Laslu', src: laslu.url, small: lasluSmall.url, alt: 'Vivienda Laslu de SCH Construcciones en Punta del Diablo' },
  { id: 'la-diosa', name: 'La Diosa · La Clave del Diablo', src: diosa.url, small: diosaSmall.url, alt: 'Viviendas La Diosa, La Clave del Diablo, de SCH Construcciones' },
  { id: 'proyecto-2021', name: 'Proyecto 2021', src: bosque.url, small: bosqueSmall.url, alt: 'Cabaña en el bosque, proyecto 2021 de SCH Construcciones' },
  { id: 'mi-sueno', name: 'Mi Sueño', src: sueno.url, small: suenoSmall.url, alt: 'Vivienda Mi Sueño de SCH Construcciones en Punta del Diablo' },
] as const;

/** Pure selection; random value supplied by the browser, never at module scope. */
export function chooseHeroScene(sessionId: string | null, previousId: string | null, random: number): string {
  if (HERO_SCENES.some(scene => scene.id === sessionId)) return sessionId as string;
  const candidates = HERO_SCENES.filter(scene => scene.id !== previousId);
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random * candidates.length)));
  return candidates[index]?.id ?? 'lo-de-cata';
}