import { useRef } from "react";
import { Reveal, delay, useSectionProgress } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

/**
 * Datos de la historia de la familia (declarados por la empresa). La experiencia, lo que hicimos y lo que hacemos hoy
 * se cuentan en el hero; acá va el camino de la familia hasta Punta del Diablo, sin repetir esos textos.
 */
const TIMELINE: [year: string, text: string][] = [
  ["2014", "La familia se instala a vivir en Punta del Diablo."],
  ["2015", "Empezamos a construir en el pueblo."],
  ["Hoy", "Seguimos acá, con la misma familia al frente de cada proyecto."],
];

export function About() {
  const lineRef = useRef<HTMLOListElement>(null);
  useSectionProgress(lineRef);

  return (
    <section id="nosotros" aria-labelledby="nosotros-title" className="surface-light">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-36">
        <Reveal className="lg:col-span-6">
          <SectionHeading eyebrow="Nuestra historia y esencia" title="Una familia que construye para generaciones." id="nosotros-title" />
        </Reveal>
        <Reveal delay={150} className="lg:col-span-6 lg:pt-14">
          <div className="border-l border-primary/40 pl-6 sm:pl-10">
            <p className="font-display text-xl font-medium leading-relaxed sm:text-2xl">
              Somos una familia de constructores. Lo que empezó como un oficio hoy es nuestro mayor propósito: crear hogares seguros y duraderos.
            </p>
          </div>
          <ol ref={lineRef} className="timeline mt-12 sm:ml-10" aria-label="Nuestro camino en Punta del Diablo">
            {TIMELINE.map(([year, text], index) => (
              <li key={year} className="timeline-item" style={delay(250 + index * 160)}>
                <span aria-hidden="true" className="timeline-dot" />
                <span className="font-display text-3xl font-semibold leading-none text-primary sm:text-4xl">{year}</span>
                <span className="mt-2 block text-base leading-7 text-background/75">{text}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Costa de Punta del Diablo, la imagen completa (sin recortes) a todo el ancho.
 * Es una imagen ilustrada, no una fotografía de obra: el epígrafe lo dice.
 */
export function CoastBand() {
  return (
    <figure className="relative bg-background">
      <Reveal className="media-reveal overflow-hidden">
        <img
          src="/images/costa-punta-del-diablo.webp"
          srcSet="/images/costa-punta-del-diablo-1200.webp 1200w, /images/costa-punta-del-diablo.webp 2334w"
          sizes="100vw"
          alt="Vista aérea de la costa de Punta del Diablo al atardecer, con rocas, playa y pueblo. Un cartel de mármol dice «Punta del Diablo: tu nuevo estándar» y muestra los logos de SCH Design y SCH Construcciones."
          width={2334}
          height={987}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </Reveal>
      <figcaption className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-5 text-[11px] font-medium uppercase tracking-[0.22em] text-foreground/80 lg:px-8">
        <span aria-hidden="true" className="h-px w-10 bg-primary" />
        Punta del Diablo, Rocha · Ilustración
      </figcaption>
    </figure>
  );
}
