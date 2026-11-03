/**
 * Captura de imagen en alta resolución (4K) y grabación de video del visor 3D, ambas con la marca de agua del logo de SCH.
 * No depende de Three: recibe el renderer, la escena y la cámara por interfaces mínimas (así se puede probar con un renderer falso).
 * Solo navegador (usa canvas y MediaRecorder).
 */
import { looksBlank, samplePoints } from "./renderQuality";

export type Size = { width: number; height: number };

/** Lado mayor de una imagen 4K (UHD). */
export const CAPTURE_LONG_SIDE_4K = 3840;
/** Lado mayor del video (Full HD). */
export const RECORD_LONG_SIDE = 1920;
/** Duración máxima de una grabación (resguardo de memoria si alguien olvida detenerla). */
export const RECORD_MAX_MS = 3 * 60 * 1000;
/** Safari en iPhone limita un canvas a 4096 × 4096 px; es un tope prudente para todos. */
const MAX_IMAGE_PIXELS = 4096 * 4096;
const MAX_VIDEO_PIXELS = 4_000_000;

const evenRound = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Tamaño de salida: misma proporción que el visor (el encuadre no cambia), con `longSide` px en el lado mayor,
 * sin pasar de `maxDimension` (límite del dispositivo) ni de `maxPixels`. Lados pares (los codificadores de video lo piden).
 */
export function fitOutputSize(view: Size, longSide: number, maxDimension = 16384, maxPixels = MAX_IMAGE_PIXELS): Size {
  const w = Math.max(1, view.width);
  const h = Math.max(1, view.height);
  const target = Math.max(2, Math.min(longSide, maxDimension));
  let scale = target / Math.max(w, h);
  if (w * scale * h * scale > maxPixels) scale = Math.sqrt(maxPixels / (w * h));
  return { width: evenRound(w * scale), height: evenRound(h * scale) };
}

/** `true` si el lado mayor llega a 3840 px (4K UHD). */
export const is4K = (size: Size) => Math.max(size.width, size.height) >= CAPTURE_LONG_SIDE_4K;

/** Nombre de archivo con la resolución real, p. ej. `SCH-mi-cabana-3840x2160.png`. */
export function mediaFileName(kind: "imagen" | "recorrido", size: Size, extension: string): string {
  return `SCH-${kind === "imagen" ? "mi-cabana" : "recorrido-cabana"}-${size.width}x${size.height}.${extension}`;
}

/** `mm:ss` para el contador de grabación. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Formatos de grabación, del preferido al último recurso: MP4 primero (se comparte directo por WhatsApp). */
export const RECORDING_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export function pickRecordingMime(isSupported: (mime: string) => boolean): string | null {
  for (const mime of RECORDING_MIME_CANDIDATES) {
    try {
      if (isSupported(mime)) return mime;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

/** `true` si el navegador puede grabar un canvas (MediaRecorder + captureStream) con algún formato conocido. */
export function recordingSupport(): { supported: boolean; mime: string | null } {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    return { supported: false, mime: null };
  }
  const mime = pickRecordingMime((m) => MediaRecorder.isTypeSupported(m));
  return { supported: mime !== null, mime };
}

/** Decodifica el logo. Devuelve `null` si no se puede (entonces la marca de agua es el nombre escrito). */
export async function loadLogo(url: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/**
 * Marca de agua: el logo de SCH abajo a la derecha, al 13 % del lado menor, con sombra suave para que se lea sobre
 * cualquier fondo. Si el logo no cargó, escribe "SCH CONSTRUCCIONES" en su lugar.
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, logo: HTMLImageElement | null): void {
  const base = Math.min(width, height);
  const margin = Math.round(base * 0.035);
  ctx.save();
  ctx.globalAlpha = 0.93;
  if (logo && (logo.naturalWidth || logo.width) > 0) {
    const ratio = (logo.naturalWidth || logo.width) / (logo.naturalHeight || logo.height || 1);
    const h = Math.round(base * 0.13);
    const w = Math.round(h * ratio);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = h * 0.08;
    ctx.shadowOffsetY = h * 0.02;
    ctx.drawImage(logo, width - w - margin, height - h - margin, w, h);
  } else {
    const font = Math.max(14, Math.round(base * 0.03));
    ctx.font = `700 ${font}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = font * 0.3;
    ctx.fillStyle = "#F7F6F2";
    ctx.fillText("SCH CONSTRUCCIONES", width - margin, height - margin);
  }
  ctx.restore();
}

/** Lo mínimo que se usa del renderer de Three (`WebGLRenderer` lo cumple). */
export type RendererLike = {
  domElement: HTMLCanvasElement;
  getPixelRatio(): number;
  getSize(target: { set(x: number, y: number): unknown; x: number; y: number }): { x: number; y: number };
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: never, camera: never): void;
  getContext(): WebGLRenderingContext | WebGL2RenderingContext;
};

const vec2 = () => ({ x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; return this; } });

/** Mayor lado que admite el dispositivo para el buffer de dibujo (con 4096 de respaldo si no se puede consultar). */
export function deviceMaxDimension(gl: Pick<RendererLike, "getContext">): number {
  try {
    const ctx = gl.getContext();
    const renderbuffer = Number(ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE)) || 4096;
    const viewport = ctx.getParameter(ctx.MAX_VIEWPORT_DIMS) as ArrayLike<number> | null;
    const viewportMax = viewport ? Math.min(Number(viewport[0]) || 4096, Number(viewport[1]) || 4096) : 4096;
    return Math.min(renderbuffer, viewportMax);
  } catch {
    return 4096;
  }
}

