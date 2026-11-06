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

export const DEFAULT_FINISH: Record<SystemId, FinishId> = {
  woodframe: "rustica",
  tradicional: "esencial",
};

export const systemOf = (finish: FinishId): SystemId =>
  finish === "esencial" || finish === "clasica" ? "tradicional" : "woodframe";

/**
 * Bases disponibles. Woodframe va sobre pilotes; Tradicional va sobre platea de hormigón (la base por defecto)
 * o, si el terreno lo pide, sobre pilotes de hormigón.
 */
export const FOUNDATIONS_BY_SYSTEM: Record<SystemId, FoundationId[]> = {
  woodframe: ["hormigon", "madera"],
  tradicional: ["platea", "hormigon"],
};

/** Base con la que arranca todo diseño de cada sistema. */
export const DEFAULT_FOUNDATION: Record<SystemId, FoundationId> = {
  woodframe: "hormigon",
  tradicional: "platea",
};

/** Espesor (m) del muro exterior: la mampostería con revoque es más gruesa que el panel de woodframe. */
export const EXTERIOR_THICKNESS: Record<SystemId, number> = { woodframe: 0.15, tradicional: 0.2 };
export const exteriorThickness = (finish: FinishId): number => EXTERIOR_THICKNESS[systemOf(finish)];

/** Techos posibles por terminación: Esencial lleva chapa (una caída o doble agua) y Clásica, losa de hormigón. */
export function allowedRoofs(finish: FinishId): RoofId[] {
  if (finish === "clasica") return ["plano"];
  if (finish === "esencial") return ["una", "dos"];
  return ["una", "dos", "plano"];
}

/** Altura (m) que sobresale la platea del terreno; sobre ella apoya la losa del piso. */
export const PLATEA_HEIGHT = 0.1;

/** Pendiente (°) con la que arranca el techo de chapa de la Esencial: sobre muros de mampostería es un techo bajo y prolijo. */
export const TRADICIONAL_MAX_PITCH = 8;

type Coherent = {
  finish: FinishId;
  foundation: FoundationId;
  roofType: RoofId;
  roofPitch?: number;
};

/**
 * Devuelve la configuración con base y techo compatibles con la terminación. Se llama cada vez que cambia algo,
 * por eso cambiar de sistema (o de Esencial a Clásica) conserva el diseño y solo adapta lo que ya no corresponde.
 */
export function coherentSystem<T extends Coherent>(c: T): T {
  const system = systemOf(c.finish);
  let foundation = c.foundation;
  if (!FOUNDATIONS_BY_SYSTEM[system].includes(foundation)) foundation = DEFAULT_FOUNDATION[system];
  let roofType = c.roofType;
  const roofs = allowedRoofs(c.finish);
  if (!roofs.includes(roofType)) roofType = c.finish === "clasica" ? "plano" : "una";
  return foundation === c.foundation && roofType === c.roofType
    ? c
    : { ...c, foundation, roofType };
}

/**
 * Cambios necesarios (terminación, base, techo y pendiente) para pasar un diseño al otro sistema. Vacío si ya está en él.
 * Todo diseño tradicional arranca con platea; al volver a Woodframe la base pasa a pilotes.
 */
export function systemPatch(c: Coherent, system: SystemId): Partial<Coherent> {
  if (systemOf(c.finish) === system) return {};
  const next = coherentSystem({
    ...c,
    finish: DEFAULT_FINISH[system],
    foundation: system === "tradicional" ? DEFAULT_FOUNDATION.tradicional : c.foundation,
  });
  const patch: Partial<Coherent> = {
    finish: next.finish,
    foundation: next.foundation,
    roofType: next.roofType,
  };
  if (
    system === "tradicional" &&
    c.roofPitch !== undefined &&
    c.roofPitch > TRADICIONAL_MAX_PITCH
  ) {
    patch.roofPitch = TRADICIONAL_MAX_PITCH;
  }
  return patch;
}
