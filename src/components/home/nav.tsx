import { Link } from "@tanstack/react-router";
import { useEffect, useState, type MouseEventHandler, type ReactNode } from "react";
import { HOME_SECTION_ORDER, activeNavId } from "@/data/navLinks";

type AnchorLinkProps = {
  /** Id de la sección de la home (sin `#`). */
  id: string;
  /** `true` en la home (ancla en la misma página); `false` en las demás páginas (vuelve a la home en esa sección). */
  home: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  /** Marca el enlace de la sección que se está leyendo. */
  current?: boolean;
  children: ReactNode;
};

/** Enlace a una sección de la home que funciona tanto desde la home como desde las páginas de servicio. */
export function AnchorLink({ id, home, className, onClick, current, children }: AnchorLinkProps) {
  const aria = current ? ({ "aria-current": "location" } as const) : {};
  if (home) {
    return <a href={`#${id}`} className={className} onClick={onClick} {...aria}>{children}</a>;
  }
  return <Link to="/" hash={id} className={className} onClick={onClick} {...aria}>{children}</Link>;
}

/** Id del enlace del menú que corresponde a la sección que se ve en pantalla (solo en la home). */
export function useActiveNav(enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setActive(activeNavId(HOME_SECTION_ORDER.find((id) => visible.has(id)) ?? null));
      },
      // Una franja angosta a un tercio de la pantalla: la sección que la cruza es la que se está leyendo.
      { rootMargin: "-35% 0px -60% 0px", threshold: 0 },
    );
    for (const id of HOME_SECTION_ORDER) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [enabled]);
  return active;
}
