import { DECK_3D, DECK_LOOK, type DeckConfig, type DeckLine } from "./deck";
import { deckRoofHeights, deckStepCount } from "./deckGeometry";

/**
 * Piezas del deck para el visor 3D, en metros y en el marco propio del deck: x hacia la derecha de quien mira la
 * fachada, z hacia afuera de la casa (z = 0 es la cara exterior del muro) e y hacia arriba desde el suelo.
 * Es una función pura (sin three.js) para poder probarla: el visor solo dibuja estas cajas.
 *
 * Las dos líneas (Esencial y Premium) comparten la estructura: mismas tablas, tirantes, vigas, pilotes, postes y chapa.
 * La línea cambia lo que se nota de la calidad (ver `DECK_LOOK`): cantos biselados y zócalo perimetral, tirantes más
 * densos, barandas con listonado, columnas más gruesas, herrajes, canaletas y babetas en la Premium; tornillos a la vista
 * en la Esencial.
 */
export type Vec3 = [number, number, number];
/** Una caja de madera (o de metal). `bevel` (m) la dibuja con los cantos y las esquinas biselados. */
export type DeckBox = { size: Vec3; pos: Vec3; bevel?: number };

export type DeckRoofLayout = {
  /** Postes (verticales), en el marco del deck. */
  posts: DeckBox[];
  /** Plano inclinado del techo: punto de origen (sobre el borde exterior), inclinación y largo. */
  plane: { origin: Vec3; angle: number; length: number };
  /** Vigas, tirantes y clavadores, en el marco del plano (z negativo hacia la casa; y = 0 es la cara inferior de las vigas). */
  planeBoxes: DeckBox[];
  /** Chapa: ancho (en x), y tramo en z del plano; apoya en y = `y`. El perfil depende de la línea. */
  sheet: { width: number; z0: number; z1: number; y: number };
  /** Herrajes galvanizados de los postes (Premium), en el marco del deck. */
  hardware: DeckBox[];
  /** Canaleta y bajadas de agua (Premium), en el marco del deck. */
  trim: DeckBox[];
  /** Babetas contra la casa (Premium), en el marco del plano. */
  planeTrim: DeckBox[];
};

export type DeckLayout = {
  line: DeckLine;
  topY: number;
  /** Tablas de deck (con el tinte). */
  boards: DeckBox[];
  /** Estructura de madera: tirantes secundarios y vigas principales. */
  frame: DeckBox[];
  /** Pilotes (dados de hormigón). */
  piles: DeckBox[];
  /** Escalones del frente. */
  steps: DeckBox[];
  /** Postes, pasamanos y travesaños o listones de baranda. */
  rails: DeckBox[];
  /** Zócalo de madera alrededor del deck (Premium): tapa los cantos de las tablas y de los tirantes. */
  fascia: DeckBox[];
  /** Tornillos a la vista sobre cada tirante (Esencial). */
  screws: DeckBox[];
  roof: DeckRoofLayout | null;
};

const {
  tablaEspesor,
  tablaAncho,
  tablaJunta,
  largoMadera,
  tiranteAlto,
} = DECK_3D;
/** Separación entre el deck y el muro, para que las tablas no se metan en el revestimiento. */
const HOLGURA_CASA = 0.01;
/** Distancia mínima (m) del eje de la puerta a un poste del frente: la puerta mide 1 m y necesita su espacio libre. */
const PUERTA_LIBRE = 0.75;
/** Por encima de esta cantidad de tablas (un deck enorme) no se biselan los cantos, para cuidar al visor. */
const MAX_TABLAS_BISELADAS = 2000;
/** Por encima de esta cantidad de tornillos (un deck enorme) no se dibujan. */
const MAX_TORNILLOS = 6000;

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

const withBevel = (bevel: number): { bevel?: number } => (bevel > 0 ? { bevel } : {});

