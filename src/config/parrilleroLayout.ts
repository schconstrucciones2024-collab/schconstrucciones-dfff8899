/**
 * Piezas del parrillero para el visor 3D, en metros. Es una función pura (sin three.js) para poder probarla: el visor solo
 * dibuja estas piezas.
 *
 * Marco propio: el origen está en el centro de la profundidad y en el extremo de la mesada (el lado de la casa); `z` corre a lo
 * largo de los 3,00 m (`u`) y `x` a lo largo de la profundidad, con la boca hacia donde apunta `mouth`. El grupo del visor lo
 * lleva a su lugar en la fachada. La geometría no depende del tamaño de la casa ni de la terminación (la terminación solo
 * cambia el material), así que no se vuelve a calcular al cambiarlas.
 *
 * Reparto a lo largo de `u`: pilar de punta (0,15) · mesada (1,35) · muro divisorio (0,15) · hogar (1,20) · muro del extremo (0,15).
 * A lo largo de `v` (0 = fondo, 0,90 = boca): muro de ladrillo del fondo (0,21) · refractario (0,04) · hogar útil (0,65).
 */
import type { Box as DeckBox } from "./deckCutout";
import { MURO_FONDO } from "./parrilleroGeometry";
import { PARRILLERO_DIMS as D, type ParrilleroSide } from "./parrillero";

export type Vec3 = [number, number, number];
/** Prisma: un polígono en (u, y) extruido a lo ancho de la profundidad, entre las dos x. */
export type PPrism = { pts: [number, number][]; x0: number; x1: number };
/** Cilindro (grifería): centro, radio, largo y eje (x = profundidad, y = vertical, z = a lo largo de u). */
export type PCyl = { r: number; h: number; pos: Vec3; axis: "x" | "y" | "z" };

export type ParrilleroLayout = {
  mouth: 1 | -1;
  /** Base de mampostería de ticholos con revoque (de bajo del terreno a la losa) y el fondo oscuro de los nichos. */
  base: { render: DeckBox[]; niche: DeckBox[] };
  /** Losa de hormigón armado: piso del hogar, frente, mesada lateral y zona de la bacha. */
  slab: DeckBox[];
  /** Muros del cuerpo: fondo (prisma) y laterales del hogar. */
  walls: { boxes: DeckBox[]; prisms: PPrism[] };
  /** Hogar: piso refractario sobre la losa y el hollín del cielo. */
  firebox: { floor: DeckBox[]; soot: DeckBox[] };
  /** Revestimiento de ladrillo refractario: fondo y laterales. */
  refractory: DeckBox[];
  /** Campana inclinada (con una pendiente en diagonal) y su remate. */
  hood: { prisms: PPrism[]; coping: PPrism[] };
  chimney: DeckBox[];
  /** Remate de ladrillo con el agujero de salida del humo. */
  cap: { ring: DeckBox[]; hole: DeckBox[] };
  /** Respaldo de la mesada. */
  counter: DeckBox[];
  sink: { rim: DeckBox[]; basin: DeckBox[]; drain: DeckBox[] } | null;
  faucet: PCyl[] | null;
};

const shiftBox = (b: DeckBox, dy: number): DeckBox => ({ ...b, pos: [b.pos[0], b.pos[1] + dy, b.pos[2]] });
const stretchBox = (b: DeckBox, dy: number): DeckBox => ({ ...b, size: [b.size[0], b.size[1] + dy, b.size[2]], pos: [b.pos[0], b.pos[1] + dy / 2, b.pos[2]] });
const shiftPrism = (p: PPrism, dy: number): PPrism => ({ ...p, pts: p.pts.map(([u, y]) => [u, y + dy] as [number, number]) });
const shiftCyl = (c: PCyl, dy: number): PCyl => ({ ...c, pos: [c.pos[0], c.pos[1] + dy, c.pos[2]] });

/**
 * Sube el parrillero `lift` metros: la base (ticholos, que nace del terreno) se alarga hacia arriba y todo lo demás (losa,
 * muros, hogar, campana, chimenea, mesada, bacha) se desplaza esa altura. Es lo que hace falta cuando el deck rodea al
 * parrillero: la mesada se mantiene a 0,90 m de donde se para uno (el deck), no del terreno.
 */
