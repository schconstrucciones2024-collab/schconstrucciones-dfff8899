import { useEffect, useMemo } from "react";
import type * as THREE from "three";
import type { Box as DeckBox } from "@/config/deckCutout";
import type { ParrilleroLayout, PCyl, PPrism } from "@/config/parrilleroLayout";
import { partGeometry } from "./parrilleroMeshes";

/**
 * Las once piezas del parrillero. Cada una es independiente y reutilizable: recibe solo sus formas (ya calculadas en
 * `parrilleroLayout`) y el material con el que se dibuja. Las formas se unen en una sola geometría por pieza (un mesh, un
 * material) y se liberan al desmontar. Los materiales los comparte `ParrilleroModel`: acá no se crea ninguno.
 */
type PartProps = { material: THREE.Material; name: string; boxes?: DeckBox[]; prisms?: PPrism[]; cyls?: PCyl[]; shadows?: boolean };

function Part({ material, name, boxes, prisms, cyls, shadows = true }: PartProps) {
  const geometry = useMemo(() => partGeometry({ boxes, prisms, cyls }), [boxes, prisms, cyls]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh name={name} geometry={geometry} material={material} castShadow={shadows} receiveShadow />;
}

/** 1 · Base de mampostería de ticholos, revocada, que nace del terreno (y sus nichos). */
export function ParrilleroBase({ base, render, niche }: { base: ParrilleroLayout["base"]; render: THREE.Material; niche: THREE.Material }) {
  return (
    <>
      <Part name="parrillero-base" material={render} boxes={base.render} />
      <Part name="parrillero-nichos" material={niche} boxes={base.niche} shadows={false} />
    </>
  );
}

/** 2 · Losa de hormigón armado: piso del hogar, frente, mesada lateral y zona de la bacha, todo continuo. */
export function ParrilleroConcreteSlab({ slab, material }: { slab: DeckBox[]; material: THREE.Material }) {
  return <Part name="parrillero-losa" material={material} boxes={slab} />;
}

/** 3 · Muros de ladrillo del cuerpo: fondo y laterales del hogar. */
export function ParrilleroBrickWalls({ walls, material }: { walls: ParrilleroLayout["walls"]; material: THREE.Material }) {
  return <Part name="parrillero-muros" material={material} boxes={walls.boxes} prisms={walls.prisms} />;
}

/** 4 · Hogar: piso refractario sobre la losa y hollín en el cielo. */
export function ParrilleroFirebox({ firebox, floor, soot }: { firebox: ParrilleroLayout["firebox"]; floor: THREE.Material; soot: THREE.Material }) {
  return (
    <>
      <Part name="parrillero-hogar-piso" material={floor} boxes={firebox.floor} />
      <Part name="parrillero-hogar-hollin" material={soot} boxes={firebox.soot} shadows={false} />
    </>
  );
}

/** 5 · Ladrillos refractarios: fondo y laterales del hogar (otro material que el ladrillo exterior). */
export function ParrilleroRefractoryBricks({ boxes, material }: { boxes: DeckBox[]; material: THREE.Material }) {
  return <Part name="parrillero-refractario" material={material} boxes={boxes} />;
}

/** 6 · Campana inclinada: una pendiente en diagonal, una sola construcción de mampostería con el remate. */
export function ParrilleroAngledHood({ hood, material }: { hood: ParrilleroLayout["hood"]; material: THREE.Material }) {
  return <Part name="parrillero-campana" material={material} prisms={[...hood.prisms, ...hood.coping]} />;
}

/** 7 · Chimenea vertical de ladrillo. */
export function ParrilleroChimney({ boxes, material }: { boxes: DeckBox[]; material: THREE.Material }) {
  return <Part name="parrillero-chimenea" material={material} boxes={boxes} />;
}

/** 8 · Remate de ladrillo de la chimenea, con el agujero de salida del humo. */
export function ParrilleroChimneyCap({ cap, material, hole }: { cap: ParrilleroLayout["cap"]; material: THREE.Material; hole: THREE.Material }) {
  return (
    <>
      <Part name="parrillero-remate" material={material} boxes={cap.ring} />
      <Part name="parrillero-humo" material={hole} boxes={cap.hole} shadows={false} />
    </>
  );
}

/** 9 · Mesada lateral: respaldo de hormigón sobre la losa. */
export function ParrilleroSideCounter({ boxes, material }: { boxes: DeckBox[]; material: THREE.Material }) {
  return <Part name="parrillero-mesada" material={material} boxes={boxes} />;
}

/** 10 · Bacha de acero inoxidable, embutida en la mesada. */
export function ParrilleroSink({ sink, steel, drain }: { sink: NonNullable<ParrilleroLayout["sink"]>; steel: THREE.Material; drain: THREE.Material }) {
  return (
    <>
      <Part name="parrillero-bacha" material={steel} boxes={[...sink.rim, ...sink.basin]} />
      <Part name="parrillero-desague" material={drain} boxes={sink.drain} shadows={false} />
    </>
  );
}

/** 11 · Grifería metálica sobre la mesada. */
export function ParrilleroFaucet({ cyls, material }: { cyls: PCyl[]; material: THREE.Material }) {
  return <Part name="parrillero-griferia" material={material} cyls={cyls} />;
}