/**
 * Un tramo de baranda entre `a` y `b` sobre una línea fija: postes cada 1,20 m como máximo y pasamanos. Entre poste y
 * poste, la Esencial lleva dos travesaños y la Premium un listonado horizontal denso (separación libre menor a 10 cm).
 */
function railRun(
  axis: "x" | "z",
  fixed: number,
  a: number,
  b: number,
  topY: number,
  line: DeckLine,
): DeckBox[] {
  const length = b - a;
  if (length < 0.2) return [];
  const { barandaAltura: alto, barandaCada: cada, barandaTravesaño: tr } = DECK_3D,
    look = DECK_LOOK[line].baranda,
    poste = look.poste,
    pas = look.pasamanos,
    postes = Math.max(2, Math.ceil(length / cada - 1e-9) + 1),
    boxes: DeckBox[] = [];
  const along = (t: number, y: number, size: Vec3, bevel = 0): DeckBox =>
    axis === "x"
      ? { size, pos: [t, y, fixed], ...withBevel(bevel) }
      : { size: [size[2], size[1], size[0]], pos: [fixed, y, t], ...withBevel(bevel) };
  const ts = spread(a, b, postes);
  for (const t of ts)
    boxes.push(
      along(t, topY + (alto - pas.alto) / 2, [poste, alto - pas.alto, poste], line === "premium" ? 0.004 : 0),
    );
  // Pasamanos y relleno en tramos de poste a poste (nunca pasan de 1,20 m, aunque la baranda sea muy larga).
  const y0 = topY + 0.1,
    y1 = topY + alto - pas.alto - 0.03,
    nListones = Math.ceil((y1 - y0) / 0.1) + 1;
  for (let i = 0; i < ts.length - 1; i++) {
    const t0 = ts[i] ?? a,
      t1 = ts[i + 1] ?? b,
      seg = t1 - t0,
      mid = (t0 + t1) / 2;
    boxes.push(along(mid, topY + alto - pas.alto / 2, [seg + poste, pas.alto, pas.ancho], pas.bisel));
    if (look.listones)
      for (const y of spread(y0, y1, nListones)) boxes.push(along(mid, y, [seg, 0.04, 0.03]));
    else for (const h of look.travesaños) boxes.push(along(mid, topY + h, [seg, tr[1], tr[0]]));
  }
  return boxes;
}

