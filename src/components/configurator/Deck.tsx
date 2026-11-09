import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { DECK_3D, type DeckConfig } from "@/config/deck";
import { deckLayout, type DeckBox } from "@/config/deckLayout";
import type { DeckPlacement } from "@/config/deckGeometry";
import { boxesGeometry, sheetGeometry } from "./deckMeshes";
import { pbrProps } from "./pbr";

/** Cajas de madera unidas en una sola malla. */
function Boxes({
  boxes,
  map,
  color,
}: {
  boxes: DeckBox[];
  map?: THREE.Texture | undefined;
  color?: string | undefined;
}) {
  const geometry = useMemo(() => boxesGeometry(boxes), [boxes]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        {...pbrProps(map)}
        {...(map ? { map } : {})}
        {...(color ? { color } : {})}
        roughness={map ? 1 : 0.8}
      />
    </mesh>
  );
}

function SheetRoof({ width, z0, z1, y }: { width: number; z0: number; z1: number; y: number }) {
  const geometry = useMemo(() => sheetGeometry(width, z0, z1), [width, z0, z1]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} position-y={y} castShadow receiveShadow>
      <meshStandardMaterial
        color={DECK_3D.chapaColor}
        metalness={0.6}
        roughness={0.45}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Deck de pino curado sobre pilotes, pegado al frente de la casa, con techo de chapa y barandas opcionales.
 * Se dibuja en su propio marco (x a la derecha de la fachada, z hacia afuera, y desde el suelo): el grupo lo lleva a su lugar.
 * `topY` es la cara superior de las tablas, siempre por debajo del umbral de la puerta de entrada.
 */
export function DeckModel({
  deck,
  placement,
  topY,
  woodMap,
  pileMap,
  showRoofSheet,
}: {
  deck: DeckConfig;
  placement: DeckPlacement;
  topY: number;
  woodMap: THREE.Texture;
  pileMap: THREE.Texture;
  /** En los cortes (interior, corte, planta) la chapa se oculta, como el techo de la casa. */
  showRoofSheet: boolean;
}) {
  const layout = useMemo(
    () => deckLayout(deck, topY, placement.doorX),
    [deck, topY, placement.doorX],
  );
  const wood = DECK_3D.maderaColor,
    { roof } = layout;
  return (
    <group
      position={[placement.origin.x, 0, placement.origin.z]}
      rotation-y={Math.atan2(-placement.right.z, placement.right.x)}
      name="deck"
    >
      <Boxes boxes={layout.boards} map={woodMap} color={wood} />
      <Boxes boxes={layout.frame} map={woodMap} color={wood} />
      <Boxes boxes={layout.piles} map={pileMap} />
      <Boxes boxes={layout.steps} map={woodMap} color={wood} />
      <Boxes boxes={layout.rails} map={woodMap} color={wood} />
      {roof && (
        <>
          <Boxes boxes={roof.posts} map={woodMap} color={wood} />
          <group position={roof.plane.origin} rotation-x={roof.plane.angle}>
            <Boxes boxes={roof.planeBoxes} map={woodMap} color={wood} />
            {showRoofSheet && <SheetRoof {...roof.sheet} />}
          </group>
        </>
      )}
    </group>
  );
}
