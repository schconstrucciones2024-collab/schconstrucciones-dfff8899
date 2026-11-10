/** Frase institucional exacta del sitio (no modificar sin aprobación de SCH). */
export const INSTITUTIONAL_PHRASE = "Materiales de calidad + planificación + cumplimiento = resultados que perduran.";

export type PillarDef = {
  id: "confianza" | "experiencia" | "profesionalismo" | "eficiencia";
  title: string;
  text: string;
  /** Evidencia verificable en el propio sitio (enlace a una sección o a una obra real). */
  evidence: { label: string; to: { id: string } | { slug: string } };
};

export const PILLAR_DEFS: PillarDef[] = [
  {
    id: "confianza",
    title: "Confianza",
    text: "Una empresa familiar que entiende la responsabilidad de construir para otras familias.",
    evidence: { label: "Conocé a la familia", to: { id: "nosotros" } },
  },
  {
    id: "experiencia",
    title: "Experiencia",
    text: "Más de 40 años de trayectoria familiar en construcción.",
    evidence: { label: "Ver Le Sirenuse", to: { slug: "le-sirenuse" } },
  },
  {
    id: "profesionalismo",
    title: "Profesionalismo",
    text: "Planificación, organización, ejecución y atención a los detalles.",
    evidence: { label: "Ver cómo trabajamos", to: { id: "proceso" } },
  },
  {
    id: "eficiencia",
    title: "Eficiencia",
    text: "Soluciones constructivas adaptadas a cada proyecto y a las necesidades del cliente.",
    evidence: { label: "Explorar los sistemas", to: { id: "sistemas" } },
  },
];
