import { DECK_3D, type DeckConfig } from "./deck";
import { deckRoofHeights, deckStepCount } from "./deckGeometry";

/**
 * Piezas del deck para el visor 3D, en metros y en el marco propio del deck: x hacia la derecha de quien mira la
 * fachada, z hacia afuera de la casa (z = 0 es la cara exterior del muro) e y hacia arriba desde el suelo.
 * Es una función pura (sin three.js) para poder probarla: el visor solo dibuja estas cajas.
 */
export type Vec3 = [number, number, number];
export type DeckBox = { size: Vec3; pos: Vec3 };

export type DeckRoofLayout = {
  /** Postes (verticales), en el marco del deck. */
  posts: DeckBox[];
  /** Plano inclinado del techo: punto de origen (sobre el borde exterior), inclinación y largo. */
  plane: { origin: Vec3; angle: number; length: number };
  /** Vigas, tirantes y clavadores, en el marco del plano (z negativo hacia la casa; y = 0 es la cara inferior de las vigas). */
  planeBoxes: DeckBox[];
  /** Chapa: ancho (en x), y tramo en z del plano; apoya en y = `y`. */
  sheet: { width: number; z0: number; z1: number; y: number };
};

export type DeckLayout = {
  topY: number;
  /** Tablas de deck (con el tinte). */
  boards: DeckBox[];
  /** Estructura de madera: tirantes secundarios y vigas principales. */
  frame: DeckBox[];
  /** Pilotes (madera curada, sin tinte). */
  piles: DeckBox[];
  /** Escalones del frente. */
  steps: DeckBox[];
  /** Postes, pasamanos y travesaños de baranda. */
  rails: DeckBox[];
  roof: DeckRoofLayout | null;
};

const {
  tablaEspesor,
  tablaAncho,
  tablaJunta,
  largoMadera,
  tiranteAlto,
  tiranteAncho,
  tiranteSeparacion,
} = DECK_3D;
/** Separación entre el deck y el muro, para que las tablas no se metan en el revestimiento. */
const HOLGURA_CASA = 0.01;
/** Distancia mínima (m) del eje de la puerta a un poste del frente: la puerta mide 1 m y necesita su espacio libre. */
const PUERTA_LIBRE = 0.75;

/** Reparte `n` posiciones parejas entre `a` y `b` (incluidos los dos extremos). */
const spread = (a: number, b: number, n: number) =>
  n <= 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

/** Corta un tramo [a, b] en piezas de a lo sumo `max`; la primera mide `first` (para escalonar los empalmes). */
function pieces(a: number, b: number, max: number, first = max): [number, number][] {
  const out: [number, number][] = [];
  let start = a,
    len = Math.min(first, max);
  while (start < b - 1e-6) {
    const end = Math.min(b, start + len);
    out.push([start, end]);
    start = end;
    len = max;
  }
  return out;
}

/** Un tramo de baranda entre `a` y `b` sobre una línea fija: postes cada 1,20 m como máximo, pasamanos y dos travesaños. */
function railRun(axis: "x" | "z", fixed: number, a: number, b: number, topY: number): DeckBox[] {
  const length = b - a;
  if (length < 0.2) return [];
  const {
    barandaAltura: alto,
    barandaPoste: poste,
    barandaCada: cada,
    barandaTravesaño: tr,
  } = DECK_3D;
  const pasamanos = 0.04,
    postes = Math.max(2, Math.ceil(length / cada - 1e-9) + 1),
    boxes: DeckBox[] = [];
  const along = (t: number, y: number, size: Vec3): DeckBox =>
    axis === "x"
      ? { size, pos: [t, y, fixed] }
      : { size: [size[2], size[1], size[0]], pos: [fixed, y, t] };
  const ts = spread(a, b, postes);
  for (const t of ts)
    boxes.push(along(t, topY + (alto - pasamanos) / 2, [poste, alto - pasamanos, poste]));
  // Pasamanos y travesaños en tramos de poste a poste (nunca pasan de 1,20 m, aunque la baranda sea muy larga).
  for (let i = 0; i < ts.length - 1; i++) {
    const t0 = ts[i] ?? a,
      t1 = ts[i + 1] ?? b,
      seg = t1 - t0;
    boxes.push(along((t0 + t1) / 2, topY + alto - pasamanos / 2, [seg + poste, pasamanos, 0.1]));
    for (const h of [0.35, 0.68]) boxes.push(along((t0 + t1) / 2, topY + h, [seg, tr[1], tr[0]]));
  }
  return boxes;
}