/** Calcula todas las piezas del deck para una altura de cara superior `topY`. */
export function deckLayout(
  deck: Pick<
    DeckConfig,
    "width" | "depth" | "roofed" | "railFront" | "railLeft" | "railRight" | "steps"
  > & { line?: DeckLine },
  topY: number,
  doorX: number | null = null,
): DeckLayout {
  const line: DeckLine = deck.line ?? "esencial",
    look = DECK_LOOK[line],
    W = deck.width,
    D = deck.depth,
    z0 = HOLGURA_CASA;

  // Tablas: filas paralelas a la fachada, con juntas y empalmes cada 3,30 m (escalonados si el frente supera ese largo).
  const filas = Math.max(1, Math.floor((D - z0 + tablaJunta) / (tablaAncho + tablaJunta))),
    ancho = (D - z0 - (filas - 1) * tablaJunta) / filas,
    boards: DeckBox[] = [],
    filasZ: number[] = [];
  for (let i = 0; i < filas; i++) {
    const zc = z0 + ancho / 2 + i * (ancho + tablaJunta),
      first = W <= largoMadera ? largoMadera : largoMadera * (1 - (i % 3) / 3);
    filasZ.push(zc);
    for (const [a, b] of pieces(-W / 2, W / 2, largoMadera, first)) {
      const gap = b - a > 0.3 ? 0.004 : 0;
      boards.push({
        size: [b - a - gap, tablaEspesor, ancho],
        pos: [(a + b) / 2, topY - tablaEspesor / 2, zc],
      });
    }
  }
  // Cantos trabajados (Premium): las tablas llevan los bordes biselados.
  if (look.canto > 0 && boards.length <= MAX_TABLAS_BISELADAS)
    for (const b of boards) b.bevel = look.canto;

  // Estructura: tirantes secundarios (a lo largo de z) sobre vigas principales (a lo largo de x) sobre pilotes.
  const tw = look.tirante.ancho,
    disponible = topY - tablaEspesor,
    altoTirante = Math.min(tiranteAlto, disponible),
    resto = disponible - altoTirante,
    altoViga = resto >= tiranteAlto + 0.08 ? tiranteAlto : 0,
    altoPilote = Math.max(0, resto - altoViga),
    frame: DeckBox[] = [],
    piles: DeckBox[] = [];
  const nTirantes = Math.max(2, Math.ceil((W - tw) / look.tirante.separacion - 1e-9) + 1),
    xTirantes = spread(-W / 2 + tw / 2, W / 2 - tw / 2, nTirantes);
  for (const x of xTirantes)
    for (const [a, b] of pieces(z0, D, largoMadera))
      frame.push({
        size: [tw, altoTirante, b - a - (b - a > 0.3 ? 0.004 : 0)],
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
          size: [b - a - (b - a > 0.3 ? 0.004 : 0), altoViga, tw],
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

  // Tornillos autoperforantes a la vista (Esencial): dos por tirante en cada tabla.
  const screws: DeckBox[] = [];
  if (look.tornillos && filas * nTirantes * 2 <= MAX_TORNILLOS)
    for (const zc of filasZ)
      for (const x of xTirantes)
        for (const s of [-1, 1])
          screws.push({
            size: [0.012, 0.002, 0.012],
            pos: [x, topY + 0.0008, zc + s * Math.min(0.04, ancho / 2 - 0.02)],
          });

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

  // Zócalo perimetral (Premium): tapa los cantos de las tablas y de los tirantes, al frente (con el hueco de los escalones)
  // y en los dos laterales.
  const fascia: DeckBox[] = [];
  if (look.zocalo) {
    const h = Math.min(tablaEspesor + altoTirante, topY),
      t = 0.02,
      yc = topY - h / 2,
      spans: [number, number][] = hayEscalones
        ? [
            [-W / 2 - t, xEsc - ancho2 / 2],
            [xEsc + ancho2 / 2, W / 2 + t],
          ]
        : [[-W / 2 - t, W / 2 + t]];
    for (const [a, b] of spans)
      if (b - a > 0.05)
        for (const [p, q] of pieces(a, b, largoMadera))
          fascia.push({
            size: [q - p - (q - p > 0.3 ? 0.004 : 0), h, t],
            pos: [(p + q) / 2, yc, D + t / 2],
          });
    for (const s of [-1, 1])
      for (const [p, q] of pieces(z0, D + t, largoMadera))
        fascia.push({
          size: [t, h, q - p - (q - p > 0.3 ? 0.004 : 0)],
          pos: [s * (W / 2 + t / 2), yc, (p + q) / 2],
        });
  }

  // Barandas: frente (con un hueco para los escalones), lateral izquierdo y lateral derecho. El lado de la casa no lleva.
  const rails: DeckBox[] = [],
    inset = look.baranda.poste / 2;
  if (deck.railFront) {
    const zf = D - inset;
    if (hayEscalones) {
      const hueco = ancho2 / 2;
      rails.push(
        ...railRun("x", zf, -W / 2 + inset, xEsc - hueco, topY, line),
        ...railRun("x", zf, xEsc + hueco, W / 2 - inset, topY, line),
      );
    } else rails.push(...railRun("x", zf, -W / 2 + inset, W / 2 - inset, topY, line));
  }
  if (deck.railLeft) rails.push(...railRun("z", -W / 2 + inset, z0 + inset, D - inset, topY, line));
  if (deck.railRight) rails.push(...railRun("z", W / 2 - inset, z0 + inset, D - inset, topY, line));

  return {
    line,
    topY,
    boards,
    frame,
    piles,
    steps,
    rails,
    fascia,
    screws,
    roof: deck.roofed
      ? roofLayout(W, D, topY, doorX, line, hayEscalones ? { x: xEsc, half: ancho2 / 2 + 0.1 } : null)
      : null,
  };
}

/**
 * Techo de chapa: postes, vigas, tirantes, clavadores y chapa, con caída hacia afuera. Ninguna madera pasa de 3,30 m: los
 * postes y las vigas se reparten cada 3,30 m como máximo, a lo ancho y, en un deck profundo, también a lo largo.
 * Esencial: postes dobles de 6x2 y chapa aluminizada trapezoidal. Premium: columnas de mayor escuadría, tirantería vista más
 * robusta, chapa acanalada prepintada, herrajes, babetas contra la casa, canaleta y bajadas de agua.
 * `avoid` es una franja de x (los escalones) que las bajadas de agua esquivan.
 */
export function roofLayout(
  W: number,
  D: number,
  topY: number,
  doorX: number | null = null,
  line: DeckLine = "esencial",
  avoid: { x: number; half: number } | null = null,
): DeckRoofLayout {
  const T = DECK_LOOK[line].techo,
    chapa = DECK_LOOK[line].chapa,
    { techoAlturaExterior: outerH } = DECK_3D,
    { inner } = deckRoofHeights(D),
    viga = T.viga.alto,
    vigaAncho = T.viga.ancho,
    [posteX, posteZ] = T.poste.seccion,
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
  const posts: DeckBox[] = [],
    hardware: DeckBox[] = [];
  for (let i = 0; i < nFilas; i++) {
    const alto = outerH + (rise * i) / nFilas,
      zRow = zFront - (i * run) / nFilas;
    for (const x of postXs) {
      if (T.poste.doble)
        // Poste doble: dos 6x2 pegados, con una junta fina que se ve como costura.
        for (const s of [-1, 1])
          posts.push({
            size: [posteX / 2 - 0.002, alto, posteZ],
            pos: [x + (s * posteX) / 4, topY + alto / 2, zRow],
          });
      else
        posts.push({
          size: [posteX, alto, posteZ],
          pos: [x, topY + alto / 2, zRow],
          ...withBevel(T.poste.bisel),
        });
      if (T.herrajes) {
        // Placa de base sobre el deck y herraje de unión del poste con la viga.
        hardware.push({ size: [posteX + 0.1, 0.012, posteZ + 0.1], pos: [x, topY + 0.006, zRow] });
        hardware.push({
          size: [posteX * 0.8, 0.2, 0.012],
          pos: [x, topY + alto - 0.12, zRow + posteZ / 2 + 0.006],
        });
      }
    }
  }

  const planeBoxes: DeckBox[] = [],
    beamY = viga / 2,
    vigaBisel = line === "premium" ? 0.005 : 0;
  // Vigas a lo ancho: una por fila de postes y la de la casa, cortadas entre poste y poste.
  for (let i = 0; i <= nFilas; i++)
    for (let k = 0; k < postXs.length - 1; k++) {
      const a = postXs[k] ?? 0,
        b = postXs[k + 1] ?? 0;
      planeBoxes.push({
        size: [b - a + vigaAncho - 0.004, viga, vigaAncho],
        pos: [(a + b) / 2, beamY, localZ(i)],
        ...withBevel(vigaBisel),
      });
    }
  // Vigas laterales, entre fila y fila.
  for (const s of [-1, 1])
    for (let i = 0; i < nFilas; i++)
      planeBoxes.push({
        size: [vigaAncho, viga, length / nFilas - 0.004],
        pos: [s * xs, beamY, (localZ(i) + localZ(i + 1)) / 2],
        ...withBevel(vigaBisel),
      });
  // Tirantes secundarios (sobre las vigas, a lo largo de la caída) y clavadores (a lo ancho, sobre los tirantes).
  const alero = T.alero,
    tir = T.tirante,
    nTir = Math.max(2, Math.ceil((2 * xs) / tir.separacion - 1e-9) + 1);
  for (const x of spread(-xs, xs, nTir))
    for (let i = 0; i < nFilas; i++) {
      const z1 = i === 0 ? alero : localZ(i),
        z0 = localZ(i + 1);
      planeBoxes.push({
        size: [tir.ancho, tir.alto, z1 - z0 - 0.004],
        pos: [x, viga + tir.alto / 2, (z0 + z1) / 2],
      });
    }
  const nCla = Math.max(2, Math.ceil((length + alero) / 0.5 - 1e-9) + 1);
  for (const z of spread(-length + 0.05, alero - 0.05, nCla))
    for (const [a, b] of pieces(-xs - 0.05, xs + 0.05, largoMadera))
      planeBoxes.push({
        size: [b - a - 0.004, 0.03, 0.05],
        pos: [(a + b) / 2, viga + tir.alto + 0.015, z],
      });

  const sheetY = viga + tir.alto + 0.03,
    sheet = { width: W + 0.2, z0: -length - 0.04, z1: alero, y: sheetY };

  // Premium: babetas contra la casa (en el marco del plano) y canaleta con bajadas de agua al frente (en el del deck).
  const planeTrim: DeckBox[] = [],
    trim: DeckBox[] = [];
  if (T.canaletas) {
    planeTrim.push({
      size: [W + 0.14, 0.012, 0.24],
      pos: [0, sheetY + chapa.nervio + 0.006, sheet.z0 + 0.13],
    });
    planeTrim.push({
      size: [W + 0.14, 0.12, 0.012],
      pos: [0, sheetY + 0.05, sheet.z0 + 0.008],
    });
    const c = Math.cos(angle),
      s = Math.sin(angle),
      gy = sheetY - 0.002 - 0.0425 + 0.025,
      gz = alero + 0.02,
      gutterY = topY + outerH + gy * c - gz * s,
      gutterZ = zFront + gy * s + gz * c,
      bajada = gutterY - 0.0425,
      nBajadas = Math.max(2, Math.ceil((2 * xs) / 7) + 1);
    trim.push({ size: [W + 0.2, 0.085, 0.1], pos: [0, gutterY, gutterZ] });
    for (let x of spread(-xs, xs, nBajadas)) {
      // Una bajada nunca queda sobre los escalones: pasa al lado más cercano que quede libre dentro del deck.
      if (avoid && Math.abs(x - avoid.x) < avoid.half) {
        const lados = [avoid.x + avoid.half, avoid.x - avoid.half]
          .filter((c) => Math.abs(c) <= xs)
          .sort((p, q) => Math.abs(p - x) - Math.abs(q - x));
        x = lados[0] ?? x;
      }
      trim.push({ size: [0.07, bajada, 0.07], pos: [x, bajada / 2, gutterZ] });
    }
  }

  return {
    posts,
    plane: { origin: [0, topY + outerH, zFront], angle, length },
    planeBoxes,
    sheet,
    hardware,
    trim,
    planeTrim,
  };
}

/**
 * Perfil de la chapa en x–y. Devuelve la línea superior; el espesor lo da el visor.
 * Trapezoidal (por defecto): paso 10 cm y nervio de 3 cm. Acanalada: onda senoidal con el paso y la altura dados.
 */
export function sheetProfile(
  width: number,
  pitch = 0.1,
  rib = 0.03,
  kind: "trapezoidal" | "acanalada" = "trapezoidal",
): [number, number][] {
  const n = Math.max(1, Math.round(width / pitch)),
    x0 = -(n * pitch) / 2,
    pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * pitch;
    if (kind === "acanalada") {
      const muestras = 8;
      for (let k = 0; k < muestras; k++)
        pts.push([x + (pitch * k) / muestras, (rib * (1 - Math.cos((2 * Math.PI * k) / muestras))) / 2]);
    } else pts.push([x, 0], [x + pitch * 0.3, 0], [x + pitch * 0.5, rib], [x + pitch * 0.8, rib]);
  }
  pts.push([x0 + n * pitch, 0]);
  return pts;
}
