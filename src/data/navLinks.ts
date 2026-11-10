/**
 * Navegación del sitio (datos puros, sin React): una sola fuente para el header, el menú móvil y el pie.
 * El orden de MAIN_NAV es el de la estructura pedida: Inicio, Nosotros, Sistemas constructivos, Servicios,
 * Proyectos, Nuestro proceso y Contacto. Las herramientas (3D, cotizador, preguntas) quedan dentro de "Servicios".
 */
export type NavLink = { label: string; id: string };

export const MAIN_NAV: NavLink[] = [
  { label: "Inicio", id: "inicio" },
  { label: "Nosotros", id: "nosotros" },
  { label: "Sistemas constructivos", id: "sistemas" },
  { label: "Servicios", id: "servicios" },
  { label: "Proyectos", id: "proyectos" },
  { label: "Nuestro proceso", id: "proceso" },
  { label: "Contacto", id: "contacto" },
];

/** Herramientas de la web: se ofrecen dentro del menú "Servicios" y en el pie. */
export const TOOL_NAV: NavLink[] = [
  { label: "Diseñá tu casa en 3D", id: "disenar" },
  { label: "Cotizá tu casa", id: "cotizar" },
  { label: "Preguntas frecuentes", id: "preguntas-frecuentes" },
];

/** Ids de las secciones de la home, en el orden en que aparecen en la página (para marcar la sección activa). */
export const HOME_SECTION_ORDER = [
  "inicio", "nosotros", "sistemas", "servicios", "pilares", "proyectos", "proceso",
  "disenar", "cotizar", "redes", "preguntas-frecuentes", "contacto",
] as const;

/** Enlace del menú que corresponde a la sección visible (las secciones sin enlace propio heredan el anterior). */
export function activeNavId(visibleSection: string | null): string | null {
  if (!visibleSection) return null;
  if (MAIN_NAV.some((l) => l.id === visibleSection)) return visibleSection;
  if (TOOL_NAV.some((l) => l.id === visibleSection)) return "servicios";
  if (visibleSection === "pilares") return "servicios";
  if (visibleSection === "redes") return "proyectos";
  return null;
}
