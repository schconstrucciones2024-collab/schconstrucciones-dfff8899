import { useEffect } from "react";
import { installImageGuard } from "@/lib/imageGuard";

/** No dibuja nada: instala el freno al copiado casual de imágenes (ver `lib/imageGuard.ts`). */
export function ImageGuard() {
  useEffect(() => installImageGuard(document), []);
  return null;
}
