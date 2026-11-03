import { Link } from "@tanstack/react-router";
import type { MouseEventHandler, ReactNode } from "react";

type AnchorLinkProps = {
  /** Id de la sección de la home (sin `#`). */
  id: string;
  /** `true` en la home (ancla en la misma página); `false` en las demás páginas (vuelve a la home en esa sección). */
  home: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
};

/** Enlace a una sección de la home que funciona tanto desde la home como desde las páginas de servicio. */
export function AnchorLink({ id, home, className, onClick, children }: AnchorLinkProps) {
  if (home) {
    return <a href={`#${id}`} className={className} onClick={onClick}>{children}</a>;
  }
  return <Link to="/" hash={id} className={className} onClick={onClick}>{children}</Link>;
}

/** Sección de los dos sistemas constructivos. Va en el menú de Servicios, el menú móvil y el pie (no en la barra, que ya está completa). */
export const SYSTEMS_LINK: [label: string, id: string] = ["Sistemas constructivos", "sistemas"];

/** Secciones de la home, en el orden en que aparecen en la navegación. */
export const SECTION_LINKS: [label: string, id: string][] = [
  ["Nosotros", "nosotros"],
  ["Proyectos", "proyectos"],
  ["Proceso", "proceso"],
  ["Diseñá tu casa", "disenar"],
  ["Cotizá tu casa", "cotizar"],
  ["Preguntas frecuentes", "preguntas-frecuentes"],
  ["Contacto", "contacto"],
];
