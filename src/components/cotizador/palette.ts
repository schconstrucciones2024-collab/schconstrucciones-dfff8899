import type { CSSProperties } from "react";
import type { CategoryId, LogisticsZoneId, SystemId } from "@/lib/cotizador";

/**
 * Identidad de color del cotizador. Es solo presentación: no interviene en precios,
 * superficies, fórmulas ni reglas (eso vive en `src/lib/cotizador.ts`, que no se toca).
 * Los valores están definidos como variables CSS en `styles.css` (`--cat-*`, `--sys-*`, `--zone-*`).
 */
export const CATEGORY_COLOR: Record<CategoryId, string> = {
  rustica: "var(--cat-rustica)",
  moderna: "var(--cat-moderna)",
  allwood: "var(--cat-allwood)",
  esencial: "var(--cat-esencial)",
  clasica: "var(--cat-clasica)",
};

export const SYSTEM_COLOR: Record<SystemId, string> = {
  woodframe: "var(--sys-woodframe)",
  tradicional: "var(--sys-tradicional)",
};

/** Tramos logísticos: rampa de cercano a lejano. */
export const ZONE_COLOR: Record<LogisticsZoneId, string> = {
  local: "var(--zone-local)",
  near: "var(--zone-near)",
  medium: "var(--zone-medium)",
  long: "var(--zone-long)",
  far: "var(--zone-far)",
};

/** Define `--tone` en un elemento; las clases `text-(--tone)`, `bg-(--tone)` y `border-(--tone)` la leen. */
export const tone = (color: string): CSSProperties => ({ "--tone": color }) as CSSProperties;
