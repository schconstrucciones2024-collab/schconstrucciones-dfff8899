import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CountUp, Words, delay, useHeroExit, useParallax } from "@/lib/motion";
import { MagneticLink } from "./MagneticLink";
import { Button } from "@/components/ui/button";
import { HERO_SCENES, chooseHeroScene } from "@/data/heroScenes";
import { whatsappUrl } from "@/lib/contactInquiry";

const HERO_ALT = "Casa celeste con piscina, obra Lo de Cata de SCH Construcciones en Punta del Diablo";

/** Quiénes somos y qué hicimos / qué hacemos hoy. Datos declarados por la empresa; nada de esto se repite más abajo. */
const TIMELINE: [label: string, text: string][] = [
  ["Ayer", "Dirigimos obras de gran porte por todo el país: edificios, complejos habitacionales y centros hospitalarios."],
  ["Hoy", "Construimos cabañas y viviendas en woodframe y tradicional, reformas, ampliaciones y mobiliario a medida."],
];

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  useParallax(parallaxRef, 0.14, 90);
  const [scene, setScene] = useState<(typeof HERO_SCENES)[number]>(HERO_SCENES[0]);
  useEffect(() => {
    let active = true;
    let session: string | null = null;
    let previous: string | null = null;
    try { session = sessionStorage.getItem('sch-hero-session'); previous = localStorage.getItem('sch-hero-previous'); } catch { /* storage blocked */ }
    const id = chooseHeroScene(session, previous, Math.random());
    const next = HERO_SCENES.find(item => item.id === id) ?? HERO_SCENES[0];
    const image = new Image();
    image.src = window.matchMedia('(max-width: 767px)').matches ? next.small : next.src;
    image.decode().then(() => {
      if (!active) return;
      setScene(next);
      try { sessionStorage.setItem('sch-hero-session', next.id); localStorage.setItem('sch-hero-previous', next.id); } catch { /* no storage needed for rendering */ }
      const preload = () => HERO_SCENES.filter(item => item.id !== next.id).forEach(item => { const cached = new Image(); cached.src = window.matchMedia('(max-width: 767px)').matches ? item.small : item.src; });
      window.setTimeout(preload, 5000);
    }).catch(() => { /* visible Lo de Cata fallback stays in place */ });
    return () => { active = false; };
  }, []);
  useHeroExit(sectionRef);

  return (
    <section ref={sectionRef} id="inicio" aria-labelledby="hero-title" className="texture-dark relative isolate flex min-h-[92svh] items-end overflow-hidden bg-background">
      {/* Fotografía real de una obra de SCH. Parallax en el contenedor; la imagen solo hace un zoom de entrada. */}
      <div ref={parallaxRef} className="hero-parallax absolute inset-x-0 top-0 -z-20 h-[100vw] will-change-transform md:-top-24 md:bottom-0 md:h-auto">
        <picture className="block h-full w-full">
          <source media="(max-width: 767px)" srcSet="/images/hero-obra-movil.webp" />
          <img
            src="/images/hero-obra-1736.webp"
            srcSet="/images/hero-obra-1280.webp 1280w, /images/hero-obra-1736.webp 1736w"
            sizes="100vw"
            alt={HERO_ALT}
            width={1736}
            height={976}
            fetchPriority="high"
            decoding="async"
            className="hero-settle h-full w-full object-cover object-[80%_50%] md:object-[62%_50%] xl:object-center"
          />
        </picture>
        {scene.id !== "lo-de-cata" && <picture key={scene.id} className="hero-scene absolute inset-0 block h-full w-full"><source media="(max-width: 767px)" srcSet={scene.small} /><img src={scene.src} alt={scene.alt} width={1600} height={1200} decoding="async" className="hero-scene-image h-full w-full object-cover md:object-right" onError={() => setScene(HERO_SCENES[0])} /></picture>}
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[calc(100vw+1.5rem)] bg-gradient-to-t from-background via-background/35 to-background/10 md:hidden" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-background/95 via-background/70 to-background/10 md:block" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 hidden h-48 bg-gradient-to-t from-background to-transparent md:block" />
      {/* Luz suave que sigue al mouse (solo escritorio). */}
      

      <div className="hero-content relative mx-auto w-full max-w-7xl px-5 pb-12 pt-[calc(100vw-2.5rem)] sm:pb-16 md:pt-36 lg:px-8">
        <div className="max-w-5xl">
          <p className="hero-rise flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary sm:gap-4 sm:text-xs sm:tracking-[0.3em]" style={delay(200)}>
            <span aria-hidden="true" className="hero-rule h-px w-12 bg-primary" style={delay(200)} />
            SCH Construcciones · Punta del Diablo, Rocha
          </p>

          {/* La cifra: lo primero que se ve. El texto accesible es estático; la cuenta animada se oculta a los lectores de pantalla. */}
          <p className="sr-only">Más de 40 años de experiencia en el rubro de la construcción.</p>
          <p aria-hidden="true" className="hero-rise mt-5 flex items-end gap-4 sm:mt-6 sm:gap-6" style={delay(320)}>
            <span className="hero-figure -ml-2 font-display sm:-ml-3 text-7xl sm:text-8xl lg:text-9xl font-semibold leading-[0.8] ">
              +<CountUp to={40} duration={2200} />
            </span>
            <span className="pb-1 text-[10px] font-semibold uppercase leading-[1.7] tracking-[0.24em] text-foreground/80 sm:pb-2 sm:text-xs">
              años de experiencia<br />en el rubro
            </span>
          </p>

          <h1 id="hero-title" className="hero-words mt-6 font-display text-[1.65rem] sm:text-4xl lg:text-5xl font-semibold uppercase leading-[1.04]  text-foreground sm:mt-8">
            <span className="sr-only">SCH Construcciones: </span>
            <span className="block" style={delay(520)}><Words text="Construimos más que espacios." /></span>{" "}
            <span className="block" style={delay(760)}><Words text="Construimos confianza." /></span>{" "}

          </h1>

          <p className="hero-rise mt-6 max-w-2xl text-sm leading-7 text-foreground/85 sm:text-base" style={delay(950)}>Más de 40 años de experiencia familiar en construcción. Desde 2015, desarrollando proyectos en Punta del Diablo, Rocha, con planificación, calidad y compromiso en cada etapa.</p>
          <dl className="hero-rise mt-8 grid max-w-3xl gap-5 border-t border-foreground/20 pt-6 sm:mt-10 sm:grid-cols-2 sm:gap-8" style={delay(1250)}>
            {TIMELINE.map(([label, text]) => (
              <div key={label}>
                <dt className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                  <span aria-hidden="true" className="h-px w-6 bg-primary" />
                  {label}
                </dt>
                <dd className="mt-2 text-sm leading-7 text-foreground/80 sm:text-[0.95rem]">{text}</dd>
              </div>
            ))}
          </dl>

          <div className="hero-rise mt-9 flex flex-col gap-3 sm:flex-row" style={delay(1400)}>
            <Button asChild className="h-auto rounded-none whitespace-normal p-0"><MagneticLink href={whatsappUrl("Hola SCH, quiero consultar por la construcción de una vivienda")} target="_blank" rel="noopener noreferrer" className="group inline-flex min-h-14 items-center justify-center gap-3 bg-primary px-8 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground hover:bg-foreground">
              Quiero construir mi proyecto <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
            </MagneticLink></Button>
            <Button asChild variant="outline" className="h-auto rounded-none whitespace-normal p-0"><MagneticLink href="#proyectos" className="inline-flex min-h-14 items-center justify-center border border-foreground/40 px-8 text-xs font-semibold uppercase tracking-[0.18em] text-foreground hover:border-foreground hover:bg-foreground/10">
              Explorar nuestros proyectos
            </MagneticLink></Button>
          </div>
        </div>

        <p className="mt-7 text-[10px] uppercase text-foreground/65">Obra SCH · {scene.name}</p>
        <p className="hero-rise mt-12 hidden items-center gap-4 text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/60 sm:flex" style={delay(1600)}>
          <span aria-hidden="true" className="h-px w-10 bg-foreground/40" />
          Construir confianza. Edificar futuro.
        </p>
      </div>

      <div aria-hidden="true" className="absolute bottom-10 right-8 hidden flex-col items-center gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/60 xl:flex">
        <span className="[writing-mode:vertical-rl]">Scroll</span>
        <span className="relative block h-14 w-px overflow-hidden bg-foreground/20"><span className="scroll-cue absolute inset-x-0 top-0 block h-1/2 bg-primary" /></span>
      </div>
    </section>
  );
}
