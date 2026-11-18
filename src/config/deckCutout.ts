/**
 * Recortes del deck y del techo alrededor de un obstáculo que nace del terreno (hoy, el parrillero).
 *
 * Es geometría pura en planta (x, z): no sabe nada de three.js ni del parrillero. El deck NO se apoya en el obstáculo ni lo
 * eleva: es el deck el que se adapta. Las tablas, tirantes, vigas, pilotes, escalones, barandas y tornillos que caen sobre la
 * huella se cortan (o se sacan), con una holgura chica para que la madera no toque la mampostería; el techo se abre solo
 * donde pasa la chimenea.
 */

export type Vec3 = [number, number, number];
/** Misma forma que `DeckBox` (deckLayout.ts): se repite acá para que este archivo no dependa de aquel. */
export type Box = { size: Vec3; pos: Vec3; bevel?: number };

/** Rectángulo en planta: x hacia la derecha, z hacia afuera de la casa (en el marco que se indique). */
export type Rect = { x0: number; x1: number; z0: number; z1: number };

/** Holgura (m) entre la madera del deck y la mampostería. */
export const DECK_HOLGURA = 0.03;
/** Holgura (m) del techo alrededor de la chimenea: la justa, para que la abertura sea la de la chimenea y no más. */
export const TECHO_HOLGURA = 0.05;
/** Holgura (m) de un poste del techo respecto de la mampostería. */
export const POSTE_HOLGURA = 0.08;

/** Lo que el deck necesita saber de un obstáculo, todo en el marco del deck. */
export type DeckObstacle = {
  /** Huella completa de la base (de la losa para abajo): ahí no hay madera. */
  footprint: Rect;
  /** Huella de la chimenea y altura (m sobre el suelo) de su remate. */
  chimney: Rect;
  chimneyTop: number;
  /** Huella de la campana (la parte alta del cuerpo) y altura (m sobre el suelo) de su punto más alto. */
  hood: Rect;
  hoodTop: number;
};

export const inflate = (r: Rect, by: number): Rect => ({ x0: r.x0 - by, x1: r.x1 + by, z0: r.z0 - by, z1: r.z1 + by });
export const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
export const unionRect = (a: Rect, b: Rect): Rect => ({
  x0: Math.min(a.x0, b.x0),
  x1: Math.max(a.x1, b.x1),
  z0: Math.min(a.z0, b.z0),
  z1: Math.max(a.z1, b.z1),
});

/** Rectángulo de una caja en planta. */
export const boxRect = (b: Box): Rect => ({
  x0: b.pos[0] - b.size[0] / 2,
  x1: b.pos[0] + b.size[0] / 2,
  z0: b.pos[2] - b.size[2] / 2,
  z1: b.pos[2] + b.size[2] / 2,
});

/** Lo más chico (m) que puede medir un pedazo de madera que queda después del corte; menos que eso se descarta. */
const PEDAZO_MINIMO = 0.04;

/**
 * Resta un rectángulo (en planta) a una caja. Devuelve los pedazos que quedan: la caja entera si no se tocan, nada si queda
 * cubierta, y hasta cuatro pedazos si el rectángulo le muerde un costado o el medio. La altura (y) no cambia.
 */
export function subtractRect(box: Box, cut: Rect): Box[] {
  const r = boxRect(box);
  if (!overlaps(r, cut)) return [box];
  const out: Box[] = [];
  const [, sy] = box.size,
    y = box.pos[1];
  const piece = (x0: number, x1: number, z0: number, z1: number) => {
    if (x1 - x0 < PEDAZO_MINIMO || z1 - z0 < PEDAZO_MINIMO) return;
    const next: Box = { size: [x1 - x0, sy, z1 - z0], pos: [(x0 + x1) / 2, y, (z0 + z1) / 2] };
    if (box.bevel !== undefined) next.bevel = box.bevel;
    out.push(next);
  };
  const cx0 = Math.max(r.x0, cut.x0),
    cx1 = Math.min(r.x1, cut.x1);
  // Franjas a los costados del corte (todo el ancho en z) y, entre ellas, lo que sobra por delante y por detrás.
  piece(r.x0, cx0, r.z0, r.z1);
  piece(cx1, r.x1, r.z0, r.z1);
  piece(cx0, cx1, r.z0, Math.min(r.z1, cut.z0));
  piece(cx0, cx1, Math.max(r.z0, cut.z1), r.z1);
  return out;
}

