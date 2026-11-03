import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { sceneGlow, skyClock } from "@/store/useEntorno";
import { useRenderFx } from "@/store/useRenderFx";
import { skyAt } from "@/lib/skyModel";
import { createGovernor, fxParams, type EffectiveFx, type FxParams } from "@/lib/renderQuality";
import { createPipeline, frameIsBlank, renderOnce, type Pipeline, type PipelineConfig } from "./renderPipeline";
import { useEffectiveFx } from "./useEffectiveFx";

/**
 * Postproducción del visor: oclusión ambiental, brillo de luces, tono de cine, suavizado de bordes y color/viñeta.
 *
 * Mientras está activa, este componente es quien dibuja cada cuadro (prioridad 1 en `useFrame`: React Three Fiber deja de
 * dibujar por su cuenta). Si algo falla —al armar la cadena, al dibujar o si el cuadro sale negro— se desactiva sola, el
 * visor vuelve al render simple de siempre y un aviso lo explica en la barra de Visualización.
 */

export type PostApi = {
  /** Dibuja un cuadro de `size` px con todos los efectos (lo usa la captura 4K). */
  renderOnce: (size: { width: number; height: number }) => void;
};

const configOf = (fx: EffectiveFx): PipelineConfig => ({ ao: fx.ao, bloom: fx.bloom, fxaa: fx.fxaa, cine: fx.cine, msaa: fx.msaa });
/**
 * Cuadros en los que se comprueba que la imagen no esté vacía. El visor dibuja solo cuando hace falta, así que al armar la cadena
 * se piden unos cuadros extra (ver `PROBE_FRAMES_MS`) para que la comprobación corra siempre, aunque la escena esté quieta.
 */
const BLANK_CHECKS = [2, 4];
const PROBE_FRAMES_MS = [250, 600, 1200];

export function PostFX({ api }: { api: MutableRefObject<PostApi | null> }) {
  const fx = useEffectiveFx();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const fxRef = useRef(fx);
  fxRef.current = fx;
  const paramsRef = useRef<FxParams>(fxParams(fx, { day: 1, glow: 0 }));
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);

  useEffect(() => {
    if (!fx.post) return;
    const config = configOf(fxRef.current);
    let made: Pipeline;
    try {
      made = createPipeline({ gl, scene, camera: get().camera, width: sizeRef.current.width, height: sizeRef.current.height, pixelRatio: gl.getPixelRatio(), config, params: paramsRef.current });
    } catch (error) {
      console.warn("[render] No se pudo armar la postproducción.", error);
      useRenderFx.getState().fail("este dispositivo no admite la postproducción. Se usa el render simple.");
      return;
    }
    setPipeline(made);
    api.current = { renderOnce: (sz) => renderOnce(gl, scene, get().camera, sz, config, paramsRef.current) };
    invalidate();
    return () => {
      api.current = null;
      setPipeline(null);
      made.dispose();
      invalidate();
    };
    // `fx.key` cambia solo cuando hay que rearmar la cadena (efectos, suavizado, muestras).
  }, [fx.key, fx.post, gl, scene, get, invalidate, api]);

  return pipeline ? <Frame pipeline={pipeline} paramsRef={paramsRef} /> : null;
}

function Frame({ pipeline, paramsRef }: { pipeline: Pipeline; paramsRef: MutableRefObject<FxParams> }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const fx = useEffectiveFx();
  const fxRef = useRef(fx);
  fxRef.current = fx;
  const governor = useMemo(() => createGovernor(), []);
  const run = useRef({ frames: 0, key: "" });

  // La cadena sigue al tamaño del visor y a la densidad de píxeles (que cambia, por ejemplo, al cambiar de calidad).
  useEffect(() => {
    pipeline.resize(size.width, size.height, gl.getPixelRatio());
    invalidate();
  }, [pipeline, size.width, size.height, dpr, gl, invalidate]);

  useEffect(() => {
    governor.reset();
    run.current.frames = 0;
    run.current.key = "";
    const timers = PROBE_FRAMES_MS.map((ms) => window.setTimeout(() => invalidate(), ms));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [pipeline, governor, invalidate]);

  useFrame((state, delta) => {
    const r = run.current;
    // Los ajustes que dependen de la hora se recalculan solo cuando cambia el cielo.
    const key = `${skyClock.hour.toFixed(3)}|${sceneGlow.level.toFixed(2)}`;
    if (key !== r.key) {
      r.key = key;
      paramsRef.current = fxParams(fxRef.current, { day: skyAt(skyClock.hour).day, glow: sceneGlow.level });
      pipeline.setParams(paramsRef.current);
    }
    try {
      pipeline.render(delta, state.camera);
    } catch (error) {
      console.warn("[render] Falló el dibujo con postproducción.", error);
      useRenderFx.getState().fail("falló el dibujo con efectos en este dispositivo. Se usa el render simple.");
      return;
    }
    r.frames++;
    if (BLANK_CHECKS.includes(r.frames) && frameIsBlank(gl)) {
      useRenderFx.getState().fail("la imagen con efectos salió vacía en este dispositivo. Se usa el render simple.");
      return;
    }
    const fxState = useRenderFx.getState();
    if (fxState.auto && governor.push(delta * 1000) === "down") fxState.degrade();
  }, 1);

  return null;
}
