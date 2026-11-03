import { useMemo } from "react";
import { FLOOR_BASE, FLOOR_STEP, useConfigurator } from "@/store/useConfigurator";
import type { HouseVolume } from "@/lib/cameraViews";

/** Huella, posición, giro y altura de la casa tal como están en el diseño (para cámara y vegetación). */
export function useHouseVolume(): HouseVolume {
  const contour = useConfigurator((s) => s.config.contour),
    position = useConfigurator((s) => s.config.position),
    rotation = useConfigurator((s) => s.config.rotation),
    floors = useConfigurator((s) => s.config.floors);
  return useMemo(() => ({ contour, position, rotation, height: FLOOR_BASE + floors * FLOOR_STEP }), [contour, position, rotation, floors]);
}
