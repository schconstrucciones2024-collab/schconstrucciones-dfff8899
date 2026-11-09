import { distance, exteriorSegments, signedArea, type Point } from "./geometry";
import { DECK_3D, DECK_DESNIVEL_UMBRAL, clampFrente, type DeckConfig } from "./deck";

/** El frente de la casa es el muro donde está la escalinata de entrada (`edge-2`). */
export const DECK_WALL = "edge-2";

export type DeckPlacement = {
  wallId: string;
  /** Centro del borde del deck pegado a la casa, sobre la cara exterior del muro. */
  origin: Point;
  /** Hacia la derecha de quien mira la fachada desde afuera. */
  right: Point;
  /** Hacia afuera de la casa. */
  outward: Point;
  width: number;
  depth: number;
  /** Las cuatro esquinas del deck en planta: pegadas a la casa (izquierda, derecha) y exteriores (derecha, izquierda). */
  corners: Point[];
  /** Posición del centro del deck a lo largo del frente, desde el centro del muro (m). */
  centerOffset: number;
  /** Posición del eje de la puerta de entrada en el marco del deck (x hacia la derecha, 0 = centro del deck); null si no hay. */
  doorX: number | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * El frente de la casa: la cara exterior del muro de la entrada, de esquina a esquina. Se mide a lo largo del muro desde
 * su centro (`start` y `end`, en m): en una esquina hacia afuera la cara exterior se pasa del eje del muro, y en una
 * esquina hacia adentro (casas en L) queda más corta.
 */
export function deckFrontSpan(contour: Point[], wallThickness: number) {
  const n = contour.length,
    segments = exteriorSegments(contour),
    index = Math.max(
      0,
      segments.findIndex((s) => s.id === DECK_WALL),
    ),
    wall = segments[index] ?? segments[segments.length - 1];
  if (!wall || n < 3) return null;
  const length = distance(wall.a, wall.b);
  if (length < 1e-6) return null;
  const dirOf = (a: Point, b: Point) => {
    const d = distance(a, b);
    return d < 1e-9 ? null : { x: (b.x - a.x) / d, z: (b.z - a.z) / d };
  };
  const dir = dirOf(wall.a, wall.b),
    prev = dirOf(contour[(index + n - 1) % n] ?? wall.a, wall.a),
    next = dirOf(wall.b, contour[(index + 2) % n] ?? wall.b);
  if (!dir) return null;
  const sign = signedArea(contour) > 0 ? 1 : -1;
  // Cuánto se corre la cara exterior en una esquina con el giro dado (positivo: esquina hacia afuera).
  const overhang = (from: { x: number; z: number } | null, to: { x: number; z: number } | null) => {
    if (!from || !to) return 0;
    const turn = Math.atan2(from.x * to.z - from.z * to.x, from.x * to.x + from.z * to.z) * sign;
    return (wallThickness / 2) * clamp(Math.tan(turn / 2), -4, 4);
  };
  const start = -length / 2 - overhang(prev, dir),
    end = length / 2 + overhang(dir, next);
  return { start, end, length: end - start, center: (start + end) / 2 };
}

/**
 * El deck tal cual se dibuja y se cotiza: con «frente completo» el ancho es el del frente de la casa (redondeado al
 * centímetro); si no, el que escribió el cliente. Sin deck o sin diseño donde medir, queda como está.
 */
export function resolveDeck(deck: DeckConfig, contour: Point[], wallThickness: number): DeckConfig {
  if (!deck.enabled || !deck.fullFront) return deck;
  const span = deckFrontSpan(contour, wallThickness);
  if (!span) return deck;
  return { ...deck, width: Math.round(clampFrente(span.length, 2) * 100) / 100 };
}

/**
 * Dónde queda el deck: pegado a la cara exterior del frente y centrado en la puerta de entrada (`doorOffset`, medido desde
 * el centro del muro). Si el deck es más corto que el frente, se corre lo justo para no pasarse de las esquinas; si es más
 * largo, queda centrado y sobresale parejo de los dos lados.
 */
export function deckPlacement(
  contour: Point[],
  wallThickness: number,
  deck: Pick<DeckConfig, "width" | "depth">,
  doorOffset: number | null,
): DeckPlacement | null {
  const segments = exteriorSegments(contour),
    wall = segments.find((s) => s.id === DECK_WALL) ?? segments[segments.length - 1];
  if (!wall) return null;
  const length = distance(wall.a, wall.b);
  if (length < 1e-6) return null;
  const dir = { x: (wall.b.x - wall.a.x) / length, z: (wall.b.z - wall.a.z) / length },
    sign = signedArea(contour) > 0 ? 1 : -1,
    inward = { x: -dir.z * sign, z: dir.x * sign },
    outward = { x: -inward.x, z: -inward.z },
    right = { x: -inward.z, z: inward.x },
    half = deck.width / 2,
    span = deckFrontSpan(contour, wallThickness) ?? {
      start: -length / 2,
      end: length / 2,
      length,
      center: 0,
    };
  // Si cubre todo el frente (o más), queda centrado en él; si es más corto, se centra en la puerta sin pasarse de las esquinas.
  const centerOffset =
    deck.width >= span.length - 0.01
      ? span.center
      : clamp(doorOffset ?? span.center, span.start + half, span.end - half);
  const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 },
    origin = {
      x: mid.x + dir.x * centerOffset + outward.x * (wallThickness / 2),
      z: mid.z + dir.z * centerOffset + outward.z * (wallThickness / 2),
    };
  const at = (s: number, t: number): Point => ({
    x: origin.x + right.x * s + outward.x * t,
    z: origin.z + right.z * s + outward.z * t,
  });
  return {
    wallId: wall.id,
    origin,
    right,
    outward,
    width: deck.width,
    depth: deck.depth,
    corners: [at(-half, 0), at(half, 0), at(half, deck.depth), at(-half, deck.depth)],
    centerOffset,
    // `right` es el sentido contrario al del muro cuando el contorno gira a la izquierda (y el mismo cuando gira a la derecha).
    doorX: doorOffset === null ? null : -sign * (doorOffset - centerOffset),
  };
}

/** Altura (m) de la cara superior del deck: siempre por debajo del umbral de la puerta de entrada. */
export const deckTopY = (floorBaseY: number) => Math.max(0.05, floorBaseY - DECK_DESNIVEL_UMBRAL);

/** Cantidad de escalones del suelo al deck (alzada ≤ 18 cm). Con 1 no hace falta ninguno. */
export const deckStepCount = (topY: number) =>
  Math.max(1, Math.ceil(topY / DECK_3D.escalonAlzada - 1e-9));

/** Alturas del techo sobre el deck: libre en el borde exterior y más alto contra la casa, para que escurra el agua. */
export function deckRoofHeights(depth: number) {
  const outer = DECK_3D.techoAlturaExterior,
    inner = Math.min(DECK_3D.techoAlturaMax, outer + DECK_3D.techoPendiente * depth);
  return { outer, inner };
}
