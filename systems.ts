import type { SystemId } from "@/lib/cotizador";
import type { FinishId } from "./materials";
import type { FoundationId, RoofId } from "./pricing";

/**
 * Sistema constructivo del diseñador 3D. No se guarda aparte: se deduce de la terminación elegida
 * (Rústica/Moderna/Allwood = Woodframe, Esencial/Clásica = Tradicional), así los diseños guardados y los links
 * compartidos siguen funcionando sin cambios y el motor 3D es el mismo para los dos sistemas.
 */
export const FINISHES_BY_SYSTEM: Record<SystemId, FinishId[]> = {
  woodframe: ["rustica", "moderna", "allwood"],
  tradicional: ["esencial", "clasica"],
};

export const DEFAULT_FINISH: Record<SystemId, FinishId> = { woodframe: "rustica", tradicional: "esencial" };

export const systemOf = (finish: FinishId): SystemId =>
  finish === "esencial" || finish === "clasica" ? "tradicional" : "woodframe";

/** Bases disponibles: Woodframe va sobre pilotes; Tradicional, sobre pilotes de hormigón o platea de hormigón. */
export const FOUNDATIONS_BY_SYSTEM: Record<SystemId, FoundationId[]> = {
  woodframe: ["hormigon", "madera"],
  tradicional: ["hormigon", "platea"],
};

/** Techos posibles por terminación: Esencial lleva chapa (una caída o doble agua) y Clásica, losa de hormigón. */
export function allowedRoofs(finish: FinishId): RoofId[] {
  if (finish === "clasica") return ["plano"];
  if (finish === "esencial") return ["una", "dos"];
  return ["una", "dos", "plano"];
}

/** Altura (m) que sobresale la platea del terreno; sobre ella apoya la losa del piso. */
export const PLATEA_HEIGHT = 0.1;

type Coherent = { finish: FinishId; foundation: FoundationId; roofType: RoofId };

/**
 * Devuelve la configuración con base y techo compatibles con la terminación. Se llama cada vez que cambia algo,
 * por eso cambiar de sistema (o de Esencial a Clásica) conserva el diseño y solo adapta lo que ya no corresponde.
 */
export function coherentSystem<T extends Coherent>(c: T): T {
  const system = systemOf(c.finish);
  let foundation = c.foundation;
  if (!FOUNDATIONS_BY_SYSTEM[system].includes(foundation)) foundation = "hormigon";
  let roofType = c.roofType;
  const roofs = allowedRoofs(c.finish);
  if (!roofs.includes(roofType)) roofType = c.finish === "clasica" ? "plano" : "una";
  return foundation === c.foundation && roofType === c.roofType ? c : { ...c, foundation, roofType };
}

/** Cambios necesarios (terminación, base y techo) para pasar un diseño al otro sistema. Vacío si ya está en él. */
export function systemPatch(c: Coherent, system: SystemId): Partial<Coherent> {
  if (systemOf(c.finish) === system) return {};
  const next = coherentSystem({ ...c, finish: DEFAULT_FINISH[system] });
  return { finish: next.finish, foundation: next.foundation, roofType: next.roofType };
}