/**
 * Dibuja la escena a `size` px y la copia a un canvas 2D. El renderer vuelve a su tamaño y densidad de píxeles anteriores
 * (y se redibuja) aunque falle. La proporción de `size` es la del visor, así que la cámara no se toca.
 */
export type RenderHooks = {
  /**
   * Dibuja el cuadro en lugar de `gl.render` (por ejemplo, con la cadena de postproducción). El renderer ya tiene el tamaño
   * de la captura cuando se la llama.
   */
  draw?: (size: Size) => void;
  /** Se llama al terminar (y aunque falle), con el renderer ya en su tamaño original, para que el visor se redibuje con su propia cadena. */
  restored?: () => void;
};

export function renderToCanvas(gl: RendererLike, scene: unknown, camera: unknown, size: Size, hooks: RenderHooks = {}): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = size.width;
  out.height = size.height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el lienzo de captura.");
  const previousRatio = gl.getPixelRatio();
  const previous = gl.getSize(vec2());
  try {
    gl.setPixelRatio(1);
    gl.setSize(size.width, size.height, false);
    if (hooks.draw) hooks.draw(size);
    else gl.render(scene as never, camera as never);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(gl.domElement, 0, 0, size.width, size.height);
  } finally {
    gl.setPixelRatio(previousRatio);
    gl.setSize(previous.x, previous.y, false);
    // Con una cadena propia no se redibuja acá con `gl.render` (saldría sin efectos): lo hace el visor en su próximo cuadro.
    if (hooks.restored) hooks.restored();
    else gl.render(scene as never, camera as never);
  }
  return out;
}

/** Nueve píxeles de la captura (RGBA seguidos), para comprobar que no salió completamente negra. */
function sampleCanvas(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const values: number[] = [];
  for (const p of samplePoints(canvas.width, canvas.height)) values.push(...Array.from(ctx.getImageData(p.x, p.y, 1, 1).data));
  return values;
}

export type HiResCapture = { blob: Blob; size: Size; is4K: boolean };

/**
 * Captura PNG de la vista actual en 4K (lado mayor 3840 px) con la marca de agua de SCH.
 * Si el dispositivo no puede, reintenta con 2560 y 1920 px; `is4K` dice cuál se logró (el archivo lleva la resolución real).
 */
export async function captureHiRes(options: { gl: RendererLike; scene: unknown; camera: unknown; logo: HTMLImageElement | null } & RenderHooks): Promise<HiResCapture> {
  const { gl, scene, camera, logo, draw, restored } = options;
  const view = { width: gl.domElement.clientWidth || gl.domElement.width, height: gl.domElement.clientHeight || gl.domElement.height };
  const limit = deviceMaxDimension(gl);
  let lastError: unknown = new Error("No se pudo capturar.");
  for (const longSide of [CAPTURE_LONG_SIDE_4K, 2560, 1920]) {
    const size = fitOutputSize(view, longSide, limit);
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = renderToCanvas(gl, scene, camera, size, { draw, restored });
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo crear el lienzo de captura.");
      // Una captura negra (memoria de video agotada, por ejemplo) no se entrega: se reintenta a menor resolución.
      if (looksBlank(sampleCanvas(canvas))) throw new Error("La captura salió vacía.");
      drawWatermark(ctx, size.width, size.height, logo);
      const target = canvas;
      const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, "image/png"));
      if (!blob || blob.size === 0) throw new Error("El navegador no pudo generar el PNG.");
      return { blob, size, is4K: is4K(size) };
    } catch (error) {
      lastError = error;
    } finally {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
  }
  throw lastError;
}

