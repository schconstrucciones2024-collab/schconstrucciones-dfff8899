import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteHeader } from "@/components/home/SiteHeader";
import { LEGAL_UPDATED, type LegalBlock } from "@/config/legal";

/** Página de texto legal (privacidad, aviso legal): mismo encabezado y pie que las páginas de servicio. */
export function LegalPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: LegalBlock[] }) {
  return (
    <>
      <SiteHeader home={false} />
      <main id="contenido" className="surface-dark min-h-screen text-foreground">
        <article className="mx-auto max-w-3xl px-5 pb-24 pt-36 lg:px-8 lg:pt-44">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-foreground/75 transition-colors hover:text-primary">
            <ArrowLeft aria-hidden="true" className="size-4" /> Volver al inicio
          </Link>
          <p className="mt-8 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs">
            <span aria-hidden="true" className="h-px w-10 bg-primary" />
            {eyebrow}
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] sm:text-5xl">{title}</h1>
          <p className="mt-6 text-lg leading-8 text-foreground/85">{intro}</p>
          <p className="mt-3 text-sm text-foreground/60">Última actualización: {LEGAL_UPDATED}</p>
          <div className="mt-12">
            {sections.map((section) => (
              <section key={section.title} className="border-t border-border py-9">
                <h2 className="font-display text-2xl font-semibold leading-tight">{section.title}</h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-foreground/80">
                  {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.items && (
                    <ul className="list-disc space-y-3 pl-5 marker:text-primary">
                      {section.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter home={false} />
    </>
  );
}
