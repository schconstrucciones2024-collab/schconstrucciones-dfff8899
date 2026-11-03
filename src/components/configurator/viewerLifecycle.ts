/** A disposed canvas loses its context intentionally; only a live viewer can fail. */
export function watchViewerContext(canvas: HTMLCanvasElement, onFail: () => void) {
  let active = true;
  const lost = () => {
    if (active && canvas.isConnected) onFail();
  };
  canvas.addEventListener('webglcontextlost', lost);
  return () => {
    active = false;
    canvas.removeEventListener('webglcontextlost', lost);
  };
}