export type RecordingResult = { blob: Blob; mime: string; extension: "mp4" | "webm"; durationMs: number; size: Size };
export type RecorderHandle = {
  size: Size;
  mime: string;
  /** Termina y devuelve el video. Llamarlo más de una vez devuelve el mismo resultado. */
  stop: () => Promise<RecordingResult>;
  /** Descarta la grabación (por ejemplo al cerrar el visor). */
  cancel: () => void;
};

/**
 * Graba lo que se ve en `source` (el canvas del visor) con la marca de agua. Compone cada cuadro en un canvas aparte
 * (`captureStream`) y lo codifica con MediaRecorder. Lanza un error si el navegador no puede grabar.
 */
export function startRecording(options: { source: HTMLCanvasElement; logo: HTMLImageElement | null; longSide?: number; fps?: number; maxMs?: number; onLimit?: () => void }): RecorderHandle {
  const { source, logo, longSide = RECORD_LONG_SIDE, fps = 30, maxMs = RECORD_MAX_MS, onLimit } = options;
  const support = recordingSupport();
  if (!support.supported || !support.mime) throw new Error("Este navegador no puede grabar video.");
  const mime = support.mime;

  const size = fitOutputSize({ width: source.clientWidth || source.width, height: source.clientHeight || source.height }, longSide, 8192, MAX_VIDEO_PIXELS);
  const composite = document.createElement("canvas");
  composite.width = size.width;
  composite.height = size.height;
  const ctx = composite.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el lienzo de grabación.");
  ctx.imageSmoothingQuality = "high";

  const draw = () => {
    ctx.fillStyle = "#171817";
    ctx.fillRect(0, 0, size.width, size.height);
    if (source.width > 0 && source.height > 0) {
      const k = Math.min(size.width / source.width, size.height / source.height);
      const w = source.width * k;
      const h = source.height * k;
      ctx.drawImage(source, (size.width - w) / 2, (size.height - h) / 2, w, h);
    }
    drawWatermark(ctx, size.width, size.height, logo);
  };
  draw();

  const stream = composite.captureStream(fps);
  const bitrate = Math.min(12_000_000, Math.max(4_000_000, Math.round(size.width * size.height * fps * 0.12)));
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  const chunks: Blob[] = [];
  let frame = 0;
  let limitTimer: ReturnType<typeof setTimeout> | null = null;
  const startedAt = performance.now();
  const loop = () => { draw(); frame = requestAnimationFrame(loop); };
  const cleanup = () => {
    cancelAnimationFrame(frame);
    if (limitTimer) { clearTimeout(limitTimer); limitTimer = null; }
    stream.getTracks().forEach((track) => track.stop());
    composite.width = 0;
    composite.height = 0;
  };

  recorder.ondataavailable = (event) => { if (event.data && event.data.size > 0) chunks.push(event.data); };
  recorder.start(1000);
  frame = requestAnimationFrame(loop);
  if (onLimit) limitTimer = setTimeout(onLimit, maxMs);

  let result: Promise<RecordingResult> | null = null;
  const stop = () => {
    if (result) return result;
    result = new Promise<RecordingResult>((resolve, reject) => {
      const finish = () => {
        const durationMs = performance.now() - startedAt;
        cleanup();
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        if (blob.size === 0) reject(new Error("La grabación quedó vacía."));
        else resolve({ blob, mime, extension: mime.startsWith("video/mp4") ? "mp4" : "webm", durationMs, size });
      };
      recorder.onstop = finish;
      recorder.onerror = () => { cleanup(); reject(new Error("Falló la grabación.")); };
      if (recorder.state === "inactive") finish();
      else recorder.stop();
    });
    return result;
  };
  const cancel = () => {
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* ya detenido */ }
    result = Promise.reject(new Error("Grabación cancelada."));
    result.catch(() => undefined);
    cleanup();
  };
  return { size, mime, stop, cancel };
}

/** Descarga un `Blob` con el nombre dado. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
