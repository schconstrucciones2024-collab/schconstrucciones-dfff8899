import { describe, expect, it } from "vitest";
import { RECORDING_MIME_CANDIDATES, captureHiRes, fitOutputSize, formatClock, is4K, mediaFileName, pickRecordingMime, renderToCanvas, type RendererLike } from "./mediaCapture";
import { TOUR_INTERIOR_S, exteriorOrbitPose, interiorSweepPose } from "@/components/configurator/tour";

describe("tamaño de captura 4K", () => {
  it("un visor 16:9 da exactamente 3840 × 2160", () => {
    expect(fitOutputSize({ width: 1280, height: 720 }, 3840)).toEqual({ width: 3840, height: 2160 });
    expect(is4K({ width: 3840, height: 2160 })).toBe(true);
  });
  it("conserva la proporción del visor (el encuadre no cambia)", () => {
    for (const [w, h] of [[1000, 750], [390, 600], [1440, 620], [801, 533]] as const) {
      const s = fitOutputSize({ width: w, height: h }, 3840);
      expect(Math.max(s.width, s.height)).toBeGreaterThanOrEqual(3838);
      expect(Math.abs(s.width / s.height - w / h)).toBeLessThan(0.002);
    }
  });
  it("respeta el límite del dispositivo y lo informa (no es 4K)", () => {
    const s = fitOutputSize({ width: 1280, height: 720 }, 3840, 2048);
    expect(s).toEqual({ width: 2048, height: 1152 });
    expect(is4K(s)).toBe(false);
  });
  it("no pasa de 4096 × 4096 px en total (límite de Safari en iPhone)", () => {
    const s = fitOutputSize({ width: 800, height: 800 }, 3840);
    expect(s.width * s.height).toBeLessThanOrEqual(4096 * 4096);
  });
  it("devuelve lados pares y nunca cero", () => {
    const s = fitOutputSize({ width: 333, height: 777 }, 1920, 8192, 4_000_000);
    expect(s.width % 2).toBe(0);
    expect(s.height % 2).toBe(0);
    expect(fitOutputSize({ width: 0, height: 0 }, 3840).width).toBeGreaterThan(0);
  });
});

describe("nombres, contador y formatos", () => {
  it("el archivo lleva la resolución real", () => {
    expect(mediaFileName("imagen", { width: 3840, height: 2160 }, "png")).toBe("SCH-mi-cabana-3840x2160.png");
    expect(mediaFileName("recorrido", { width: 1920, height: 1080 }, "mp4")).toBe("SCH-recorrido-cabana-1920x1080.mp4");
  });
  it("formatea mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(7_400)).toBe("00:07");
    expect(formatClock(125_000)).toBe("02:05");
    expect(formatClock(-5)).toBe("00:00");
  });
  it("elige MP4 si se puede, luego WebM, y null si nada sirve", () => {
    expect(pickRecordingMime(() => true)).toBe(RECORDING_MIME_CANDIDATES[0]);
    expect(pickRecordingMime((m) => m.startsWith("video/webm"))).toBe("video/webm;codecs=vp9");
    expect(pickRecordingMime(() => false)).toBeNull();
    expect(pickRecordingMime(() => { throw new Error("x"); })).toBeNull();
  });
});

describe("recorrido automático", () => {
  it("la vuelta exterior mantiene la distancia y la altura", () => {
    const a = exteriorOrbitPose(0, 10, 6), b = exteriorOrbitPose(5, 10, 6);
    expect(Math.hypot(a.position[0], a.position[2])).toBeCloseTo(Math.hypot(b.position[0], b.position[2]), 6);
    expect(a.position[1]).toBe(b.position[1]);
  });
  it("sigue a la casa si no está en el origen", () => {
    const p = exteriorOrbitPose(2, 10, 6, { x: 5, z: -3 });
    expect(p.target[0]).toBe(5);
    expect(p.target[2]).toBe(-3);
  });
  it("el barrido interior arranca en la vista general y termina más bajo y girado", () => {
    const base = { position: [0, 12, 4] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
    const start = interiorSweepPose(base, 0, TOUR_INTERIOR_S);
    expect(start.position[0]).toBeCloseTo(0, 9);
    expect(start.position[1]).toBeCloseTo(12, 9);
    expect(start.position[2]).toBeCloseTo(4, 9);
    const end = interiorSweepPose(base, TOUR_INTERIOR_S, TOUR_INTERIOR_S);
    expect(end.position[1]).toBeLessThan(12);
    expect(Math.abs(end.position[0])).toBeGreaterThan(1);
    expect(end.target).toEqual(base.target);
  });
});

/* ---------------------------------------------------------------- captura con cadena de efectos */

/** Renderer y canvas falsos: registran qué se llamó y en qué orden, sin necesitar WebGL ni un navegador. */
function fake(pixel: number[] = [90, 120, 160, 255]) {
  const log: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, key) => (key === "getImageData" ? () => ({ data: pixel }) : () => undefined),
    set: () => true,
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: unknown) => void) => cb({ size: 1234 }) };
  (globalThis as unknown as { document: unknown }).document = { createElement: () => canvas };
  let size = { x: 1280, y: 720 }, ratio = 2;
  const gl = {
    domElement: { clientWidth: 1280, clientHeight: 720, width: 2560, height: 1440 },
    getPixelRatio: () => ratio,
    getSize: (v: { set(x: number, y: number): unknown; x: number; y: number }) => { v.set(size.x, size.y); return v; },
    setPixelRatio: (r: number) => { ratio = r; log.push(`ratio ${r}`); },
    setSize: (w: number, h: number) => { size = { x: w, y: h }; log.push(`size ${w}x${h}`); },
    render: () => { log.push("gl.render"); },
    getContext: () => ({ MAX_RENDERBUFFER_SIZE: 1, MAX_VIEWPORT_DIMS: 2, getParameter: () => 16384 }),
  } as unknown as RendererLike;
  return { gl, log, state: () => ({ size, ratio }) };
}

