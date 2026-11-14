import { useMemo } from "react";
import * as THREE from "three";
import type { FinishId } from "@/config/materials";
import { paintLooks, type PaintConfig, type PaintLook } from "@/config/paint";

/** Color y brillo de una cara pintada, listos para el material de three. */
export type SurfaceLook = { color: THREE.Color; roughness: number };
export type SurfaceLooks = { interior: SurfaceLook | null; exterior: SurfaceLook | null };

const toLook = (look: PaintLook | null): SurfaceLook | null =>
  look
    ? {
        // El tinte multiplica el color de la textura en el espacio lineal; por eso se arma en lineal y puede pasar de 1.
        color: new THREE.Color().setRGB(look.tint[0], look.tint[1], look.tint[2], THREE.LinearSRGBColorSpace),
        roughness: look.roughness,
      }
    : null;

/**
 * La pintura elegida convertida a materiales. Sin pintura (o con esa cara apagada) devuelve null y el visor queda
 * exactamente como estaba: las texturas no se tocan y solo se multiplica su color.
 */
export function usePaintLooks(paint: PaintConfig | undefined, finish: FinishId): SurfaceLooks {
  return useMemo(() => {
    const looks = paintLooks(paint, finish);
    return { interior: toLook(looks.interior), exterior: toLook(looks.exterior) };
  }, [paint, finish]);
}

/** Props del material para una cara: sin pintura queda la rugosidad de siempre y sin color. */
export const lookProps = (look: SurfaceLook | null | undefined) =>
  look ? { color: look.color, roughness: look.roughness } : { roughness: 1 };
