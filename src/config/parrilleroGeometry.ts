/**
 * Dónde queda el parrillero y qué ocupa: huella, obstáculo para el deck y el techo, y validación de espacio.
 *
 * Todo es geometría pura en planta (sin three.js), para poder probarla. El parrillero NACE DEL TERRENO, pegado a la casa: su
 * lugar de partida depende solo de la casa (el frente de la entrada) y del lateral elegido (el extremo de la mesada apoya contra
 * el muro de la fachada y el fondo queda sobre la línea del borde de la casa); desde ahí se puede mover y girar (`pose`). Nunca
 * depende del deck: es el deck (y, si hace falta, el techo del deck) el que se adapta a la huella. Mirando la fachada de frente
 * desde afuera, «izquierdo» es el lado de la izquierda.
 *
 * Marco de la fachada: x hacia la derecha de quien mira la fachada, z hacia afuera de la casa (z = 0 es la cara exterior del
 * muro de entrada) y x = 0 en el centro del frente. El marco del deck es el mismo pero centrado en el deck.
 */
import { OPENINGS_CATALOG } from "./openingsCatalog";
import { deckFrontSpan, deckPlacement, deckRoofHeights, type DeckPlacement } from "./deckGeometry";
import type { DeckConfig } from "./deck";
import { DECK_3D } from "./deck";
import {
  DECK_HOLGURA,
  inflate,
  overlaps,
  roofOpeningDetail,
  type DeckObstacle,
  type Rect,
} from "./deckCutout";
import { exteriorSegments, inside, offsetContour, type Point } from "./geometry";
import {
  PARRILLERO_DIMS as DIM,
  PARRILLERO_MESADA_SOBRE_DECK,
  PARRILLERO_TEXTOS,
  PARRILLERO_UBICACION as UBI,
  type ParrilleroConfig,
  type ParrilleroSide,
} from "./parrillero";

/** Mitad del terreno que dibuja el visor (el plano mide 80 m): más allá no hay suelo. */
export const TERRENO_MITAD = 40;

export type FacadeFrame = {
  wallId: string;
  /** Centro del frente, sobre la cara exterior del muro (en el marco de la casa). */
  origin: Point;
  right: Point;
  outward: Point;
  /** Largo del frente, de esquina a esquina. */
  length: number;
};

/** El frente de la casa como marco de referencia del parrillero (el mismo muro donde se apoya el deck). */
export function facadeFrame(contour: Point[], wallThickness: number): FacadeFrame | null {
  const span = deckFrontSpan(contour, wallThickness);
  if (!span) return null;
  // Un deck tan ancho como el frente queda centrado en él: su origen es el centro del frente.
  const pl = deckPlacement(contour, wallThickness, { width: span.length, depth: 1 }, null);
  if (!pl) return null;
  return { wallId: pl.wallId, origin: pl.origin, right: pl.right, outward: pl.outward, length: span.length };
}

export const toWorld = (f: Pick<FacadeFrame, "origin" | "right" | "outward">, x: number, z: number): Point => ({
  x: f.origin.x + f.right.x * x + f.outward.x * z,
  z: f.origin.z + f.right.z * x + f.outward.z * z,
});

/** Lo inverso de `toWorld`: un punto del marco de la casa, en el marco de la fachada (x a la derecha, z hacia afuera). */
export const toFrame = (f: Pick<FacadeFrame, "origin" | "right" | "outward">, p: Point): Point => {
  const dx = p.x - f.origin.x,
    dz = p.z - f.origin.z;
  return { x: dx * f.right.x + dz * f.right.z, z: dx * f.outward.x + dz * f.outward.z };
};

/** Cuánto se movió y giró el parrillero respecto del lugar donde nace (ver `ParrilleroConfig`). */
export type ParrilleroPose = Pick<ParrilleroConfig, "dx" | "dz" | "rot">;
export const EN_SU_LUGAR: ParrilleroPose = { dx: 0, dz: 0, rot: 0 };

/** [seno, coseno] del giro (grados), exactos en los giros rectos. */
function trig(rot: number): [number, number] {
  const r = ((rot % 360) + 360) % 360;
  if (r === 0) return [0, 1];
  if (r === 90) return [1, 0];
  if (r === 180) return [0, -1];
  if (r === 270) return [-1, 0];
  const a = (r * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a)];
}

