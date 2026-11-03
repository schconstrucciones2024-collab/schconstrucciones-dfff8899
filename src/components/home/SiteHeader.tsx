import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import logoSch from "@/assets/logo-sch-medallon.png.asset.json";
import { CONTACT } from "@/data/projects";
import { SERVICE_LINKS } from "@/data/servicios";
import { ScrollProgress, useScrolled } from "@/lib/motion";
import { AnchorLink, SECTION_LINKS, SYSTEMS_LINK } from "./nav";

const linkClass = "nav-link whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/80 transition-colors hover:text-primary";

/** Menú "Servicios": ancla de la home + las tres páginas de servicio. Se abre con clic, foco o mouse. */
function ServicesMenu({ home }: { home: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    >
      <button type="button" aria-expanded={open} aria-controls="menu-servicios" onClick={() => setOpen((value) => !value)} className={`${linkClass} inline-flex min-h-11 items-center gap-1.5`}>
        Servicios <ChevronDown aria-hidden="true" className={`size-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div id="menu-servicios" className={`absolute left-1/2 top-full z-10 w-64 -translate-x-1/2 pt-2 transition-[opacity,transform,visibility] duration-300 ${open ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"}`}>
        <ul className="border border-foreground/10 bg-background/95 p-2 shadow-2xl backdrop-blur-md">
          <li><AnchorLink id="servicios" home={home} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-primary">Todos los servicios</AnchorLink></li>
          <li><AnchorLink id={SYSTEMS_LINK[1]} home={home} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-primary">{SYSTEMS_LINK[0]}</AnchorLink></li>
          {SERVICE_LINKS.map((link) => (
            <li key={link.to}><Link to={link.to} className="block px-4 py-3 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-primary">{link.label}</Link></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MobileMenu({ open, onClose, home }: { open: boolean; onClose: () => void; home: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    // El panel pasa de oculto a visible con una transición: se enfoca recién cuando ya es visible.
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  const itemClass = "block border-b border-foreground/10 py-4 font-display text-2xl font-medium text-foreground transition-colors hover:text-primary";
  return (
    <div
      ref={panelRef}
      id="menu-movil"
      role="dialog"
      aria-modal="true"
      aria-label="Menú principal"
      aria-hidden={!open}
      className={`surface-dark fixed inset-0 z-[60] flex flex-col overflow-y-auto px-5 pb-10 pt-5 transition-[opacity,transform,visibility] duration-500 ease-out xl:hidden ${open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-3 opacity-0"}`}
    >
      <div className="flex h-12 items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Menú</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar menú" className="inline-flex size-11 items-center justify-center text-foreground"><X aria-hidden="true" className="size-6" /></button>
      </div>
      <nav aria-label="Navegación móvil" className="mt-6">
        <ul>
          {SECTION_LINKS.slice(0, 2).map(([label, id]) => <li key={id}><AnchorLink id={id} home={home} onClick={onClose} className={itemClass}>{label}</AnchorLink></li>)}
          <li>
            <AnchorLink id="servicios" home={home} onClick={onClose} className={itemClass}>Servicios</AnchorLink>
            <ul className="-mt-1 mb-2 border-b border-foreground/10 pb-3 pl-4">
              <li><AnchorLink id={SYSTEMS_LINK[1]} home={home} onClick={onClose} className="block py-2.5 text-base text-foreground/75 transition-colors hover:text-primary">{SYSTEMS_LINK[0]}</AnchorLink></li>
              {SERVICE_LINKS.map((link) => <li key={link.to}><Link to={link.to} onClick={onClose} className="block py-2.5 text-base text-foreground/75 transition-colors hover:text-primary">{link.label}</Link></li>)}
            </ul>
          </li>
          {SECTION_LINKS.slice(2).map(([label, id]) => <li key={id}><AnchorLink id={id} home={home} onClick={onClose} className={itemClass}>{label}</AnchorLink></li>)}
        </ul>
      </nav>
      <div className="mt-8 flex flex-col gap-3">
        <AnchorLink id="contacto" home={home} onClick={onClose} className="inline-flex min-h-12 items-center justify-center bg-primary px-6 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground">Presupuesto gratis</AnchorLink>
        <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 border border-foreground/30 px-6 text-sm font-medium text-foreground"><MessageCircle aria-hidden="true" className="size-4" /> {CONTACT.whatsappLabel}</a>
      </div>
    </div>
  );
}

/** Encabezado del sitio. `home={false}` lo adapta a las páginas de servicio (los anclajes vuelven a la home). */
export function SiteHeader({ home = true }: { home?: boolean }) {
  const scrolled = useScrolled(24);
  const [menuOpen, setMenuOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => { setMenuOpen(false); burgerRef.current?.focus({ preventScroll: true }); }, []);
  const logo = <img src={logoSch.url} alt="SCH Construcciones" width={96} height={96} className="size-12 object-contain sm:size-14" />;

  return (
    <>
      <ScrollProgress />
      <a href="#contenido" className="sr-only z-[70] bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Saltar al contenido</a>
      <header className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-500 ${scrolled ? "border-foreground/10 bg-background/90 backdrop-blur-md" : "border-transparent bg-gradient-to-b from-background/75 to-transparent"}`}>
        <nav className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-5 lg:px-8" aria-label="Navegación principal">
          {home
            ? <a href="#inicio" className="flex shrink-0 items-center" aria-label="SCH Construcciones · Inicio">{logo}</a>
            : <Link to="/" className="flex shrink-0 items-center" aria-label="SCH Construcciones · Inicio">{logo}</Link>}
          <div className="hidden items-center gap-4 xl:flex 2xl:gap-5">
            <AnchorLink id="nosotros" home={home} className={linkClass}>Nosotros</AnchorLink>
            <ServicesMenu home={home} />
            {SECTION_LINKS.slice(1).map(([label, id]) => <AnchorLink key={id} id={id} home={home} className={linkClass}>{label}</AnchorLink>)}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp" className="hidden size-11 items-center justify-center border border-foreground/25 text-foreground transition-colors hover:border-primary hover:text-primary sm:inline-flex xl:hidden"><MessageCircle aria-hidden="true" className="size-[18px]" /></a>
            <AnchorLink id="contacto" home={home} className="inline-flex min-h-11 items-center whitespace-nowrap bg-primary px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-foreground sm:px-5">Presupuesto gratis</AnchorLink>
            <button ref={burgerRef} type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="menu-movil" aria-label="Abrir menú" className="inline-flex size-11 items-center justify-center text-foreground xl:hidden"><Menu aria-hidden="true" className="size-6" /></button>
          </div>
        </nav>
      </header>
      <MobileMenu open={menuOpen} onClose={closeMenu} home={home} />
    </>
  );
}
