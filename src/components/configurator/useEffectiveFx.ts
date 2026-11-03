import { useMemo } from "react";
import { fxOf, useRenderFx } from "@/store/useRenderFx";
import type { EffectiveFx } from "@/lib/renderQuality";

/** Perfil + interruptores + estado de falla, ya combinados. Solo cambia cuando cambia alguno de ellos. */
export function useEffectiveFx(): EffectiveFx {
  const quality = useRenderFx((s) => s.quality);
  const ao = useRenderFx((s) => s.ao);
  const bloom = useRenderFx((s) => s.bloom);
  const reflections = useRenderFx((s) => s.reflections);
  const cine = useRenderFx((s) => s.cine);
  const failed = useRenderFx((s) => s.failed);
  return useMemo(() => fxOf({ quality, ao, bloom, reflections, cine, failed }), [quality, ao, bloom, reflections, cine, failed]);
}
