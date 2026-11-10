import { Link } from "@tanstack/react-router";
import { ArrowRight, Globe, Mail, MapPin, MessageCircle } from "lucide-react";
import logoCompleto from "@/assets/logo-sch-construcciones.png.asset.json";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/contactInquiry";
import { CONTACT } from "@/data/projects";
import { MAIN_NAV, TOOL_NAV } from "@/data/navLinks";
import { SERVICE_LINKS, SITE_URL } from "@/data/servicios";
import { AnchorLink } from "./nav";
import { SOCIALS } from "./socialLinks";

const linkClass = "inline-flex min-h-11 items-center text-sm text-foreground/75 transition-colors hover:text-primary";
const headingClass = "text-[11px] font-semibold uppercase tracking-[0.26em] text-primary";

export function SiteFooter({ home = true }: { home?: boolean }) {
  return (
    <footer className="surface-dark border-t border-border">
      {/* Cierre comercial */}
      <div className="border-b border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 sm:flex-row sm:items-end sm:justify-between lg:px-8 lg:py-20">
        <h2 className="max-w-3xl font-display text-3xl font-semibold uppercase leading-[1.08] tracking-[0.02em] sm:text-4xl lg:text-5xl">
          Tu proyecto puede ser el próximo.
        </h2>
        <Button asChild className="group h-auto min-h-14 shrink-0 rounded-none whitespace-normal px-7 py-4 text-xs font-semibold uppercase tracking-[0.18em]">
          <a href={whatsappUrl("Hola SCH, quiero hablar de mi proyecto.")} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" /> Hablemos de tu proyecto <ArrowRight aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
          </a>
        </Button>
      </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-20">
        <div className="lg:col-span-4">
          <img src={logoCompleto.url} alt="SCH Construcciones" width={96} height={98} loading="lazy" decoding="async" className="size-24 object-contain" />
          <p className="mt-6 font-display text-lg font-semibold uppercase tracking-[0.22em]">SCH Construcciones</p>
          <p className="mt-2 text-base italic leading-7 text-foreground/75">«Construir confianza. Edificar futuro».</p>
          <p className="mt-4 flex items-start gap-3 text-sm leading-6 text-foreground/70"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> Punta del Diablo, Rocha, Uruguay.</p>
          <ul className="mt-5 flex flex-wrap gap-1">
            {SOCIALS.filter((social) => social.label !== "WhatsApp").map(({ Icon, label, href }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} de SCH Construcciones`} className="inline-flex size-11 items-center justify-center text-foreground/70 transition-colors hover:text-primary"><Icon size={20} /></a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Pie de página" className="grid grid-cols-2 gap-8 lg:col-span-5">
          <div>
            <h2 className={headingClass}>Navegación</h2>
            <ul className="mt-4">
              {MAIN_NAV.map(({ label, id }) => <li key={id}><AnchorLink id={id} home={home} className={linkClass}>{label}</AnchorLink></li>)}
            </ul>
          </div>
          <div>
            <h2 className={headingClass}>Servicios</h2>
            <ul className="mt-4">
              {SERVICE_LINKS.map((link) => <li key={link.to}><Link to={link.to} className={linkClass}>{link.label}</Link></li>)}
              {TOOL_NAV.map(({ label, id }) => <li key={id}><AnchorLink id={id} home={home} className={linkClass}>{label}</AnchorLink></li>)}
            </ul>
          </div>
        </nav>

        <div className="lg:col-span-3">
          <h2 className={headingClass}>Contacto</h2>
          <ul className="mt-4">
            <li><a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className={`${linkClass} gap-3`}><MessageCircle aria-hidden="true" className="size-4 shrink-0 text-primary" /> {CONTACT.whatsappLabel}</a></li>
            <li><a href={`mailto:${CONTACT.email}`} className={`${linkClass} gap-3 break-all`}><Mail aria-hidden="true" className="size-4 shrink-0 text-primary" /> {CONTACT.email}</a></li>
            <li><a href={SITE_URL} className={`${linkClass} gap-3 break-all`}><Globe aria-hidden="true" className="size-4 shrink-0 text-primary" /> {SITE_URL.replace(/^https?:\/\//, "")}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-foreground/60 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>© 2026 SCH Construcciones · Punta del Diablo, Rocha, Uruguay</span>
          <AnchorLink id="inicio" home={home} className="inline-flex min-h-11 items-center text-foreground/75 underline-offset-4 hover:text-primary hover:underline">Volver arriba</AnchorLink>
        </div>
      </div>
    </footer>
  );
}