/** Partes del parrillero en el marco de la fachada, ya movido y girado. */
export type ParrilleroRects = {
  /** Hacia dónde mira la boca (antes de girar): +1 hacia la derecha (parrillero del lado izquierdo) o -1 hacia la izquierda. */
  mouth: 1 | -1;
  /** Lugar donde nace (sin mover ni girar): centro de la huella a lo ancho (x) y comienzo en z (extremo de la mesada). */
  cx: number;
  z0: number;
  /** Centro de la huella, ya movido, y giro en radianes (el mismo sentido que `rotation-y` de three.js). */
  center: Point;
  angle: number;
  /** Rectángulos que contienen cada parte (en un giro recto son exactos; en otro, el rectángulo que la contiene). */
  footprint: Rect;
  chimney: Rect;
  hood: Rect;
  /** Las cuatro esquinas exactas de la huella (en el marco de la fachada), en orden. */
  corners: Point[];
  /** Alturas (m sobre el suelo) del remate de la chimenea y del punto más alto de la campana. */
  chimneyTop: number;
  hoodTop: number;
};

/** Espesor del muro de ladrillo del fondo (el refractario va por dentro). */
export const MURO_FONDO = DIM.profundidad - DIM.hogarProfundo - DIM.refractario;
/** Dónde empieza (u) la parte del hogar y la campana: después del pilar de punta, la mesada y el muro divisorio. */
export const U_HOGAR = DIM.muro + DIM.mesadaLargo;

/**
 * Huella, chimenea y campana. Sin mover ni girar (`EN_SU_LUGAR`) el parrillero queda pegado a la casa: el extremo de la mesada
 * apoya contra el muro de la fachada (z = retranqueo) y el fondo queda sobre la línea del borde de la casa (x = ∓largo/2), con
 * el cuerpo hacia el centro del frente. Con `pose` se lo mueve (`dx`, `dz`) y se lo gira alrededor del centro de su huella.
 */
export function parrilleroRects(side: ParrilleroSide, frontLength: number, pose: ParrilleroPose = EN_SU_LUGAR): ParrilleroRects {
  const d = DIM.profundidad,
    mouth: 1 | -1 = side === "izquierdo" ? 1 : -1,
    cx = side === "izquierdo" ? -frontLength / 2 - UBI.separacionCasa + d / 2 : frontLength / 2 + UBI.separacionCasa - d / 2,
    z0 = UBI.retranqueo,
    c0: Point = { x: cx, z: z0 + DIM.anchoTotal / 2 };
  // x de un punto a profundidad v (0 = fondo, d = boca).
  const xAt = (v: number) => cx - (mouth * d) / 2 + mouth * v,
    span = (a: number, b: number): [number, number] => [Math.min(xAt(a), xAt(b)), Math.max(xAt(a), xAt(b))];
  const [fx0, fx1] = span(0, d),
    sec = DIM.chimeneaSeccion,
    // La chimenea y la campana ocupan toda la profundidad del parrillero (del fondo a la boca).
    [cx0, cx1] = [fx0, fx1],
    [hx0, hx1] = [fx0, fx1];
  const base = {
    footprint: { x0: fx0, x1: fx1, z0, z1: z0 + DIM.anchoTotal },
    chimney: { x0: cx0, x1: cx1, z0: z0 + DIM.anchoTotal - sec, z1: z0 + DIM.anchoTotal },
    hood: { x0: hx0, x1: hx1, z0: z0 + U_HOGAR, z1: z0 + DIM.anchoTotal },
  };
  const [sn, cs] = trig(pose.rot),
    place = (x: number, z: number): Point => {
      const rx = x - c0.x,
        rz = z - c0.z;
      return { x: c0.x + pose.dx + rx * cs + rz * sn, z: c0.z + pose.dz - rx * sn + rz * cs };
    },
    cornersOf = (r: Rect): Point[] => [place(r.x0, r.z0), place(r.x1, r.z0), place(r.x1, r.z1), place(r.x0, r.z1)],
    boxOf = (r: Rect): Rect => {
      const pts = cornersOf(r);
      return {
        x0: Math.min(...pts.map((p) => p.x)),
        x1: Math.max(...pts.map((p) => p.x)),
        z0: Math.min(...pts.map((p) => p.z)),
        z1: Math.max(...pts.map((p) => p.z)),
      };
    };
  return {
    mouth,
    cx,
    z0,
    center: { x: c0.x + pose.dx, z: c0.z + pose.dz },
    angle: (((pose.rot % 360) + 360) % 360) * (Math.PI / 180),
    footprint: boxOf(base.footprint),
    chimney: boxOf(base.chimney),
    hood: boxOf(base.hood),
    corners: cornersOf(base.footprint),
    chimneyTop: DIM.alturaMesada + DIM.chimeneaAltura,
    hoodTop: DIM.campanaAltoChimenea,
  };
}