/** Calcula todas las piezas del deck para una altura de cara superior `topY`. */
export function deckLayout(
  deck: Pick<
    DeckConfig,
    "width" | "depth" | "roofed" | "railFront" | "railLeft" | "railRight" | "steps"
  >,
  topY: number,
  doorX: number | null = null,
): DeckLayout {
  const W = deck.width,
    D = deck.depth,
    z0 = HOLGURA_CASA;

  // Tablas: filas paralelas a la fachada, con juntas y empalmes cada 3,30 m (escalonados si el frente supera ese largo).
  const filas = Math.max(1, Math.floor((D - z0 + tablaJunta) / (tablaAncho + tablaJunta))),
    ancho = (D - z0 - (filas - 1) * tablaJunta) / filas,
    boards: DeckBox[] = [];
  for (let i = 0; i < filas; i++) {
    const zc = z0 + ancho / 2 + i * (ancho + tablaJunta),
      first = W <= largoMadera ? largoMadera : largoMadera * (1 - (i % 3) / 3);
    for (const [a, b] of pieces(-W / 2, W / 2, largoMadera, first)) {
      const gap = b - a > 0.3 ? 0.004 : 0;
      boards.push({
        size: [b - a - gap, tablaEspesor, ancho],
        pos: [(a + b) / 2, topY - tablaEspesor / 2, zc],
      });
    }
  }

  // Estructura: tirantes secundarios (a lo largo de z) sobre vigas principales (a lo largo de x) sobre pilotes.
  const disponible = topY - tablaEspesor,
    altoTirante = Math.min(tiranteAlto, disponible),
    resto = disponible - altoTirante,
    altoViga = resto >= tiranteAlto + 0.08 ? tiranteAlto : 0,
    altoPilote = Math.max(0, resto - altoViga),
    frame: DeckBox[] = [],
    piles: DeckBox[] = [];
  const nTirantes = Math.max(2, Math.ceil((W - tiranteAncho) / tiranteSeparacion - 1e-9) + 1);
  for (const x of spread(-W / 2 + tiranteAncho / 2, W / 2 - tiranteAncho / 2, nTirantes))
    for (const [a, b] of pieces(z0, D, largoMadera))
      frame.push({
        size: [tiranteAncho, altoTirante, b - a - (b - a > 0.3 ? 0.004 : 0)],
        pos: [x, topY - tablaEspesor - altoTirante / 2, (a + b) / 2],
      });
  const lineas = spread(
    0.12,
    D - 0.1,
    Math.max(2, Math.ceil((D - 0.22) / DECK_3D.pilotesCada - 1e-9) + 1),
  );
  for (const z of lineas) {
    if (altoViga > 0)
      for (const [a, b] of pieces(-W / 2, W / 2, largoMadera))
        frame.push({
          size: [b - a - (b - a > 0.3 ? 0.004 : 0), altoViga, tiranteAncho],
          pos: [(a + b) / 2, topY - tablaEspesor - altoTirante - altoViga / 2, z],
        });
    if (altoPilote > 0.02) {
      if (altoViga > 0) {
        const nPil = Math.max(2, Math.ceil((W - 0.3) / DECK_3D.pilotesCada - 1e-9) + 1);
        for (const x of spread(-W / 2 + 0.15, W / 2 - 0.15, nPil))
          piles.push({
            size: [DECK_3D.pilote, altoPilote, DECK_3D.pilote],
            pos: [x, altoPilote / 2, z],
          });
      } else {
        // Deck bajo (sobre platea): una solera corrida apoya los tirantes en lugar de pilotes.
        piles.push({ size: [W - 0.2, altoPilote, 0.1], pos: [0, altoPilote / 2, z] });
      }
    }
  }

  // Escalones: del suelo al deck, con alzada pareja (≤ 18 cm), al frente y enfrente de la puerta de entrada (sin salirse
  // del deck, que puede cubrir todo el frente y tener la puerta corrida del centro).
  const steps: DeckBox[] = [],
    nEsc = deckStepCount(topY);
  const hayEscalones = deck.steps && nEsc > 1,
    ancho2 = Math.min(DECK_3D.escalonAncho, Math.max(0.6, W - 0.2)),
    xEsc = Math.max(-(W - ancho2) / 2, Math.min((W - ancho2) / 2, doorX ?? 0));
  if (hayEscalones) {
    const alzada = topY / nEsc,
      huella = DECK_3D.escalonHuella;
    for (let k = 1; k < nEsc; k++) {
      const alto = topY - k * alzada,
        zc = D + (k - 0.5) * huella;
      steps.push({ size: [ancho2, 0.04, huella], pos: [xEsc, alto - 0.02, zc] });
      steps.push({
        size: [ancho2, alzada - 0.04, 0.02],
        pos: [xEsc, alto - 0.04 - (alzada - 0.04) / 2, D + k * huella - 0.01],
      });
      for (const s of [-1, 1])
        steps.push({
          size: [0.05, alto, huella],
          pos: [xEsc + s * (ancho2 / 2 - 0.025), alto / 2, zc],
        });
    }
  }

  // Barandas: frente (con un hueco para los escalones), lateral izquierdo y lateral derecho. El lado de la casa no lleva.
  const rails: DeckBox[] = [],
    inset = DECK_3D.barandaPoste / 2;
  if (deck.railFront) {
    const zf = D - inset;
    if (hayEscalones) {
      const hueco = ancho2 / 2;
      rails.push(
        ...railRun("x", zf, -W / 2 + inset, xEsc - hueco, topY),
        ...railRun("x", zf, xEsc + hueco, W / 2 - inset, topY),
      );
    } else rails.push(...railRun("x", zf, -W / 2 + inset, W / 2 - inset, topY));
  }
  if (deck.railLeft) rails.push(...railRun("z", -W / 2 + inset, z0 + inset, D - inset, topY));
  if (deck.railRight) rails.push(...railRun("z", W / 2 - inset, z0 + inset, D - inset, topY));

  return {
    topY,
    boards,
    frame,
    piles,
    steps,
    rails,
    roof: deck.roofed ? roofLayout(W, D, topY, doorX) : null,
  };
}

