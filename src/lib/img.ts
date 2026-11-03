export type ResponsiveImage = { src: string; srcSet?: string };

/**
 * Las fotos de proyectos viven en public/images/ y se publican en dos tamaños:
 * `nombre.webp` (1600 px de ancho) y `nombre-800.webp` (800 px, para celulares y miniaturas).
 * Si la URL no sigue esa convención (por ejemplo, una imagen subida desde el editor de Lovable),
 * se devuelve tal cual, sin srcSet.
 */
export function responsive(url: string): ResponsiveImage {
  if (!/^\/images\/[^/]+\.webp$/.test(url) || /-(800|1280|2400|movil)\.webp$/.test(url)) return { src: url };
  return { src: url, srcSet: `${url.replace(/\.webp$/, "-800.webp")} 800w, ${url} 1600w` };
}

/** Versión chica (800 px) de una foto de proyecto, para miniaturas. Si no sigue la convención, devuelve la misma URL. */
export function thumbnail(url: string): string {
  return responsive(url).srcSet ? url.replace(/\.webp$/, "-800.webp") : url;
}
