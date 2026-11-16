import { useEffect, useMemo } from "react";
import type { ParrilleroFinish, ParrilleroSide } from "@/config/parrillero";
import { parrilleroLayout } from "@/config/parrilleroLayout";
import { parrilleroRects, type FacadeFrame } from "@/config/parrilleroGeometry";
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

export type ParrilleroModelProps = {
  side: ParrilleroSide;
  finish: ParrilleroFinish;
  /** Mesada con bacha y grifería. */
  sink: boolean;
  /** El frente de la casa donde se apoya el parrillero (el mismo marco que el deck). */
  frame: FacadeFrame;
  /** El lugar no alcanza: se marca la huella en rojo para que se vea dónde chocaría. */
  invalid?: boolean;
  /** Cuánto sube la base desde el terreno (m) cuando un deck rodea al parrillero; 0 si nace del terreno a la vista. */
  lift?: number;
};

/**
 * Parrillero de mampostería en 3D. Nace del terreno (y = 0): el deck se adapta a él, nunca al revés; si el deck lo rodea, la base se alarga hacia arriba (`lift`)
 * para que la mesada quede a 0,90 m sobre el deck. La forma depende solo del
 * lateral y de la bacha; la terminación (ladrillo visto o revoque fino) solo cambia el material del exterior, así que cambiarla
 * no recalcula ninguna geometría.
 */
export function ParrilleroModel({ side, finish, sink, frame, invalid = false, lift = 0 }: ParrilleroModelProps) {
  const layout = useMemo(() => parrilleroLayout(side, sink, lift), [side, sink, lift]),
    rects = useMemo(() => parrilleroRects(side, frame.length), [side, frame.length]),
    mats = useParrilleroMaterials(),
    exterior = finish === "ladrillo" ? mats.brick : mats.plaster;
  const f = rects.footprint;
  return (
    <group
      name="parrillero"
      position={[frame.origin.x, 0, frame.origin.z]}
      rotation-y={Math.atan2(-frame.right.z, frame.right.x)}
    >
      <group position={[rects.cx, 0, rects.z0]}>
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
      {invalid && (
        <mesh position={[(f.x0 + f.x1) / 2, 0.03, (f.z0 + f.z1) / 2]} rotation-x={-Math.PI / 2} renderOrder={2}>
          <planeGeometry args={[f.x1 - f.x0 + 0.3, f.z1 - f.z0 + 0.3]} />
          <meshBasicMaterial color="#d93b2f" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
