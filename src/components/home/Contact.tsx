import { useState, type FormEvent } from "react";
import { ArrowRight, Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { CONTACT } from "@/data/projects";
import { Reveal } from "@/lib/motion";
import { SectionHeading } from "./SectionHeading";
import { FacebookIcon, TikTokIcon } from "./socialLinks";

const fieldClass = "mt-2 block w-full border border-background/25 bg-background/[0.04] px-4 py-3.5 text-base text-background transition-colors placeholder:text-background/50 hover:border-background/45 focus:border-primary";
const labelClass = "text-xs font-semibold uppercase tracking-[0.16em] text-background/75";
const contactLink = "inline-flex min-h-11 items-center gap-3 text-base text-background/80 transition-colors hover:text-primary";

export function Contact() {
  const [opened, setOpened] = useState(false);

  // El formulario no envía datos a ningún servidor: arma el mensaje y abre WhatsApp para que lo envíe la persona.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nombre = String(data.get("nombre") || "").trim();
    const telefono = String(data.get("telefono") || "").trim();
    const descripcion = String(data.get("descripcion") || "").trim();
    const texto = `Hola SCH Construcciones, soy ${nombre || "—"}${telefono ? ` (${telefono})` : ""}. Quiero solicitar un presupuesto sin costo. Detalle del proyecto: ${descripcion || "—"}`;
    const url = `${CONTACT.whatsapp}?text=${encodeURIComponent(texto)}`;
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    setOpened(true);
  };

  return (
    <section id="contacto" aria-labelledby="contacto-title" className="surface-light">
      <div className="mx-auto grid max-w-7xl gap-16 px-5 py-24 lg:grid-cols-12 lg:px-8 lg:py-36">
        <Reveal className="lg:col-span-5">
          <SectionHeading eyebrow="Contacto" title="El mejor momento para empezar es hoy." id="contacto-title" />
          <address className="mt-10 flex flex-col items-start not-italic">
            <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className="mb-3 inline-flex min-h-12 items-center gap-3 bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
              <MessageCircle aria-hidden="true" className="size-[18px]" /> {CONTACT.whatsappLabel}
            </a>
            <a href={`mailto:${CONTACT.email}`} className={contactLink}><Mail aria-hidden="true" className="size-[18px] shrink-0 text-primary" /> {CONTACT.email}</a>
            <p className="inline-flex min-h-11 items-center gap-3 text-base text-background/80"><MapPin aria-hidden="true" className="size-[18px] shrink-0 text-primary" /> Punta del Diablo, Rocha, Uruguay</p>
            <ul className="mt-4 flex gap-1">
              <li><a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram de SCH Construcciones" className="inline-flex size-11 items-center justify-center text-background/70 transition-colors hover:text-primary"><Instagram aria-hidden="true" size={21} /></a></li>
              <li><a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook de SCH Construcciones" className="inline-flex size-11 items-center justify-center text-background/70 transition-colors hover:text-primary"><FacebookIcon size={21} /></a></li>
              <li><a href={CONTACT.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok de SCH Construcciones" className="inline-flex size-11 items-center justify-center text-background/70 transition-colors hover:text-primary"><TikTokIcon size={21} /></a></li>
            </ul>
          </address>
        </Reveal>

        <Reveal delay={150} className="lg:col-span-7">
          <form onSubmit={onSubmit} className="border border-background/15 bg-background/[0.03] p-6 sm:p-10" aria-describedby="contacto-nota">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Nombre</span>
                <input type="text" name="nombre" required autoComplete="name" placeholder="Tu nombre" className={fieldClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Teléfono</span>
                <input type="tel" name="telefono" inputMode="tel" autoComplete="tel" placeholder="Tu teléfono" className={fieldClass} />
              </label>
            </div>
            <label className="mt-6 block">
              <span className={labelClass}>Descripción del proyecto</span>
              <textarea name="descripcion" rows={5} required placeholder="Contanos qué querés construir" className={`${fieldClass} resize-y`} />
            </label>
            <button type="submit" className="group mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 bg-primary px-8 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-background hover:text-foreground sm:w-auto">
              Enviar por WhatsApp <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
            </button>
            <p id="contacto-nota" className="mt-5 text-sm leading-6 text-background/70">
              Este formulario no envía datos a ningún servidor: arma tu mensaje y abre WhatsApp para que lo envíes vos.
            </p>
            <p role="status" className="mt-2 text-sm font-medium text-primary">
              {opened ? `Se abrió WhatsApp con tu mensaje. Si no se abrió, escribinos al ${CONTACT.whatsappLabel}.` : ""}
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
