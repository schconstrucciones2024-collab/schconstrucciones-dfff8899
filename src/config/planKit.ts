import type { Point } from "./geometry";
import type { PlanOpening, RoomBox, RoomKind } from "./layoutProposals";

/** Herramientas para escribir distribuciones: ambientes, contornos en L y aberturas. Solo datos, sin dependencias del store. */
export const pt = (x: number, z: number): Point => ({ x, z });

/** Ambiente rectangular. `door` es el punto de la puerta (x, z) sobre su borde. */
export const room = (
  name: string,
  kind: RoomKind,
  x: number,
  z: number,
  w: number,
  d: number,
  door?: [number, number],
  more: Partial<RoomBox> = {},
): RoomBox => ({
  name,
  kind,
  x,
  z,
  w,
  d,
  ...(door ? { door: pt(door[0], door[1]) } : {}),
  ...more,
});

/** Tabique suelto de (x1, z1) a (x2, z2). */
export const wall = (x1: number, z1: number, x2: number, z2: number): [Point, Point] => [
  pt(x1, z1),
  pt(x2, z2),
];

export type LCorner = "NE" | "NW" | "SE" | "SW";
/**
 * Contorno en L dentro de un rectángulo `width` × `depth`: se le quita el rincón `corner` de `notchW` × `notchD`.
 * Los vértices salen en el mismo sentido que el rectángulo y con el lado largo del frente como borde 2 (el acceso),
 * igual que en las casas rectangulares.
 */
export function lContour(
  width: number,
  depth: number,
  notchW: number,
  notchD: number,
  corner: LCorner,
): Point[] {
  const w = width,
    d = depth,
    nw = notchW,
    nd = notchD;
  const ring: Record<LCorner, [number, number][]> = {
    NE: [
      [w - nw, nd],
      [w, nd],
      [w, d],
      [0, d],
      [0, 0],
      [w - nw, 0],
    ],
    NW: [
      [nw, 0],
      [w, 0],
      [w, d],
      [0, d],
      [0, nd],
      [nw, nd],
    ],
    SE: [
      [w, d - nd],
      [w - nw, d - nd],
      [w - nw, d],
      [0, d],
      [0, 0],
      [w, 0],
    ],
    SW: [
      [0, 0],
      [w, 0],
      [w, d],
      [nw, d],
      [nw, d - nd],
      [0, d - nd],
    ],
  };
  return ring[corner].map(([x, z]) => pt(x, z));
}

/** Aberturas: ventana, ventana grande, ventana de cocina. */
export const win = (x: number, z: number): PlanOpening => ["ventana", x, z];
export const bigWin = (x: number, z: number): PlanOpening => ["ventanaGrande", x, z];
export const kitchenWin = (x: number, z: number): PlanOpening => ["ventanaCocina", x, z];
export const glassDoor = (x: number, z: number): PlanOpening => ["ventanal", x, z];
export const frontDoor = (x: number, z: number): PlanOpening => ["entrada", x, z];
export const doorAt = (x: number, z: number): PlanOpening => ["interior", x, z];