function liftLayout(l: ParrilleroLayout, lift: number): ParrilleroLayout {
  const sb = (bs: DeckBox[]) => bs.map((b) => shiftBox(b, lift)),
    sp = (ps: PPrism[]) => ps.map((p) => shiftPrism(p, lift));
  return {
    mouth: l.mouth,
    base: { render: l.base.render.map((b) => stretchBox(b, lift)), niche: l.base.niche.map((b) => stretchBox(b, lift)) },
    slab: sb(l.slab),
    walls: { boxes: sb(l.walls.boxes), prisms: sp(l.walls.prisms) },
    firebox: { floor: sb(l.firebox.floor), soot: sb(l.firebox.soot) },
    refractory: sb(l.refractory),
    hood: { prisms: sp(l.hood.prisms), coping: sp(l.hood.coping) },
    chimney: sb(l.chimney),
    cap: { ring: sb(l.cap.ring), hole: sb(l.cap.hole) },
    counter: sb(l.counter),
    sink: l.sink ? { rim: sb(l.sink.rim), basin: sb(l.sink.basin), drain: sb(l.sink.drain) } : null,
    faucet: l.faucet ? l.faucet.map((c) => shiftCyl(c, lift)) : null,
  };
}

/**
 * Las formas del parrillero. `lift` (m, 0 por defecto) lo sube sobre el terreno: se usa cuando un deck lo rodea (ver
 * `parrilleroLift`). La terminación no entra: solo cambia el material, no la forma.
 */
export function parrilleroLayout(side: ParrilleroSide, withSink = true, lift = 0): ParrilleroLayout {
  const base = buildLayout(side, withSink);
  return lift > 1e-6 ? liftLayout(base, lift) : base;
}

