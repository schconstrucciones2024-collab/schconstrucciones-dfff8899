/**
 * Freno ligero contra el copiado casual de las fotos del sitio: sin menú contextual («Guardar imagen como…», también el toque
 * largo en el celular) y sin arrastrar la imagen a otra ventana o al escritorio.
 *
 * Es solo un desincentivo: no impide capturas de pantalla, las herramientas del navegador ni los programas que descargan
 * páginas. Por eso el texto NO se bloquea (se necesita para copiar el teléfono o el correo, para los lectores de pantalla y
 * para que Google lo lea). La protección de fondo es legal (aviso de derechos de autor) y de rastreadores (robots.txt).
 *
 * Una imagen con `data-allow-image-save` (o dentro de un elemento que la tenga) queda fuera: sirve para lo que sí queremos
 * que la persona guarde.
 */
export const IMAGE_GUARD_OPT_OUT = "data-allow-image-save";

type MaybeElement = { closest?: (selector: string) => unknown } | null | undefined;

/** `true` si el evento viene de una imagen del sitio que no pidió quedar libre. */
export function shouldBlockImageAction(target: unknown): boolean {
  const el = target as MaybeElement;
  if (!el || typeof el.closest !== "function") return false;
  return Boolean(el.closest("img")) && !el.closest(`[${IMAGE_GUARD_OPT_OUT}]`);
}

/** Instala los frenos en el documento y devuelve la función que los quita. */
export function installImageGuard(doc: Pick<Document, "addEventListener" | "removeEventListener">): () => void {
  const block = (event: Event) => {
    if (shouldBlockImageAction(event.target)) event.preventDefault();
  };
  doc.addEventListener("contextmenu", block);
  doc.addEventListener("dragstart", block);
  return () => {
    doc.removeEventListener("contextmenu", block);
    doc.removeEventListener("dragstart", block);
  };
}