/** Las cuatro esquinas exactas de la huella, achicada `shrinkBy` metros en todos sus lados, en el marco de la fachada. */
export function footprintCorners(side: ParrilleroSide, frontLength: number, pose: ParrilleroPose, shrinkBy = 0): Point[] {
  const r = parrilleroRects(side, frontLength, pose),
    [sn, cs] = trig(pose.rot),
    ux = { x: cs, z: -sn },
    uz = { x: sn, z: cs },
    hx = DIM.profundidad / 2 - shrinkBy,
    hz = DIM.anchoTotal / 2 - shrinkBy,
    at = (a: number, b: number): Point => ({ x: r.center.x + ux.x * a + uz.x * b, z: r.center.z + ux.z * a + uz.z * b });
  return [at(-hx, -hz), at(hx, -hz), at(hx, hz), at(-hx, hz)];
}

const shiftX = (r: Rect, dx: number): Rect => ({ ...r, x0: r.x0 - dx, x1: r.x1 - dx });

/** Cuánto hay que restar a una x de la fachada para pasarla al marco del deck (el deck puede estar corrido respecto del frente). */
export function deckFrameShift(frame: FacadeFrame, deckPl: Pick<DeckPlacement, "origin">): number {
  return (deckPl.origin.x - frame.origin.x) * frame.right.x + (deckPl.origin.z - frame.origin.z) * frame.right.z;
}

/** Lo que el deck necesita saber del parrillero, en el marco del deck. */
export function parrilleroObstacle(
  frame: FacadeFrame,
  side: ParrilleroSide,
  deckPl: Pick<DeckPlacement, "origin">,
  /** Cuánto sube el parrillero sobre el terreno (ver `parrilleroDeckRelation`): sube también su chimenea y su campana. */
  lift = 0,
  pose: ParrilleroPose = EN_SU_LUGAR,
): DeckObstacle {
  const r = parrilleroRects(side, frame.length, pose),
    dx = deckFrameShift(frame, deckPl);
  return {
    footprint: shiftX(r.footprint, dx),
    chimney: shiftX(r.chimney, dx),
    chimneyTop: r.chimneyTop + lift,
    hood: shiftX(r.hood, dx),
    hoodTop: r.hoodTop + lift,
  };
}

/**
 * Ancho de deck (m, al décimo) con el que el deck llega hasta el parrillero. Mientras el parrillero esté dentro del ancho del
 * frente de la casa, alcanza con el frente completo; si se lo movió más allá de las esquinas, el deck lo rodea con una franja
 * de madera de 30 cm del lado de afuera. El deck queda centrado en el frente.
 */
export function deckWidthToSurround(frontLength: number, side: ParrilleroSide = "izquierdo", pose: ParrilleroPose = EN_SU_LUGAR): number {
  const f = parrilleroRects(side, frontLength, pose).footprint,
    reach = Math.max(Math.abs(f.x0), Math.abs(f.x1)),
    needed = reach <= frontLength / 2 + 1e-6 ? frontLength : 2 * (reach + 0.3);
  return Math.ceil(needed * 10 - 1e-9) / 10;
}

// ---------------------------------------------------------------------------------------------------------------------
// Validación de espacio
// ---------------------------------------------------------------------------------------------------------------------

export type ParrilleroIssue = { code: "casa" | "abertura" | "terreno"; message: string };
export type ParrilleroStatus = {
  ok: boolean;
  issues: ParrilleroIssue[];
  /** Las cuatro esquinas de la huella en el marco de la casa. */
  corners: Point[];
};