function buildLayout(side: ParrilleroSide, withSink: boolean): ParrilleroLayout {
  const mouth: 1 | -1 = side === "izquierdo" ? 1 : -1,
    d = D.profundidad,
    m = D.muro,
    ref = D.refractario,
    slabTop = D.alturaMesada,
    slabBottom = slabTop - D.espesorLosa,
    floorTop = slabTop + D.pisoHogar,
    mouthTop = floorTop + D.bocaAlto,
    // Reparto a lo largo de u.
    uMesadaEnd = m + D.mesadaLargo,
    uHogarA = uMesadaEnd + m,
    uHogarB = uHogarA + D.hogarAncho,
    uTotal = D.anchoTotal,
    // Fondo (v).
    vBack = MURO_FONDO;

  /** x del marco propio a profundidad v (0 = fondo, d = boca). */
  const xAt = (v: number) => mouth * (v - d / 2);
  /** Caja entre u0–u1, v0–v1 e y0–y1. */
  const bx = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number): DeckBox => ({
    size: [Math.abs(v1 - v0), y1 - y0, u1 - u0],
    pos: [(xAt(v0) + xAt(v1)) / 2, (y0 + y1) / 2, (u0 + u1) / 2],
  });
  const prism = (pts: [number, number][], v0: number, v1: number): PPrism => ({
    pts,
    x0: Math.min(xAt(v0), xAt(v1)),
    x1: Math.max(xAt(v0), xAt(v1)),
  });

  // --- Base: mampostería de ticholos revocada, nacida del terreno (se entierra un poco para no flotar) ---------------
  const yBase = -D.enterrado,
    base = {
      render: [
        bx(0, uTotal, 0, m, yBase, slabBottom),
        bx(0, m, 0, d, yBase, slabBottom),
        bx(uMesadaEnd, uHogarA, 0, d, yBase, slabBottom),
        bx(uTotal - m, uTotal, 0, d, yBase, slabBottom),
      ],
      // Fondo oscuro de los dos nichos (bajo la mesada y bajo el hogar), apenas por delante del muro de atrás.
      niche: [
        bx(m, uMesadaEnd, m, m + 0.004, 0, slabBottom),
        bx(uHogarA, uTotal - m, m, m + 0.004, 0, slabBottom),
      ],
    };

  // --- Losa: hogar + frente + mesada, todo una sola pieza; con la bacha, se arma alrededor de su abertura ------------
  const sinkU0 = 0.53,
    sinkU1 = sinkU0 + D.bachaAncho,
    sinkV0 = (d - D.bachaFondo) / 2,
    sinkV1 = sinkV0 + D.bachaFondo,
    slab = withSink
      ? [
          bx(0, sinkU0, 0, d, slabBottom, slabTop),
          bx(sinkU1, uTotal, 0, d, slabBottom, slabTop),
          bx(sinkU0, sinkU1, 0, sinkV0, slabBottom, slabTop),
          bx(sinkU0, sinkU1, sinkV1, d, slabBottom, slabTop),
        ]
      : [bx(0, uTotal, 0, d, slabBottom, slabTop)];

  // --- Muros del cuerpo --------------------------------------------------------------------------------------------
  const uChim = uTotal - D.chimeneaSeccion;
  // Perfil de la campana: sube en diagonal desde el borde de la mesada hasta la chimenea y sigue recto hasta el extremo.
  const slopeTop: [number, number][] = [
    [uTotal, D.campanaAltoChimenea],
    [uChim, D.campanaAltoChimenea],
    [uMesadaEnd, D.campanaAltoBorde],
  ];
  const walls = {
    prisms: [prism([[uMesadaEnd, slabTop], [uTotal, slabTop], ...slopeTop], 0, vBack)],
    boxes: [
      bx(uMesadaEnd, uHogarA - ref, vBack, d, slabTop, mouthTop),
      bx(uHogarB + ref, uTotal, vBack, d, slabTop, mouthTop),
    ],
  };

  // --- Hogar y refractario ---------------------------------------------------------------------------------------
  const firebox = {
    floor: [bx(uHogarA - ref, uHogarB + ref, vBack, d, slabTop, floorTop)],
    soot: [bx(uHogarA, uHogarB, vBack + ref, d, mouthTop - 0.006, mouthTop)],
  };
  const refractory = [
    bx(uHogarA - ref, uHogarB + ref, vBack, vBack + ref, floorTop, mouthTop),
    bx(uHogarA - ref, uHogarA, vBack + ref, d, floorTop, mouthTop),
    bx(uHogarB, uHogarB + ref, vBack + ref, d, floorTop, mouthTop),
  ];

  // --- Campana en diagonal (sobre la boca) y su remate de ladrillo ---------------------------------------------------
  const hood = {
    prisms: [prism([[uMesadaEnd, mouthTop], [uTotal, mouthTop], ...slopeTop], vBack, d)],
    coping: [] as PPrism[],
  };
  {
    const [ax, ay] = [uMesadaEnd, D.campanaAltoBorde],
      [bx2, by] = [uChim, D.campanaAltoChimenea],
      len = Math.hypot(bx2 - ax, by - ay),
      tx = (bx2 - ax) / len,
      ty = (by - ay) / len,
      nx = -ty,
      ny = tx,
      th = 0.05,
      over = 0.04,
      sx = ax - tx * over,
      sy = ay - ty * over;
    hood.coping.push(
      prism(
        [
          [sx, sy],
          [bx2, by],
          [bx2 + nx * th, by + ny * th],
          [sx + nx * th, sy + ny * th],
        ],
        vBack - 0.03,
        d + over,
      ),
    );
  }

  // --- Chimenea de ladrillo con remate y agujero de salida ---------------------------------------------------------
  const sec = D.chimeneaSeccion,
    vC0 = d - sec,
    top = slabTop + D.chimeneaAltura,
    shaftTop = top - D.tapaEspesor,
    over = D.tapaVuelo,
    hole = D.humoLado,
    uc = uChim + sec / 2,
    vc = vC0 + sec / 2;
  const chimney = [bx(uChim, uTotal, vC0, d, D.campanaAltoChimenea, shaftTop)];
  const cap = {
    ring: [
      bx(uChim - over, uc - hole / 2, vC0 - over, d + over, shaftTop, top),
      bx(uc + hole / 2, uTotal + over, vC0 - over, d + over, shaftTop, top),
      bx(uc - hole / 2, uc + hole / 2, vC0 - over, vc - hole / 2, shaftTop, top),
      bx(uc - hole / 2, uc + hole / 2, vc + hole / 2, d + over, shaftTop, top),
    ],
    hole: [bx(uc - hole / 2, uc + hole / 2, vc - hole / 2, vc + hole / 2, shaftTop, shaftTop + 0.004)],
  };

  // --- Mesada: respaldo; bacha y grifería -----------------------------------------------------------------------------
  const counter = [bx(m, uMesadaEnd, 0, 0.06, slabTop, slabTop + 0.18)];
  const t = 0.01;
  const sink = withSink
    ? {
        rim: [
          bx(sinkU0 - 0.02, sinkU0, sinkV0 - 0.02, sinkV1 + 0.02, slabTop, slabTop + 0.005),
          bx(sinkU1, sinkU1 + 0.02, sinkV0 - 0.02, sinkV1 + 0.02, slabTop, slabTop + 0.005),
          bx(sinkU0, sinkU1, sinkV0 - 0.02, sinkV0, slabTop, slabTop + 0.005),
          bx(sinkU0, sinkU1, sinkV1, sinkV1 + 0.02, slabTop, slabTop + 0.005),
        ],
        basin: [
          bx(sinkU0, sinkU0 + t, sinkV0, sinkV1, slabTop - D.bachaProfundo, slabTop),
          bx(sinkU1 - t, sinkU1, sinkV0, sinkV1, slabTop - D.bachaProfundo, slabTop),
          bx(sinkU0 + t, sinkU1 - t, sinkV0, sinkV0 + t, slabTop - D.bachaProfundo, slabTop),
          bx(sinkU0 + t, sinkU1 - t, sinkV1 - t, sinkV1, slabTop - D.bachaProfundo, slabTop),
          bx(sinkU0, sinkU1, sinkV0, sinkV1, slabTop - D.bachaProfundo - t, slabTop - D.bachaProfundo),
        ],
        drain: [
          bx((sinkU0 + sinkU1) / 2 - 0.025, (sinkU0 + sinkU1) / 2 + 0.025, (sinkV0 + sinkV1) / 2 - 0.025, (sinkV0 + sinkV1) / 2 + 0.025, slabTop - D.bachaProfundo, slabTop - D.bachaProfundo + 0.003),
        ],
      }
    : null;
  const uf = (sinkU0 + sinkU1) / 2,
    vf = 0.17,
    faucet: PCyl[] | null = withSink
      ? [
          { r: 0.022, h: 0.03, pos: [xAt(vf), slabTop + 0.015, uf], axis: "y" },
          { r: 0.013, h: 0.2, pos: [xAt(vf), slabTop + 0.13, uf], axis: "y" },
          // Pico: sale hacia adelante (hacia la bacha) y baja en la punta.
          { r: 0.011, h: 0.18, pos: [xAt(vf + 0.09), slabTop + 0.23, uf], axis: "x" },
          { r: 0.011, h: 0.06, pos: [xAt(vf + 0.18), slabTop + 0.2, uf], axis: "y" },
          // Palanca.
          { r: 0.006, h: 0.07, pos: [xAt(vf), slabTop + 0.19, uf + 0.035], axis: "z" },
        ]
      : null;

  return { mouth, base, slab, walls, firebox, refractory, hood, chimney, cap, counter, sink, faucet };
}

/** Todas las cajas del parrillero (sin prismas ni cilindros): sirve para medir y para las pruebas. */
export function allBoxes(l: ParrilleroLayout): DeckBox[] {
  return [
    ...l.base.render,
    ...l.base.niche,
    ...l.slab,
    ...l.walls.boxes,
    ...l.firebox.floor,
    ...l.firebox.soot,
    ...l.refractory,
    ...l.chimney,
    ...l.cap.ring,
    ...l.cap.hole,
    ...l.counter,
    ...(l.sink ? [...l.sink.rim, ...l.sink.basin, ...l.sink.drain] : []),
  ];
}
