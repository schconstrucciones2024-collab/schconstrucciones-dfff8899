import { ArrowRight, CheckCircle2, History, Ruler, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PROJECTS } from "@/data/projects";
import { INSTITUTIONAL_PHRASE, PILLAR_DEFS, type PillarDef } from "@/data/pillars";
import { CountUp, Reveal } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";

const ICONS: Record<PillarDef["id"], typeof ShieldCheck> = {
  confianza: ShieldCheck,
  experiencia: History,
  profesionalismo: CheckCircle2,
  eficiencia: Ruler,
};

const evidenceClass = "group mt-6 inline-flex min-h-11 items-center gap-2 border-b border-primary/50 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:border-primary";

export function Pillars() {
  return (
    <section id="pilares" aria-labelledby="pilares-title" className="surface-light">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <Reveal>
          <SectionHeading eyebrow="Por qué SCH" title="¿Por qué confiar tu proyecto a SCH?" id="pilares-title" />
          <blockquote className="mt-8 max-w-4xl border-l-2 border-primary pl-6 font-display text-xl font-medium leading-relaxed text-background/85 sm:text-2xl lg:text-3xl">
            <p>«{INSTITUTIONAL_PHRASE.replace(/\.$/, "")}».</p>
          </blockquote>
        </Reveal>
        <ul className="mt-16 grid gap-12 sm:grid-cols-2 md:gap-10 lg:grid-cols-4">
          {PILLAR_DEFS.map((pillar, i) => {
            const Icon = ICONS[pillar.id];
            const to = pillar.evidence.to;
            return (
              <Reveal as="li" key={pillar.id} delay={i * 110} className="flex flex-col border-t-2 border-primary pt-7">
                <Icon aria-hidden="true" className="size-7 text-primary" strokeWidth={1.5} />
                <h3 className="mt-6 font-display text-2xl font-semibold">{pillar.title}</h3>
                <p className="mt-3 flex-1 text-base leading-7 text-background/70">{pillar.text}</p>
                {"id" in to ? (
                  <a href={`#${to.id}`} className={evidenceClass}>{pillar.evidence.label} <ArrowRight aria-hidden="true" className="size-3.5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" /></a>
                ) : (
                  <Link to="/proyectos/$slug" params={{ slug: to.slug }} className={evidenceClass}>{pillar.evidence.label} <ArrowRight aria-hidden="true" className="size-3.5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" /></Link>
                )}
              </Reveal>
            );
          })}
        </ul>
        <Reveal className="mt-16 flex flex-col gap-3 border-t border-background/15 pt-8 sm:flex-row sm:items-baseline sm:gap-6">
          <p className="font-display text-5xl font-semibold leading-none text-primary"><CountUp to={PROJECTS.length} duration={1400} /></p>
          <p className="max-w-xl text-base leading-7 text-background/75">obras reales documentadas en este sitio, con sus fotografías y datos originales. Podés verlas todas en Proyectos.</p>
        </Reveal>
      </div>
    </section>
  );
}