const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
/** ¿Se cruzan los segmentos ab y cd? */
function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const d1 = cross(a, b, c),
    d2 = cross(a, b, d),
    d3 = cross(c, d, a),
    d4 = cross(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
/** ¿Un rectángulo (cuatro esquinas, en orden) y un polígono se pisan? */
export function ringsOverlap(rect: Point[], ring: Point[]): boolean {
  if (rect.some((p) => inside(p, ring, false))) return true;
  if (ring.some((p) => inside(p, rect, false))) return true;
  for (let i = 0; i < rect.length; i++) {
    const a = rect[i] as Point,
      b = rect[(i + 1) % rect.length] as Point;
    for (let j = 0; j < ring.length; j++) {
      if (segmentsCross(a, b, ring[j] as Point, ring[(j + 1) % ring.length] as Point)) return true;
    }
  }
  return false;
}

type OpeningLike = { floor: number; wall: string; offset: number; type: keyof typeof OPENINGS_CATALOG };

/**
 * ¿Entra el parrillero donde se lo pidió? Mira la casa (con sus muros), las aberturas de la planta baja y el límite del
 * terreno. NO modifica nada: devuelve avisos que se entienden. `place` es la posición y el giro de la casa en el terreno.
 */
export function validateParrillero(input: {
  contour: Point[];
  wallThickness: number;
  openings: readonly OpeningLike[];
  side: ParrilleroSide;
  /** Cuánto se lo movió y giró respecto del lugar donde nace. */
  pose?: ParrilleroPose;
  /** Posición y giro de la casa en el terreno. */
  place?: { position: Point; rotation: number };
}): ParrilleroStatus {
  const frame = facadeFrame(input.contour, input.wallThickness);
  if (!frame) return { ok: true, issues: [], corners: [] };
  const pose = input.pose ?? EN_SU_LUGAR,
    corner = (p: Point) => toWorld(frame, p.x, p.z),
    corners = footprintCorners(input.side, frame.length, pose).map(corner),
    // Pegado a la casa es lo normal: se mira la huella achicada 2 cm para que apoyar contra el muro no cuente como choque.
    body = footprintCorners(input.side, frame.length, pose, 0.02).map(corner),
    // Las aberturas se miden sobre el eje del muro: se agranda la huella la mitad del espesor del muro (hasta el eje) más la holgura.
    around = footprintCorners(input.side, frame.length, pose, -(UBI.libreMinimo + input.wallThickness / 2)).map(corner),
    issues: ParrilleroIssue[] = [];

  // 1) La casa, con el espesor de sus muros: puede apoyar contra un muro, pero no atravesarlo.
  const outline = offsetContour(input.contour, input.wallThickness / 2);
  if (ringsOverlap(body, outline))
    issues.push({
      code: "casa",
      message: "El parrillero atraviesa la casa. Movelo o girá para dejarlo afuera, apoyado contra un muro.",
    });

  // 2) Aberturas (puertas y ventanas) de la planta baja: no se las puede tapar.
  const segments = exteriorSegments(input.contour, input.wallThickness);
  for (const o of input.openings) {
    if (o.floor !== 0) continue;
    const seg = segments.find((s) => s.id === o.wall),
      spec = OPENINGS_CATALOG[o.type];
    if (!seg || !spec) continue;
    const len = Math.hypot(seg.b.x - seg.a.x, seg.b.z - seg.a.z);
    if (len < 1e-6) continue;
    const dir = { x: (seg.b.x - seg.a.x) / len, z: (seg.b.z - seg.a.z) / len },
      mid = { x: (seg.a.x + seg.b.x) / 2 + dir.x * o.offset, z: (seg.a.z + seg.b.z) / 2 + dir.z * o.offset },
      half = spec.width / 2,
      p1 = { x: mid.x - dir.x * half, z: mid.z - dir.z * half },
      p2 = { x: mid.x + dir.x * half, z: mid.z + dir.z * half };
    if (segmentTouches(p1, p2, around)) {
      issues.push({
        code: "abertura",
        message: `El parrillero quedaría pegado a ${spec.door ? "una puerta" : "una ventana"} de la casa y la tapa. Movelo o giralo.`,
      });
      break;
    }
  }

  // 3) Límite del terreno.
  if (input.place) {
    const { position, rotation } = input.place,
      th = -rotation,
      c = Math.cos(th),
      s = Math.sin(th),
      out = corners.some((p) => {
        const wx = position.x + p.x * c + p.z * s,
          wz = position.z - p.x * s + p.z * c;
        return Math.abs(wx) > TERRENO_MITAD - 1 || Math.abs(wz) > TERRENO_MITAD - 1;
      });
    if (out) issues.push({ code: "terreno", message: "El parrillero quedaría fuera del terreno. Acercalo a la casa." });
  }
  return { ok: issues.length === 0, issues, corners };
}

/** ¿El segmento p1–p2 está dentro (o toca) el cuadrilátero? */
function segmentTouches(p1: Point, p2: Point, quad: Point[]): boolean {
  if (inside(p1, quad, true) || inside(p2, quad, true)) return true;
  for (let i = 0; i < quad.length; i++) if (segmentsCross(p1, p2, quad[i] as Point, quad[(i + 1) % quad.length] as Point)) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Relación con el deck y el techo
// ---------------------------------------------------------------------------------------------------------------------

export type ParrilleroDeckRelation = {
  /** El deck está agregado y llega a la huella: se recorta alrededor. */
  deckCuts: boolean;
  /** El deck (con techo) y el parrillero están en el mismo lugar: la chimenea atraviesa el techo y se abre. */
  roofOpens: boolean;
  /** La abertura del techo incluye también la campana, porque el techo queda más bajo que ella (no debería pasar con las alturas de fábrica). */
  roofOpensForHood: boolean;
  /** Hay deck pero no llega hasta el parrillero. */
  deckShort: boolean;
  /**
   * Cuánto sube la base del parrillero desde el terreno (m): con un deck alrededor, la mesada se mantiene a `alturaMesada`
   * sobre el deck y no sobre el terreno. Es 0 si no hay deck que lo rodee (o si `PARRILLERO_MESADA_SOBRE_DECK` es false).
   */
  lift: number;
  /** El deck lo rodea pero la mesada queda casi a ras del deck (solo con la elevación apagada). */
  flush: boolean;
};

/** Cómo se llevan el deck y el parrillero con la configuración actual (sin dibujar nada). */
export function parrilleroDeckRelation(input: {
  frame: FacadeFrame;
  side: ParrilleroSide;
  deck: Pick<DeckConfig, "enabled" | "roofed" | "width" | "depth">;
  deckPl: Pick<DeckPlacement, "origin"> | null;
  topY: number;
  /** Cuánto se lo movió y giró respecto del lugar donde nace. */
  pose?: ParrilleroPose;
}): ParrilleroDeckRelation {
  const { frame, side, deck, deckPl, topY } = input,
    pose = input.pose ?? EN_SU_LUGAR;
  if (!deck.enabled || !deckPl) return { deckCuts: false, roofOpens: false, roofOpensForHood: false, deckShort: false, lift: 0, flush: false };
  const bounds: Rect = { x0: -deck.width / 2, x1: deck.width / 2, z0: 0.01, z1: deck.depth },
    cuts = overlaps(inflate(parrilleroObstacle(frame, side, deckPl, 0, pose).footprint, DECK_HOLGURA), bounds),
    lift = cuts && PARRILLERO_MESADA_SOBRE_DECK ? Math.round(topY * 100) / 100 : 0,
    o = parrilleroObstacle(frame, side, deckPl, lift, pose);
  let roofOpens = false,
    roofOpensForHood = false;
  if (cuts && deck.roofed) {
    const { inner } = deckRoofHeights(deck.depth),
      zFront = deck.depth - 0.1,
      zHouse = 0.05,
      run = Math.max(0.5, zFront - zHouse),
      rise = inner - DECK_3D.techoAlturaExterior,
      xs = deck.width / 2 - 0.1,
      roofBounds: Rect = { x0: -xs - 0.05, x1: xs + 0.05, z0: zHouse, z1: zFront + 0.25 };
    const open = roofOpeningDetail(o, roofBounds, (z) => topY + DECK_3D.techoAlturaExterior + (rise * (zFront - z)) / run);
    roofOpens = open.rect !== null;
    roofOpensForHood = open.byHood;
  }
  return { deckCuts: cuts, roofOpens, roofOpensForHood, deckShort: !cuts, lift, flush: cuts && lift === 0 && topY > DIM.alturaMesada - 0.25 };
}

export type ParrilleroNotice = { level: "error" | "info"; text: string };

/** Los avisos que ve quien diseña, en el orden en que importan. */
export function parrilleroNotices(status: ParrilleroStatus, rel: ParrilleroDeckRelation, pose: ParrilleroPose = EN_SU_LUGAR): ParrilleroNotice[] {
  const out: ParrilleroNotice[] = status.issues.map((i) => ({ level: "error", text: i.message }));
  if (rel.deckCuts) out.push({ level: "info", text: PARRILLERO_TEXTOS.deckLoRodea });
  if (rel.deckCuts && pose.rot % 90 !== 0) out.push({ level: "info", text: PARRILLERO_TEXTOS.giroLibre });
  if (rel.lift > 0) out.push({ level: "info", text: PARRILLERO_TEXTOS.baseElevada(Math.round(rel.lift * 100)) });
  if (rel.flush) out.push({ level: "error", text: PARRILLERO_TEXTOS.mesadaAlDeck });
  if (rel.roofOpens) out.push({ level: "info", text: rel.roofOpensForHood ? PARRILLERO_TEXTOS.techoBajo : PARRILLERO_TEXTOS.techoAdaptado });
  if (rel.deckShort) out.push({ level: "info", text: PARRILLERO_TEXTOS.deckNoLlega });
  return out;
}
