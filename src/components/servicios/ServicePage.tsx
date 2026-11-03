import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, MessageCircle, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SERVICE_WHATSAPP, type ServiceFaq } from "@/data/servicios";

export function WhatsAppButton({ label = "Consultar por WhatsApp · 095 564 068" }: { label?: string }) {
  return (
    <a href={SERVICE_WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center gap-3 bg-primary px-7 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/85">
      <MessageCircle aria-hidden="true" className="size-5 shrink-0" />{label}
    </a>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-14">
      <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h2>
      <div className="mt-7 space-y-5 text-base leading-8 text-foreground/80">{children}</div>
    </section>
  );
}

export function List({ items, checked }: { items: string[]; checked: boolean }) {
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((item) => <li key={item} className="flex gap-3">{checked ? <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /> : <Minus aria-hidden="true" className="mt-1 size-5 shrink-0 text-foreground/60" />}<span>{item}</span></li>)}
    </ul>
  );
}

export function ServicePage({ eyebrow, title, intro, faqs, children }: { eyebrow: string; title: string; intro: string; faqs: ServiceFaq[]; children: ReactNode }) {
  return (
    <>
      <SiteHeader home={false} />
      <main id="contenido" className="surface-dark min-h-screen text-foreground">
        <article className="mx-auto max-w-5xl px-5 pb-24 pt-36 lg:px-8 lg:pt-44">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-foreground/75 transition-colors hover:text-primary"><ArrowLeft aria-hidden="true" className="size-4" /> Volver al inicio</Link>
          <p className="mt-8 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs"><span aria-hidden="true" className="h-px w-10 bg-primary" />{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] sm:text-6xl">{title}</h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-foreground/85">{intro}</p>
          <div className="mt-10"><WhatsAppButton /></div>
          <div className="mt-16">{children}</div>
          <section className="border-t border-border py-14" aria-labelledby="faq-servicio">
            <h2 id="faq-servicio" className="font-display text-3xl font-semibold sm:text-4xl">Preguntas frecuentes</h2>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {faqs.map((faq) => <div key={faq.question} className="py-7"><h3 className="font-display text-xl font-semibold text-primary">{faq.question}</h3><p className="mt-3 text-base leading-8 text-foreground/80">{faq.answer}</p></div>)}
            </div>
          </section>
          <section className="surface-light p-8 sm:p-12" aria-labelledby="cta-servicio">
            <h2 id="cta-servicio" className="font-display text-3xl font-semibold sm:text-4xl">Pedí tu presupuesto gratis</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-background/80">Escribinos por WhatsApp al 095 564 068. SCH Construcciones · Av. Central, Punta del Diablo, Rocha, Uruguay.</p>
            <div className="mt-8"><WhatsAppButton label="Escribinos por WhatsApp" /></div>
          </section>
        </article>
      </main>
      <SiteFooter home={false} />
    </>
  );
}
