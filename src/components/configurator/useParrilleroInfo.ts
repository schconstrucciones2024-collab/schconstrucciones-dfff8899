import { useMemo } from "react";
import { deckPlacement, deckTopY, resolveDeck } from "@/config/deckGeometry";
import { DECK_WALL } from "@/config/deckGeometry";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import { exteriorThickness } from "@/config/systems";
import {
  deckWidthToSurround,
  facadeFrame,
  parrilleroDeckRelation,
  parrilleroNotices,
  parrilleroObstacle,
  validateParrillero,
  type FacadeFrame,
  type ParrilleroDeckRelation,
  type ParrilleroNotice,
  type ParrilleroStatus,
} from "@/config/parrilleroGeometry";
import { floorBase, type HouseConfig } from "@/store/useConfigurator";
import type { DeckObstacle } from "@/config/deckCutout";

export type ParrilleroInfo = {
  frame: FacadeFrame | null;
  /** Dónde entra o no entra el parrillero (casa, aberturas, terreno). */
  status: ParrilleroStatus;
  /** Cómo se llevan con el deck y su techo. */
  relation: ParrilleroDeckRelation;
  /** Avisos para quien diseña, ya redactados. */
  notices: ParrilleroNotice[];
  /** Lo que el deck debe rodear (en su marco); null si el parrillero está apagado. Estable entre renders. */
  obstacle: DeckObstacle | null;
  /** Ancho de deck con el que rodea al parrillero con margen. */
  surroundWidth: number | null;
};

const NONE: ParrilleroStatus = { ok: true, issues: [], corners: [] };
const NO_RELATION: ParrilleroDeckRelation = { deckCuts: false, roofOpens: false, deckShort: false, lift: 0, flush: false };

/**
 * Todo lo que se sabe del parrillero en el diseño actual, calculado una sola vez y compartido por el 3D (que dibuja y recorta
 * el deck) y por el panel de extras (que muestra los avisos): así no hay dos cálculos que puedan discrepar. Es lo único que
 * se computa; no se guarda nada aparte del `ParrilleroConfig` del diseño.
 */
export function useParrilleroInfo(c: HouseConfig): ParrilleroInfo {
  const { enabled, side } = c.parrillero,
    thickness = exteriorThickness(c.finish),
    frame = useMemo(() => facadeFrame(c.contour, thickness), [c.contour, thickness]),
    deck = useMemo(() => resolveDeck(c.deck, c.contour, thickness), [c.deck, c.contour, thickness]),
    door = c.openings.find((o) => o.floor === 0 && o.wall === DECK_WALL && OPENINGS_CATALOG[o.type].door),
    doorOffset = door ? door.offset : null,
    placement = useMemo(
      () => (deck.enabled ? deckPlacement(c.contour, thickness, deck, doorOffset) : null),
      [deck, c.contour, thickness, doorOffset],
    ),
    status = useMemo(
      () =>
        enabled
          ? validateParrillero({ contour: c.contour, wallThickness: thickness, openings: c.openings, side, place: { position: c.position, rotation: c.rotation } })
          : NONE,
      [enabled, c.contour, thickness, c.openings, side, c.position, c.rotation],
    ),
    topY = deckTopY(floorBase(c)),
    relation = useMemo(
      () => (enabled && frame ? parrilleroDeckRelation({ frame, side, deck, deckPl: placement, topY }) : NO_RELATION),
      [enabled, frame, side, deck, placement, topY],
    ),
    obstacle = useMemo(
      () => (enabled && frame && placement ? parrilleroObstacle(frame, side, placement, relation.lift) : null),
      [enabled, frame, side, placement, relation.lift],
    ),
    notices = useMemo(() => (enabled ? parrilleroNotices(status, relation) : []), [enabled, status, relation]);
  return { frame, status, relation, notices, obstacle, surroundWidth: frame ? deckWidthToSurround(frame.length) : null };
}
