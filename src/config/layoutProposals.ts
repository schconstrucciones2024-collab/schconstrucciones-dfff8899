import type { Point } from './geometry';

type RoomBox = { name: string; kind: 'bed' | 'bath'; x: number; z: number; w: number; d: number; door: Point };
export type LayoutProposal = { id: string; name: string; width: number; depth: number; bedrooms: number; bathrooms: number; description: string; rooms: RoomBox[]; extra?: [Point, Point][] };

/** Dimensioned room boxes only — this module must never import the store (the store reads it at load time). */
/** The distribution the viewer opens with. */
export const COMPACTA_PROPOSAL: LayoutProposal = { id: 'compacta', name: 'Compacta abierta', width: 6, depth: 8, bedrooms: 1, bathrooms: 1,
  description: '48 m² · Vida social amplia y pocos pasillos. Dormitorio retirado de la entrada.',
  rooms: [
    { name: 'Dormitorio', kind: 'bed', x: 0, z: 0, w: 3.8, d: 3.3, door: { x: 2.9, z: 3.3 } },
    { name: 'Baño', kind: 'bath', x: 3.8, z: 0, w: 2.2, d: 3.3, door: { x: 5.1, z: 3.3 } },
  ] };
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
