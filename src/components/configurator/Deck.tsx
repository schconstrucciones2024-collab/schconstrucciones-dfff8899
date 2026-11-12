import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { DECK_3D_COLORES, DECK_LOOK, type DeckConfig, type DeckSheet } from "@/config/deck";
import { deckLayout, type DeckBox } from "@/config/deckLayout";
import type { DeckPlacement } from "@/config/deckGeometry";
import { boxesGeometry, sheetGeometry } from "./deckMeshes";
import { pbrProps } from "./pbr";

/** Cajas unidas en una sola malla: madera con su veta (`map`), o liso (hormigón, tornillos, herrajes). */
function Boxes({
  boxes,
  map,
  color,
  roughness,
  metalness = 0,
  shadows = true,
}: {
  boxes: DeckBox[];
  map?: THREE.Texture | undefined;
  color?: string | undefined;
  /** Con veta el material es mate por defecto; la madera con lasur costero tiene algo de brillo. */
  roughness?: number | undefined;
  metalness?: number;
  shadows?: boolean;
}) {
  const geometry = useMemo(() => boxesGeometry(boxes), [boxes]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow={shadows} receiveShadow>
      <meshStandardMaterial
        {...(map ? pbrProps(map) : {})}
        {...(map ? { map } : {})}
        {...(color ? { color } : {})}
        roughness={roughness ?? (map ? 1 : 0.8)}
        metalness={metalness}
      />
    </mesh>
  );
}

function SheetRoof({
  width,
  z0,
  z1,
  y,
  chapa,
}: {
  width: number;
  z0: number;
  z1: number;
  y: number;
  chapa: DeckSheet;
}) {
  const { perfil, paso, nervio } = chapa;
  const geometry = useMemo(
    () => sheetGeometry(width, z0, z1, { perfil, paso, nervio }),
    [width, z0, z1, perfil, paso, nervio],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} position-y={y} castShadow receiveShadow>
      <meshStandardMaterial
        color={chapa.color}
        metalness={chapa.metal}
        roughness={chapa.rugosidad}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Deck de madera curada sobre dados de hormigón, pegado al frente de la casa, con techo de chapa y barandas opcionales.
 * Hay dos líneas con la misma estructura y distinta calidad (`deck.line`, ver `DECK_LOOK`): la Esencial (madera al natural,
 * tornillos a la vista, chapa aluminizada) y la Premium (lasur costero, cantos biselados, zócalo, barandas con listonado,
 * columnas gruesas, chapa acanalada prepintada, canaleta y herrajes).
 * Se dibuja en su propio marco (x a la derecha de la fachada, z hacia afuera, y desde el suelo): el grupo lo lleva a su lugar.
 * `topY` es la cara superior de las tablas, siempre por debajo del umbral de la puerta de entrada.
 */
export function DeckModel({
  deck,
  placement,
  topY,
  woodMap,
  showRoofSheet,
}: {
  deck: DeckConfig;
  placement: DeckPlacement;
  topY: number;
  woodMap: THREE.Texture;
  /** En los cortes (interior, corte, planta) la chapa se oculta, como el techo de la casa. */
  showRoofSheet: boolean;
}) {
  const layout = useMemo(
    () => deckLayout(deck, topY, placement.doorX),
    [deck, topY, placement.doorX],
  );
  const look = DECK_LOOK[deck.line],
    wood = look.madera.color,
    rough = look.madera.rugosidad,
    { roof } = layout;
  return (
    <group
      position={[placement.origin.x, 0, placement.origin.z]}
      rotation-y={Math.atan2(-placement.right.z, placement.right.x)}
      name="deck"
    >
      <Boxes boxes={layout.boards} map={woodMap} color={wood} roughness={rough} />
      <Boxes boxes={layout.frame} map={woodMap} color={wood} roughness={rough} />
      <Boxes boxes={layout.piles} color={DECK_3D_COLORES.hormigon} roughness={0.95} />
      <Boxes boxes={layout.steps} map={woodMap} color={wood} roughness={rough} />
      <Boxes boxes={layout.rails} map={woodMap} color={wood} roughness={rough} />
      <Boxes boxes={layout.fascia} map={woodMap} color={wood} roughness={rough} />
      <Boxes boxes={layout.screws} color={DECK_3D_COLORES.tornillo} roughness={0.6} shadows={false} />
      {roof && (
        <>
          <Boxes boxes={roof.posts} map={woodMap} color={wood} roughness={rough} />
          <Boxes
            boxes={roof.hardware}
            color={DECK_3D_COLORES.herraje}
            roughness={0.4}
            metalness={0.8}
          />
          {showRoofSheet && (
            <Boxes
              boxes={roof.trim}
              color={look.chapa.color}
              roughness={look.chapa.rugosidad}
              metalness={look.chapa.metal}
            />
          )}
          <group position={roof.plane.origin} rotation-x={roof.plane.angle}>
            <Boxes boxes={roof.planeBoxes} map={woodMap} color={wood} roughness={rough} />
            {showRoofSheet && (
              <>
                <SheetRoof {...roof.sheet} chapa={look.chapa} />
                <Boxes
                  boxes={roof.planeTrim}
                  color={look.chapa.color}
                  roughness={look.chapa.rugosidad}
                  metalness={look.chapa.metal}
                />
              </>
            )}
          </group>
        </>
      )}
    </group>
  );
}
