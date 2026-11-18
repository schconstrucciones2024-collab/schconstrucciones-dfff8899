import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { PARRILLERO_DIMS as DIM, type ParrilleroFinish, type ParrilleroSide } from "@/config/parrillero";
import { parrilleroLayout } from "@/config/parrilleroLayout";
import { createParrilleroMaterials } from "./parrilleroMaterials";
import {
  ParrilleroAngledHood,
  ParrilleroBase,
  ParrilleroBrickWalls,
  ParrilleroChimney,
  ParrilleroChimneyCap,
  ParrilleroConcreteSlab,
  ParrilleroFaucet,
  ParrilleroFirebox,
  ParrilleroRefractoryBricks,
  ParrilleroSideCounter,
  ParrilleroSink,
} from "./ParrilleroParts";

/** Materiales compartidos por todas las piezas: se crean una vez y se liberan al desmontar. */
function useParrilleroMaterials() {
  const mats = useMemo(() => createParrilleroMaterials(), []);
  useEffect(() => () => mats.dispose(), [mats]);
  return mats;
}

/** Controladores del puntero que el visor le pasa para poder seleccionarlo y arrastrarlo. */
export type ParrilleroPointerHandlers = {
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerCancel?: () => void;
  onLostPointerCapture?: () => void;
  onContextMenu?: (e: ThreeEvent<MouseEvent>) => void;
};

export type ParrilleroModelProps = {
  side: ParrilleroSide;
  finish: ParrilleroFinish;
  /** Mesada con bacha y grifería. */
  sink: boolean;
  /** El lugar no alcanza: se marca la huella en rojo para que se vea dónde chocaría. */
  invalid?: boolean;
  /** Está seleccionado en el visor: se marca la huella para que se vea que se puede mover y girar. */
  selected?: boolean;
  /** Cuánto sube la base desde el terreno (m) cuando un deck rodea al parrillero; 0 si nace del terreno a la vista. */
  lift?: number;
  /** Seleccionar y arrastrar. */
  handlers?: ParrilleroPointerHandlers;
};

/**
 * Parrillero de mampostería en 3D, dibujado alrededor del CENTRO de su huella (x a lo largo de la profundidad, z a lo largo de
 * los 3 m): quien lo usa lo ubica, lo mueve y lo gira como un solo objeto (ver `ParrilleroScene` en House.tsx).
 * Nace del terreno (y = 0): el deck se adapta a él, nunca al revés; si el deck lo rodea, la base se alarga hacia arriba (`lift`)
 * para que la mesada quede a 0,90 m sobre el deck. La forma depende solo del lateral y de la bacha; la terminación (ladrillo
 * visto o revoque fino) solo cambia el material del exterior, así que cambiarla no recalcula ninguna geometría.
 */
export function ParrilleroModel({ side, finish, sink, invalid = false, selected = false, lift = 0, handlers }: ParrilleroModelProps) {
  const layout = useMemo(() => parrilleroLayout(side, sink, lift), [side, sink, lift]),
    mats = useParrilleroMaterials(),
    exterior = finish === "ladrillo" ? mats.brick : mats.plaster;
  return (
    <group name="parrillero" {...handlers}>
      <group position={[0, 0, -DIM.anchoTotal / 2]}>
        <ParrilleroBase base={layout.base} render={mats.base} niche={mats.niche} />
        <ParrilleroConcreteSlab slab={layout.slab} material={mats.concrete} />
        <ParrilleroBrickWalls walls={layout.walls} material={exterior} />
        <ParrilleroFirebox firebox={layout.firebox} floor={mats.refractory} soot={mats.soot} />
        <ParrilleroRefractoryBricks boxes={layout.refractory} material={mats.refractory} />
        <ParrilleroAngledHood hood={layout.hood} material={exterior} />
        <ParrilleroChimney boxes={layout.chimney} material={exterior} />
        <ParrilleroChimneyCap cap={layout.cap} material={exterior} hole={mats.soot} />
        <ParrilleroSideCounter boxes={layout.counter} material={mats.concrete} />
        {layout.sink && <ParrilleroSink sink={layout.sink} steel={mats.stainless} drain={mats.soot} />}
        {layout.faucet && <ParrilleroFaucet cyls={layout.faucet} material={mats.stainless} />}
      </group>
      {(invalid || selected) && (
        <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} renderOrder={2}>
          <planeGeometry args={[DIM.profundidad + 0.3, DIM.anchoTotal + 0.3]} />
          <meshBasicMaterial color={invalid ? "#d93b2f" : "#e3c27a"} transparent opacity={invalid ? 0.4 : 0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
