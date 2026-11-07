import { Link } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import logoCompleto from "@/assets/logo-sch-construcciones.png.asset.json";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/contactInquiry";
import { CONTACT } from "@/data/projects";
import { SERVICE_LINKS } from "@/data/servicios";
import { AnchorLink, SECTION_LINKS, SYSTEMS_LINK } from "./nav";
import { SOCIALS } from "./socialLinks";

const linkClass = "inline-flex min-h-11 items-center text-sm text-foreground/75 transition-colors hover:text-primary";

export function SiteFooter({ home = true }: { home?: boolean }) {
  return (
    <footer className="surface-dark border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 border-b border-border px-5 py-16 sm:flex-row sm:items-end sm:justify-between lg:px-8">
        <div><p className="text-xs uppercase text-primary">Tu proyecto puede ser el próximo</p><h2 className="mt-4 font-display text-3xl font-medium sm:text-4xl">Construir confianza.<br />Edificar futuro.</h2></div>
        <Button asChild className="h-auto min-h-14 rounded-none whitespace-normal px-6 py-4"><a href={whatsappUrl("Hola SCH, quiero hablar de mi proyecto.")} target="_blank" rel="noopener noreferrer"><MessageCircle /> Hablemos de tu proyecto</a></Button>
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-20">
        <div className="lg:col-span-5">
          <img src={logoCompleto.url} alt="SCH Construcciones" width={96} height={98} loading="lazy" decoding="async" className="size-24 object-contain" />
          <p className="mt-6 max-w-sm text-base leading-7 text-foreground/70">Construcción familiar premium en Rocha, Uruguay.</p>
          <ul className="mt-6 flex flex-wrap gap-1">
            {SOCIALS.filter((social) => social.label !== "WhatsApp").map(({ Icon, label, href }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} de SCH Construcciones`} className="inline-flex size-11 items-center justify-center text-foreground/70 transition-colors hover:text-primary"><Icon size={20} /></a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Pie de página" className="grid grid-cols-2 gap-8 lg:col-span-4">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">Navegación</h2>
            <ul className="mt-4">
              {SECTION_LINKS.map(([label, id]) => <li key={id}><AnchorLink id={id} home={home} className={linkClass}>{label}</AnchorLink></li>)}
              <li><AnchorLink id={SYSTEMS_LINK[1]} home={home} className={linkClass}>{SYSTEMS_LINK[0]}</AnchorLink></li>
            </ul>
          </div>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">Servicios</h2>
            <ul className="mt-4">
              {SERVICE_LINKS.map((link) => <li key={link.to}><Link to={link.to} className={linkClass}>{link.label}</Link></li>)}
            </ul>
          </div>
        </nav>

        <div className="lg:col-span-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">Contacto</h2>
          <ul className="mt-4">
            <li><a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className={`${linkClass} gap-3`}><MessageCircle aria-hidden="true" className="size-4 shrink-0 text-primary" /> {CONTACT.whatsappLabel}</a></li>
            <li><a href={`mailto:${CONTACT.email}`} className={`${linkClass} gap-3 break-all`}><Mail aria-hidden="true" className="size-4 shrink-0 text-primary" /> {CONTACT.email}</a></li>
            <li className="flex gap-3 py-2.5 text-sm text-foreground/75"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /> {CONTACT.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-foreground/60 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>© 2026 SCH Construcciones · Rocha, Uruguay</span>
          <AnchorLink id="inicio" home={home} className="inline-flex min-h-11 items-center text-foreground/75 underline-offset-4 hover:text-primary hover:underline">Volver arriba</AnchorLink>
        </div>
      </div>
    </footer>
  );
}
