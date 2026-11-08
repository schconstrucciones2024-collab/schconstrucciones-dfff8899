import { signedArea, type Point } from './geometry';
import type { OpeningType } from './openingsCatalog';
import { WOODFRAME_PLANS } from './plansWoodframe';
import { WOODFRAME_PLANS_EXTRA } from './plansWoodframeExtra';
import { TRADICIONAL_PLANS } from './plansTradicional';
import { TRADICIONAL_PLANS_EXTRA } from './plansTradicionalExtra';

/**
 * Catálogo de distribuciones del diseñador 3D. Este módulo solo contiene datos dimensionados: nunca debe importar el store
 * (el store lo lee al arrancar). Las coordenadas están en metros, con el origen en la esquina noroeste del rectángulo que
 * envuelve a la casa: x crece hacia el este y z hacia el frente, donde está el acceso (borde 2 del contorno).
 */
export type PlanSystem = 'woodframe' | 'tradicional';
export type PlanShape = 'rectangular' | 'L';
export type RoomKind = 'bed' | 'bath' | 'kitchen' | 'living' | 'service' | 'hall' | 'study';

export type RoomBox = {
  name: string;
  kind: RoomKind;
  x: number;
  z: number;
  w: number;
  d: number;
  /** Puerta interior (punto sobre el borde del ambiente). */
  door?: Point;
  /** Segunda puerta, por ejemplo la de una suite que comunica con su baño. */
  doors?: Point[];
  /** Baño o dormitorio con los artefactos / el cabezal pegados al muro sur en lugar del norte. */
  flip?: boolean;
  /** Posición (x absoluta) del centro de la cama; por defecto, el centro del dormitorio. */
  bedX?: number;
  /** Sin ventana automática (la cocina lleva la suya sobre la mesada). */
  noWindow?: boolean;
};
/** Abertura puntual: tipo y posición sobre el muro (x, z del plano). */
export type PlanOpening = [OpeningType, number, number];
/** Tramo lineal de mesada de cocina. rotation 0 = a lo largo de x; Math.PI / 2 = a lo largo de z. */
export type PlanCounter = { x: number; z: number; length: number; rotation?: number };
export type PlanStair = {
  floor: number;
  type: 'U' | 'L' | 'recta' | 'caracol';
  /** Esquina noroeste del rectángulo que ocupa la escalera. */
  at: Point;
  /** Lado por el que se sube (el borde abierto de la escalera). */
  open: 'N' | 'E' | 'S' | 'W';
  width?: number;
};
export type PlanFloor = {
  rooms: RoomBox[];
  /** Tabiques sueltos que no son parte de un ambiente cerrado. */
  extra?: [Point, Point][];
  openings?: PlanOpening[];
  counters?: PlanCounter[];
  /** Nombre del ambiente abierto (lo que no encierra ningún ambiente). */
  open?: string;
  /** Nombres de otros sectores abiertos: el que contiene el punto lleva ese nombre. */
  labels?: { at: Point; name: string }[];
};
export type LayoutProposal = {
  id: string;
  name: string;
  width: number;
  depth: number;
  bedrooms: number;
  bathrooms: number;
  description: string;
  rooms: RoomBox[];
  extra?: [Point, Point][];
} & Partial<Omit<PlanFloor, 'rooms' | 'extra'>> & {
  /** 2 = propuesta con datos explícitos (varias plantas, L, aberturas y escaleras propias). */
  version?: 2;
  system?: PlanSystem;
  floors?: number;
  footprint?: PlanShape;
  /** Contorno cuando no es el rectángulo; el borde 2 es el frente. */
  contour?: Point[];
  upper?: PlanFloor[];
  stairs?: PlanStair[];
  /** Acceso principal sobre el frente (borde 2). */
  entrance?: { x: number; type: 'entrada' | 'ventanal' };
  recommended?: boolean;
  /** Criterio de proyecto: por qué la distribución es así. */
  notes?: string[];
};

/** Plantas de la propuesta: la baja y las superiores. */
export function planLevels(p: LayoutProposal): PlanFloor[] {
  return [
    { rooms: p.rooms, extra: p.extra, openings: p.openings, counters: p.counters, open: p.open, labels: p.labels },
    ...(p.upper ?? []),
  ];
}

/** Dimensioned room boxes only — this module must never import the store (the store reads it at load time). */
/** The distribution the viewer opens with. */
export const COMPACTA_PROPOSAL: LayoutProposal = { id: 'compacta', name: 'Compacta abierta', width: 6, depth: 8, bedrooms: 1, bathrooms: 1,
  description: '48 m² · Vida social amplia y pocos pasillos. Dormitorio retirado de la entrada.',
  rooms: [
    { name: 'Dormitorio', kind: 'bed', x: 0, z: 0, w: 3.8, d: 3.3, door: { x: 2.9, z: 3.3 } },
    { name: 'Baño', kind: 'bath', x: 3.8, z: 0, w: 2.2, d: 3.3, door: { x: 5.1, z: 3.3 } },
  ] };
