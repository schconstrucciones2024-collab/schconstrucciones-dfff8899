import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { skyClock } from "@/store/useEntorno";
import { skyAt } from "@/lib/skyModel";
import { DOME_FRAGMENT, DOME_VERTEX } from "./Entorno";

/**
 * Reflejos del cielo real. En lugar de un entorno fijo, calcula con PMREM lo que "ve" la casa a su alrededor: el mismo
 * cielo del visor (degradé, sol, luna y estrellas) a la hora que se está mostrando. Vidrios, chapa y siding reflejan
 * ese cielo y la luz ambiente cambia con la hora, también durante la transición día/noche.
 *
 * Si algo falla, lanza el error para que `SafeBoundary` ponga el entorno fijo de antes (ver `Viewer3D`).
 */

/** El cielo "se ve" más oscuro como fuente de luz que los paneles fijos de antes: este factor lo compensa. Se ajusta mirando el visor. */
export const SKY_ENV_GAIN = 1.4;
/** Cada cuánto, como máximo, se recalculan los reflejos mientras cambia la hora (milisegundos). */
const REFRESH_MS = 180;
/** Cambio mínimo de hora que justifica recalcularlos. */
const REFRESH_HOURS = 0.08;

const ENV_FRAGMENT = "uniform float envGain;\n" + DOME_FRAGMENT.replace("gl_FragColor = vec4(col, 1.0);", "gl_FragColor = vec4(col * envGain, 1.0);");

type FromScene = (scene: THREE.Scene, sigma: number, near: number, far: number, options?: { size?: number }) => THREE.WebGLRenderTarget;

export function SkyReflections({ resolution = 256 }: { resolution?: 256 | 512 }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const [failed, setFailed] = useState(false);
  if (failed) throw new Error("No se pudieron calcular los reflejos del cielo.");

  const rig = useMemo(() => {
    const uniforms = {
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      moonDir: { value: new THREE.Vector3(0, -1, 0) },
      stars: { value: 0 },
      day: { value: 1 },
      envGain: { value: SKY_ENV_GAIN },
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: DOME_VERTEX, fragmentShader: ENV_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false });
    const geometry = new THREE.SphereGeometry(10, 32, 16);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    const envScene = new THREE.Scene();
    envScene.add(mesh);
    return { uniforms, material, geometry, envScene, pmrem: new THREE.PMREMGenerator(gl), target: null as THREE.WebGLRenderTarget | null, hour: Number.NaN, at: 0 };
    // Al cambiar la resolución se arma todo de nuevo: el generador anterior se libera en la limpieza del efecto de abajo.
  }, [gl, resolution]);

  const refresh = useRef<(hour: number) => void>(() => {});
  refresh.current = (hour: number) => {
    const s = skyAt(hour), u = rig.uniforms;
    u.zenith.value.set(s.zenith);
    u.horizon.value.set(s.horizon);
    u.sunDir.value.set(s.sunDir[0], s.sunDir[1], s.sunDir[2]);
    u.moonDir.value.set(s.moonDir[0], s.moonDir[1], s.moonDir[2]);
    u.stars.value = s.stars;
    u.day.value = s.day;
    const next = (rig.pmrem as unknown as { fromScene: FromScene }).fromScene(rig.envScene, 0, 0.1, 100, { size: resolution });
    const previous = rig.target;
    rig.target = next;
    scene.environment = next.texture;
    previous?.dispose();
    rig.hour = hour;
    rig.at = performance.now();
    invalidate();
  };

  useEffect(() => {
    try {
      refresh.current(skyClock.hour);
    } catch (error) {
      console.warn("[render] Reflejos del cielo:", error);
      setFailed(true);
    }
    return () => {
      if (rig.target && scene.environment === rig.target.texture) scene.environment = null;
      rig.target?.dispose();
      rig.target = null;
      rig.pmrem.dispose();
      rig.material.dispose();
      rig.geometry.dispose();
    };
  }, [rig, scene]);

  useFrame(() => {
    const hour = skyClock.hour;
    if (Number.isFinite(rig.hour) && Math.abs(hour - rig.hour) < REFRESH_HOURS) return;
    if (performance.now() - rig.at < REFRESH_MS) return;
    try {
      refresh.current(hour);
    } catch (error) {
      console.warn("[render] Reflejos del cielo:", error);
      setFailed(true);
    }
  });

  return null;
}