/** Resta varios rectángulos a una lista de cajas. */
export function cutBoxes(boxes: Box[], cuts: Rect[]): Box[] {
  let current = boxes;
  for (const cut of cuts) {
    const next: Box[] = [];
    for (const b of current) {
      const parts = subtractRect(b, cut);
      for (const p of parts) next.push(p);
    }
    current = next;
  }
  return current;
}

/** Saca las cajas cuyo centro cae dentro del rectángulo (tornillos, bajadas de agua). */
export const dropInside = (boxes: Box[], cut: Rect): Box[] =>
  boxes.filter((b) => !(b.pos[0] > cut.x0 && b.pos[0] < cut.x1 && b.pos[2] > cut.z0 && b.pos[2] < cut.z1));

/** Saca las cajas que tocan el rectángulo (barandas y escalones: no se cortan, se sacan enteras). */
export const dropTouching = (boxes: Box[], cut: Rect): Box[] => boxes.filter((b) => !overlaps(boxRect(b), cut));

/** Intersección de un rectángulo con los límites del deck; null si no se tocan. */
export function clipRect(r: Rect, bounds: Rect): Rect | null {
  const out = {
    x0: Math.max(r.x0, bounds.x0),
    x1: Math.min(r.x1, bounds.x1),
    z0: Math.max(r.z0, bounds.z0),
    z1: Math.min(r.z1, bounds.z1),
  };
  return out.x1 - out.x0 > 1e-6 && out.z1 - out.z0 > 1e-6 ? out : null;
}

/**
 * Abertura del techo del deck: SOLO la chimenea (con una holgura chica). La campana se incluye únicamente si el techo pasaría
 * por ella (porque a esa altura la cara inferior del techo queda por debajo de lo más alto de la campana): con las alturas de
 * fábrica el techo queda por encima de la campana y esto no pasa. `undersideAt(z)` devuelve la altura (m sobre el suelo) de la
 * cara inferior del techo en esa z. `rect` es null si el obstáculo no toca el techo; `byHood`, si la campana hizo agrandar la abertura.
 */
export function roofOpeningDetail(
  o: DeckObstacle,
  roofBounds: Rect,
  undersideAt: (z: number) => number,
  margin = 0.07,
): { rect: Rect | null; byHood: boolean } {
  const chim = inflate(o.chimney, TECHO_HOLGURA);
  let opening: Rect | null = overlaps(chim, roofBounds) && o.chimneyTop > undersideAt(o.chimney.z0) - 0.05 ? chim : null,
    byHood = false;
  const hood = inflate(o.hood, TECHO_HOLGURA);
  if (overlaps(hood, roofBounds)) {
    // El punto del techo más bajo sobre la campana es el más cercano a la fachada de afuera (la caída es hacia afuera).
    const lowest = Math.min(undersideAt(Math.max(o.hood.z0, roofBounds.z0)), undersideAt(Math.min(o.hood.z1, roofBounds.z1)));
    if (o.hoodTop + margin > lowest) {
      byHood = true;
      opening = opening ? unionRect(opening, hood) : hood;
    }
  }
  return { rect: opening ? clipRect(opening, roofBounds) : null, byHood };
}

/** Abertura del techo del deck (ver `roofOpeningDetail`); null si el techo queda entero. */
export function roofOpening(o: DeckObstacle, roofBounds: Rect, undersideAt: (z: number) => number, margin = 0.07): Rect | null {
  return roofOpeningDetail(o, roofBounds, undersideAt, margin).rect;
}