/** Las cuatro primeras distribuciones de una planta (se arman con las reglas originales). */
export const LAYOUT_PROPOSALS: LayoutProposal[] = [
  COMPACTA_PROPOSAL,
  { id: 'familiar', name: 'Familiar con sector privado', width: 8, depth: 9, bedrooms: 2, bathrooms: 1,
    description: '72 m² · Dormitorios juntos, acceso por distribuidor y baño separado de la cocina.',
    rooms: [
      { name: 'Dormitorio 1', kind: 'bed', x: 0, z: 0, w: 4, d: 3.4, door: { x: 3, z: 3.4 } },
      { name: 'Dormitorio 2', kind: 'bed', x: 4, z: 0, w: 4, d: 3.4, door: { x: 5, z: 3.4 } },
      { name: 'Baño', kind: 'bath', x: 0, z: 3.4, w: 2.2, d: 2.5, door: { x: 2.2, z: 4.7 } },
    ] },
  { id: 'longitudinal', name: 'Circulación longitudinal', width: 8, depth: 11, bedrooms: 3, bathrooms: 1,
    description: '88 m² · Tres dormitorios con accesos independientes y pasillo de 1,10 m nominal.',
    rooms: [
      { name: 'Dormitorio 1', kind: 'bed', x: 0, z: 0, w: 3.3, d: 3.6, door: { x: 3.3, z: 2.7 } },
      { name: 'Dormitorio 2', kind: 'bed', x: 0, z: 3.6, w: 3.3, d: 3.6, door: { x: 3.3, z: 6.3 } },
      { name: 'Dormitorio 3', kind: 'bed', x: 0, z: 7.2, w: 3.3, d: 3.8, door: { x: 3.3, z: 9.9 } },
      { name: 'Baño', kind: 'bath', x: 4.4, z: 0, w: 3.6, d: 2.5, door: { x: 4.4, z: 1.3 } },
    ], extra: [[{ x: 4.4, z: 2.5 }, { x: 4.4, z: 11 }]] },
  { id: 'suite', name: 'Familiar con suite', width: 12, depth: 8, bedrooms: 3, bathrooms: 2,
    description: '96 m² · Suite con baño propio, dos dormitorios y segundo baño para uso común.',
    rooms: [
      { name: 'Dormitorio principal', kind: 'bed', x: 0, z: 0, w: 3.4, d: 3.5, door: { x: 2.5, z: 3.5 } },
      { name: 'Baño suite', kind: 'bath', x: 0, z: 3.5, w: 2.2, d: 2.5, door: { x: 1.1, z: 3.5 } },
      { name: 'Dormitorio 2', kind: 'bed', x: 3.4, z: 0, w: 3.4, d: 3.5, door: { x: 4.3, z: 3.5 } },
      { name: 'Dormitorio 3', kind: 'bed', x: 6.8, z: 0, w: 3, d: 3.5, door: { x: 7.7, z: 3.5 } },
      { name: 'Baño común', kind: 'bath', x: 9.8, z: 0, w: 2.2, d: 3.5, door: { x: 11.1, z: 3.5 } },
    ] },
];

/** Todo el catálogo: las cuatro originales (woodframe, una planta) y las propuestas por sistema, plantas y forma. */
export const PLAN_CATALOG: LayoutProposal[] = [
  ...LAYOUT_PROPOSALS.map((p) => ({ ...p, system: 'woodframe' as const, floors: 1, footprint: 'rectangular' as const })),
  ...WOODFRAME_PLANS,
  ...WOODFRAME_PLANS_EXTRA,
  ...TRADICIONAL_PLANS,
  ...TRADICIONAL_PLANS_EXTRA,
];

export const planFloors = (p: LayoutProposal) => p.floors ?? 1;
export const planShape = (p: LayoutProposal): PlanShape => p.footprint ?? 'rectangular';
/** Superficie cubierta total (m²) de la propuesta: huella por cantidad de plantas. */
export function planArea(p: LayoutProposal): number {
  const outline = p.contour ?? [{ x: 0, z: 0 }, { x: p.width, z: 0 }, { x: p.width, z: p.depth }, { x: 0, z: p.depth }];
  return Math.abs(signedArea(outline)) * planFloors(p);
}
export function plansFor(system: PlanSystem, floors?: number, shape?: PlanShape): LayoutProposal[] {
  return PLAN_CATALOG.filter(
    (p) => (p.system ?? system) === system && (floors === undefined || planFloors(p) === floors) && (shape === undefined || planShape(p) === shape),
  );
}
/** La propuesta recomendada para un sistema, cantidad de plantas y forma: la marcada, o la más cercana a la superficie pedida. */
export function recommendedPlan(system: PlanSystem, floors: number, shape: PlanShape, m2?: number): LayoutProposal | undefined {
  const list = plansFor(system, floors, shape);
  return list.find((p) => p.recommended) ?? (m2 === undefined ? list[0] : [...list].sort((a, b) => Math.abs(planArea(a) - m2) - Math.abs(planArea(b) - m2))[0]);
}

/** Contorno en L: seis vértices ortogonales con un solo vértice entrante. */
export function isLShape(contour: Point[]): boolean {
  if (contour.length !== 6) return false;
  let reflex = 0;
  const sign = Math.sign(signedArea(contour));
  for (let i = 0; i < 6; i++) {
    const a = contour[(i + 5) % 6]!, b = contour[i]!, c = contour[(i + 1) % 6]!;
    const horizontalIn = Math.abs(a.z - b.z) < 1e-6, verticalIn = Math.abs(a.x - b.x) < 1e-6;
    const horizontalOut = Math.abs(b.z - c.z) < 1e-6, verticalOut = Math.abs(b.x - c.x) < 1e-6;
    if (!((horizontalIn && verticalOut) || (verticalIn && horizontalOut))) return false;
    if (Math.sign((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) !== sign) reflex++;
  }
  return reflex === 1;
}