describe("captura con la cadena de efectos del visor", () => {
  it("sin cadena propia dibuja con gl.render y lo redibuja al terminar (como antes)", () => {
    const f = fake();
    renderToCanvas(f.gl, {}, {}, { width: 3840, height: 2160 });
    expect(f.log.filter((l) => l === "gl.render")).toHaveLength(2);
    expect(f.state()).toEqual({ size: { x: 1280, y: 720 }, ratio: 2 });
  });
  it("con una cadena propia la usa en lugar de gl.render y no redibuja sin efectos", () => {
    const f = fake();
    const drawn: { width: number; height: number }[] = [];
    let restored = 0;
    renderToCanvas(f.gl, {}, {}, { width: 3840, height: 2160 }, { draw: (s) => { drawn.push(s); f.log.push("draw"); }, restored: () => { restored++; f.log.push("restored"); } });
    expect(drawn).toEqual([{ width: 3840, height: 2160 }]);
    expect(f.log).not.toContain("gl.render");
    expect(restored).toBe(1);
    // El renderer ya tenía el tamaño de la captura cuando se dibujó, y vuelve al suyo antes de avisar que terminó.
    expect(f.log.indexOf("size 3840x2160")).toBeLessThan(f.log.indexOf("draw"));
    expect(f.log.indexOf("draw")).toBeLessThan(f.log.indexOf("restored"));
    expect(f.log.lastIndexOf("size 1280x720")).toBeLessThan(f.log.indexOf("restored"));
    expect(f.state()).toEqual({ size: { x: 1280, y: 720 }, ratio: 2 });
  });
  it("si la cadena falla, el renderer igual vuelve a su tamaño y se avisa que terminó", () => {
    const f = fake();
    let restored = 0;
    let error: unknown = null;
    try {
      renderToCanvas(f.gl, {}, {}, { width: 3840, height: 2160 }, { draw: () => { throw new Error("shader"); }, restored: () => { restored++; } });
    } catch (e) {
      error = e;
    }
    expect(String(error)).toContain("shader");
    expect(restored).toBe(1);
    expect(f.state()).toEqual({ size: { x: 1280, y: 720 }, ratio: 2 });
  });
  it("captureHiRes entrega la imagen en 4K cuando todo sale bien", async () => {
    const f = fake();
    const shot = await captureHiRes({ gl: f.gl, scene: {}, camera: {}, logo: null, draw: () => undefined, restored: () => undefined });
    expect(shot.size).toEqual({ width: 3840, height: 2160 });
    expect(shot.is4K).toBe(true);
  });
  it("una captura completamente negra no se entrega: reintenta a menor resolución y por fin avisa", async () => {
    const f = fake([0, 0, 0, 255]);
    const sizes: number[] = [];
    let error: unknown = null;
    try {
      await captureHiRes({ gl: f.gl, scene: {}, camera: {}, logo: null, draw: (s) => { sizes.push(s.width); }, restored: () => undefined });
    } catch (e) {
      error = e;
    }
    expect(String(error)).toContain("vacía");
    expect(sizes).toEqual([3840, 2560, 1920]);
  });
  it("si la cadena falla en 4K, prueba con una resolución menor", async () => {
    const f = fake();
    const sizes: number[] = [];
    const shot = await captureHiRes({ gl: f.gl, scene: {}, camera: {}, logo: null, draw: (s) => { sizes.push(s.width); if (s.width > 2560) throw new Error("sin memoria de video"); }, restored: () => undefined });
    expect(sizes).toEqual([3840, 2560]);
    expect(shot.size.width).toBe(2560);
    expect(shot.is4K).toBe(false);
  });
});
