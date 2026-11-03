import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { looksBlank, samplePoints, type AoConfig, type FxParams } from "@/lib/renderQuality";

/**
 * Cadena de postproducción del visor, armada solo con lo que ya trae Three (sin librerías nuevas):
 *
 *   escena → oclusión ambiental → brillo (bloom) → tono de cine + sRGB → suavizado FXAA → color y viñeta
 *
 * La escena se dibuja en alto rango dinámico (HalfFloat) y el tono de cine (ACES, el mismo que ya usaba el visor)
 * se aplica recién en `OutputPass`. Lo que viene después trabaja sobre la imagen ya lista para mostrar.
 */

export type PipelineConfig = { ao: AoConfig | null; bloom: boolean; fxaa: boolean; cine: boolean; msaa: 0 | 4 };

export type Pipeline = {
  /** Dibuja un cuadro en el canvas del renderer. */
  render(delta: number, camera: THREE.Camera): void;
  /** `width` y `height` en píxeles CSS; el factor de densidad va aparte. */
  resize(width: number, height: number, pixelRatio: number): void;
  setParams(params: FxParams): void;
  dispose(): void;
};

/** Ajuste de color y viñeta, más un punto de ruido de 1/255 que evita las bandas en los degradés del cielo. */
const FINISH_SHADER = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, vignette: { value: 0 }, saturation: { value: 1 }, contrast: { value: 1 } },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float vignette;
uniform float saturation;
uniform float contrast;
varying vec2 vUv;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(vec3(l), c.rgb, saturation);
  c.rgb = (c.rgb - 0.5) * contrast + 0.5;
  float d = length((vUv - 0.5) * vec2(1.0, 0.85));
  c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.95, d);
  c.rgb += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);
}`,
};

type AoParams = Parameters<GTAOPass["updateGtaoMaterial"]>[0];
type PdParams = Parameters<GTAOPass["updatePdMaterial"]>[0];

export function createPipeline(options: {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  width: number;
  height: number;
  pixelRatio: number;
  config: PipelineConfig;
  params: FxParams;
}): Pipeline {
  const { gl, scene, config } = options;
  const ratio = Math.max(0.5, options.pixelRatio), w = Math.max(1, Math.round(options.width)), h = Math.max(1, Math.round(options.height));

  // Con suavizado de bordes propio (MSAA) la cadena necesita su propio buffer: el antialias del canvas no alcanza a los buffers internos.
  const target = config.msaa > 0 ? new THREE.WebGLRenderTarget(Math.round(w * ratio), Math.round(h * ratio), { type: THREE.HalfFloatType, samples: config.msaa }) : undefined;
  const composer = new EffectComposer(gl, target);
  composer.setPixelRatio(ratio);
  composer.setSize(w, h);

  const renderPass = new RenderPass(scene, options.camera);
  composer.addPass(renderPass);

  let gtao: GTAOPass | null = null;
  if (config.ao) {
    gtao = new GTAOPass(scene, options.camera, Math.round(w * ratio), Math.round(h * ratio));
    gtao.blendIntensity = options.params.aoIntensity;
    gtao.updateGtaoMaterial({ radius: config.ao.radius, distanceExponent: config.ao.distanceExponent, thickness: config.ao.thickness, scale: config.ao.scale, samples: config.ao.samples, distanceFallOff: 1, screenSpaceRadius: false } as AoParams);
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: config.ao.denoiseSamples } as PdParams);
    composer.addPass(gtao);
  }

  let bloom: UnrealBloomPass | null = null;
  if (config.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(Math.round(w * ratio), Math.round(h * ratio)), options.params.bloomStrength, options.params.bloomRadius, options.params.bloomThreshold);
    composer.addPass(bloom);
  }

  const output = new OutputPass();
  composer.addPass(output);

  let fxaa: ShaderPass | null = null;
  if (config.fxaa) {
    fxaa = new ShaderPass(FXAAShader);
    composer.addPass(fxaa);
  }

  // Último paso siempre presente: fija la opacidad en 1. La oclusión ambiental mezcla por multiplicación y en algunos
  // equipos deja el alfa por debajo de 1, y el canvas se veía "transparente" sobre el fondo de la página.
  const finish = new ShaderPass(FINISH_SHADER);
  composer.addPass(finish);

  const setFxaaResolution = (pw: number, ph: number) => {
    const res = fxaa?.uniforms["resolution"]?.value as THREE.Vector2 | undefined;
    res?.set(1 / Math.max(1, pw), 1 / Math.max(1, ph));
  };
  setFxaaResolution(w * ratio, h * ratio);

  let disposed = false;
  const pipeline: Pipeline = {
    setParams(p) {
      if (gtao) gtao.blendIntensity = p.aoIntensity;
      if (bloom) {
        bloom.strength = p.bloomStrength;
        bloom.radius = p.bloomRadius;
        bloom.threshold = p.bloomThreshold;
      }
      finish.uniforms["vignette"]!.value = config.cine ? p.vignette : 0;
      finish.uniforms["saturation"]!.value = config.cine ? p.saturation : 1;
      finish.uniforms["contrast"]!.value = config.cine ? p.contrast : 1;
    },
    resize(width, height, pixelRatio) {
      const r = Math.max(0.5, pixelRatio);
      composer.setPixelRatio(r);
      composer.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
      setFxaaResolution(width * r, height * r);
    },
    render(delta, camera) {
      if (disposed) return;
      renderPass.camera = camera;
      if (gtao) {
        gtao.camera = camera;
        // La oclusión ambiental está calculada para cámara en perspectiva; la planta (cenital, ortogonal) se dibuja sin ella.
        gtao.enabled = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
        const dbg = (globalThis as { __AO_OUT?: number }).__AO_OUT; if (dbg !== undefined) gtao.output = dbg;
      }
      composer.render(delta);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pass of [renderPass, gtao, bloom, output, fxaa, finish]) pass?.dispose();
      composer.dispose();
      target?.dispose();
    },
  };
  pipeline.setParams(options.params);
  return pipeline;
}

/**
 * Dibuja un solo cuadro con la cadena completa a `size` px (para la captura 4K). Arma una cadena aparte, la usa y la libera:
 * así el visor en pantalla no mantiene buffers de 4K en memoria. Sin MSAA (en 4K cuesta demasiada memoria de video);
 * en su lugar usa FXAA, que a esa resolución alcanza.
 */
export function renderOnce(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, size: { width: number; height: number }, config: PipelineConfig, params: FxParams): void {
  const pipeline = createPipeline({ gl, scene, camera, width: size.width, height: size.height, pixelRatio: 1, config: { ...config, msaa: 0, fxaa: config.fxaa || config.msaa > 0 }, params });
  try {
    pipeline.render(1 / 60, camera);
  } finally {
    pipeline.dispose();
  }
}

/** `true` si el cuadro que acaba de dibujarse en el canvas está completamente negro (la postproducción no funciona en este equipo). */
export function frameIsBlank(gl: THREE.WebGLRenderer): boolean {
  try {
    const ctx = gl.getContext();
    gl.setRenderTarget(null);
    const px = new Uint8Array(4), all: number[] = [];
    for (const p of samplePoints(ctx.drawingBufferWidth, ctx.drawingBufferHeight)) {
      ctx.readPixels(p.x, p.y, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      all.push(px[0] ?? 0, px[1] ?? 0, px[2] ?? 0, px[3] ?? 0);
    }
    return looksBlank(all);
  } catch {
    return false;
  }
}