/**
 * Techo de chapa: postes dobles, vigas, tirantes 4x2, clavadores y chapa, con caída hacia afuera. Ninguna madera pasa de
 * 3,30 m: los postes y las vigas se reparten cada 3,30 m como máximo, a lo ancho y, en un deck profundo, también a lo largo.
 */
export function roofLayout(
  W: number,
  D: number,
  topY: number,
  doorX: number | null = null,
): DeckRoofLayout {
  const { techoAlturaExterior: outerH, posteSeccion } = DECK_3D,
    { inner } = deckRoofHeights(D),
    viga = 0.15,
    zFront = D - 0.1,
    zHouse = 0.05,
    run = Math.max(0.5, zFront - zHouse),
    rise = inner - outerH,
    angle = Math.atan2(rise, run),
    length = Math.hypot(run, rise),
    xs = W / 2 - 0.1;

  // Cantidad impar de tramos (1, 3, 5…): así no cae un poste justo en el centro, donde está la puerta de entrada.
  let nTramos = Math.max(1, Math.ceil((2 * xs) / largoMadera - 1e-9));
  if (nTramos % 2 === 0) nTramos += 1;
  const postXs: number[] = [];
  for (let i = 0; i <= nTramos; i++) {
    let x = -xs + (2 * xs * i) / nTramos;
    // Si el deck quedó corrido respecto de la puerta, ningún poste intermedio se para frente a ella.
    if (doorX !== null && i > 0 && i < nTramos && Math.abs(x - doorX) < PUERTA_LIBRE)
      x = doorX + (x >= doorX ? PUERTA_LIBRE : -PUERTA_LIBRE);
    postXs.push(x);
  }
  // Filas de postes a lo largo de la caída: el frente y, si el deck es profundo, una cada 3,30 m. La última fila es la
  // viga contra la casa, que no lleva postes.
  const nFilas = Math.max(1, Math.ceil(run / largoMadera - 1e-9)),
    localZ = (i: number) => (-i * length) / nFilas;
  const posts: DeckBox[] = [];
  for (let i = 0; i < nFilas; i++) {
    const alto = outerH + (rise * i) / nFilas;
    for (const x of postXs)
      // Poste doble: dos 6x2 pegados, con una junta fina que se ve como costura.
      for (const s of [-1, 1])
        posts.push({
          size: [posteSeccion[0] / 2 - 0.002, alto, posteSeccion[1]],
          pos: [x + (s * posteSeccion[0]) / 4, topY + alto / 2, zFront - (i * run) / nFilas],
        });
  }

  const planeBoxes: DeckBox[] = [],
    beamY = viga / 2;
  // Vigas a lo ancho: una por fila de postes y la de la casa, cortadas entre poste y poste.
  for (let i = 0; i <= nFilas; i++)
    for (let k = 0; k < postXs.length - 1; k++) {
      const a = postXs[k] ?? 0,
        b = postXs[k + 1] ?? 0;
      planeBoxes.push({
        size: [b - a + 0.05 - 0.004, viga, 0.05],
        pos: [(a + b) / 2, beamY, localZ(i)],
      });
    }
  // Vigas laterales, entre fila y fila.
  for (const s of [-1, 1])
    for (let i = 0; i < nFilas; i++)
      planeBoxes.push({
        size: [0.05, viga, length / nFilas - 0.004],
        pos: [s * xs, beamY, (localZ(i) + localZ(i + 1)) / 2],
      });
  // Tirantes secundarios 4x2 (sobre las vigas, a lo largo de la caída) y clavadores (a lo ancho, sobre los tirantes).
  const alero = 0.12,
    nTir = Math.max(2, Math.ceil((2 * xs) / 0.6 - 1e-9) + 1);
  for (const x of spread(-xs, xs, nTir))
    for (let i = 0; i < nFilas; i++) {
      const z1 = i === 0 ? alero : localZ(i),
        z0 = localZ(i + 1);
      planeBoxes.push({
        size: [0.05, 0.1, z1 - z0 - 0.004],
        pos: [x, viga + 0.05, (z0 + z1) / 2],
      });
    }
  const nCla = Math.max(2, Math.ceil((length + alero) / 0.5 - 1e-9) + 1);
  for (const z of spread(-length + 0.05, alero - 0.05, nCla))
    for (const [a, b] of pieces(-xs - 0.05, xs + 0.05, largoMadera))
      planeBoxes.push({
        size: [b - a - 0.004, 0.03, 0.05],
        pos: [(a + b) / 2, viga + 0.1 + 0.015, z],
      });

  return {
    posts,
    plane: { origin: [0, topY + outerH, zFront], angle, length },
    planeBoxes,
    sheet: { width: W + 0.2, z0: -length - 0.04, z1: alero, y: viga + 0.1 + 0.03 },
  };
}

/** Perfil de la chapa trapezoidal en x–y: paso 10 cm y nervio de 3 cm. Devuelve la línea superior; el espesor lo da el visor. */
export function sheetProfile(width: number, pitch = 0.1, rib = 0.03): [number, number][] {
  const n = Math.max(1, Math.round(width / pitch)),
    x0 = -(n * pitch) / 2,
    pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * pitch;
    pts.push([x, 0], [x + pitch * 0.3, 0], [x + pitch * 0.5, rib], [x + pitch * 0.8, rib]);
  }
  pts.push([x0 + n * pitch, 0]);
  return pts;
}
