import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { floorBase, useConfigurator } from "@/store/useConfigurator";
import { sceneGlow, skyClock, useEntorno } from "@/store/useEntorno";
import { lerpHex, skyAt, transitionHour } from "@/lib/skyModel";
import { canPlaceTree, toWorld, treeInfo, type Tree, type TreeKind } from "@/lib/vegetation";
import type { ScenePalette } from "./House";
import { useHouseVolume } from "./useHouseVolume";

/**
 * Entorno 3D del visor: cielo (domo con sol, luna y estrellas), nubes, luces que siguen la hora del día,
 * ventanas encendidas de noche y vegetación interactiva. La lógica (colores, horas, reglas) está en
 * `src/lib/skyModel.ts`, `vegetation.ts` y `cameraViews.ts`, que se prueban sin WebGL.
 */

/** Si algo del entorno falla al dibujarse, el visor sigue mostrando la casa con la versión simple. */
export class SafeBoundary extends Component<{ children: ReactNode; fallback: ReactNode; label: string }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn(`[entorno] ${this.props.label} no se pudo dibujar; se usa la versión simple.`, error);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Luces y fondo de antes (fijos). Se usan solo si la atmósfera nueva falla. */
export function StaticLights({ palette, low }: { palette: ScenePalette; low: boolean }) {
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, 35, 90]} />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[-12, 18, 10]}
        intensity={2.5}
        castShadow={!low}
        shadow-mapSize={[2048, 2048]}
        shadow-normalBias={0.02}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0003}
      />
    </>
  );
}

const DURATION = 2.4;
/** Los reflejos del cielo (`Reflections.tsx`) usan el mismo domo para calcular lo que se refleja en vidrios y superficies. */
export const DOME_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const DOME_FRAGMENT = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunDir;
uniform vec3 moonDir;
uniform float stars;
uniform float day;
varying vec3 vDir;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main() {
  vec3 d = normalize(vDir);
  float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
  vec3 col = mix(horizon, zenith, t);
  float s = max(dot(d, normalize(sunDir)), 0.0);
  vec3 sunCol = mix(vec3(1.0, 0.82, 0.55), vec3(1.0, 0.97, 0.9), day);
  col += sunCol * (pow(s, 700.0) * 1.8 + pow(s, 9.0) * 0.22 + pow(s, 3.0) * 0.1) * smoothstep(-0.12, 0.12, sunDir.y);
  float m = max(dot(d, normalize(moonDir)), 0.0);
  col += vec3(0.85, 0.9, 1.0) * (pow(m, 1800.0) * 1.3 + pow(m, 40.0) * 0.1) * (1.0 - day) * smoothstep(-0.05, 0.2, moonDir.y);
  float star = step(0.9965, hash(floor(d * 220.0))) * stars * smoothstep(0.03, 0.25, d.y);
  col += vec3(star);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const CLOUDS: { a: number; y: number; w: number }[] = Array.from({ length: 10 }, (_, i) => ({ a: i * 0.63 + 0.2, y: 30 + (i % 4) * 8, w: 70 + (i % 3) * 25 }));

/** Cielo y luces que siguen la hora del día, con transición progresiva. Reemplaza a las luces fijas de antes. */
export function Atmosphere({ low, active, shadowSize = 2048 }: { low: boolean; active: boolean; shadowSize?: number }) {
  const { scene, gl, invalidate } = useThree();
  const c = useConfigurator((s) => s.config);
  const clouds = useEntorno((s) => s.clouds);
  const animateSky = useEntorno((s) => s.animateSky);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const dome = useRef<THREE.Mesh>(null);
  const cloudGroup = useRef<THREE.Group>(null);
  const hour0 = useEntorno.getState().hour;
  const run = useRef({ shown: hour0, from: hour0, to: hour0, t: 0, active: false, key: "", reduced: false, drift: false });

  const bg = useMemo(() => new THREE.Color(), []);
  const fog = useMemo(() => new THREE.Fog("#ffffff", 35, 90), []);
  const uniforms = useMemo(
    () => ({ zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, stars: { value: 0 }, day: { value: 1 } }),
    [],
  );
  const domeMaterial = useMemo(
    () => new THREE.ShaderMaterial({ uniforms, vertexShader: DOME_VERTEX, fragmentShader: DOME_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false }),
    [uniforms],
  );
  const cloudTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const puffs: [number, number, number][] = [[70, 56, 38], [110, 44, 46], [150, 52, 42], [185, 60, 30], [95, 62, 34], [135, 64, 36], [45, 64, 24]];
      for (const [x, y, r] of puffs) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(255,255,255,0.85)");
        g.addColorStop(0.55, "rgba(255,255,255,0.35)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 96);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  const cloudMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }), [cloudTexture]);
  useEffect(() => () => { domeMaterial.dispose(); cloudMaterial.dispose(); cloudTexture.dispose(); }, [domeMaterial, cloudMaterial, cloudTexture]);

  const applySky = (hour: number) => {
    const e = useEntorno.getState(), s = skyAt(hour);
    skyClock.hour = hour;
    bg.set(s.horizon);
    scene.background = bg;
    fog.color.set(s.fog);
    fog.near = s.fogNear;
    fog.far = s.fogFar;
    scene.fog = fog;
    if (ambient.current) { ambient.current.color.set(s.ambient); ambient.current.intensity = s.ambientI; }
    if (sun.current) { sun.current.color.set(s.light); sun.current.intensity = s.lightI; sun.current.position.set(s.lightPos[0], s.lightPos[1], s.lightPos[2]); }
    gl.toneMappingExposure = s.exposure * e.exposure;
    scene.environmentIntensity = s.env;
    sceneGlow.level = s.glow * (e.houseLights ? 1 : 0);
    if (lamp.current) lamp.current.intensity = sceneGlow.level * 14;
    uniforms.zenith.value.set(s.zenith);
    uniforms.horizon.value.set(s.horizon);
    uniforms.sunDir.value.set(s.sunDir[0], s.sunDir[1], s.sunDir[2]);
    uniforms.moonDir.value.set(s.moonDir[0], s.moonDir[1], s.moonDir[2]);
    uniforms.stars.value = s.stars;
    uniforms.day.value = s.day;
    cloudMaterial.color.set(lerpHex(lerpHex("#2a3350", "#ffffff", s.day), s.horizon, 0.3));
    cloudMaterial.opacity = 0.5 + 0.35 * s.day;
  };

  useEffect(() => {
    run.current.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    run.current.key = "";
    invalidate();
    // Cualquier cambio del entorno (hora, luces, árboles…) pide un cuadro nuevo; el visor dibuja solo cuando hace falta.
    return useEntorno.subscribe(() => invalidate());
  }, [invalidate]);

  // Un mapa de sombras más grande (calidad Ultra) o más chico (Económico) solo se aplica si se descarta el anterior.
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
    invalidate();
  }, [shadowSize, invalidate]);

  const drift = animateSky && clouds && !low && active;
  useEffect(() => {
    run.current.drift = drift && !run.current.reduced;
    if (!run.current.drift) return;
    const id = window.setInterval(() => invalidate(), 1000 / 15);
    return () => window.clearInterval(id);
  }, [drift, invalidate]);

  useFrame((state, delta) => {
    const e = useEntorno.getState(), r = run.current, dt = Math.min(delta, 0.1);
    if (e.hour !== r.to) {
      r.from = r.shown;
      r.to = e.hour;
      r.t = 0;
      r.active = e.animate && !r.reduced;
      if (!r.active) r.shown = e.hour;
    }
    if (r.active) {
      r.t += dt;
      r.shown = transitionHour(r.from, r.to, r.t, DURATION);
      if (r.t >= DURATION) { r.shown = r.to; r.active = false; }
    }
    const key = `${r.shown.toFixed(4)}|${e.exposure}|${e.houseLights}`;
    if (key !== r.key) { r.key = key; applySky(r.shown); }
    if (dome.current) dome.current.position.copy(state.camera.position);
    if (r.drift && cloudGroup.current) cloudGroup.current.rotation.y += dt * 0.006;
    if (r.active) invalidate();
  });

  const home = useMemo(() => {
    const xs = c.contour.map((p) => p.x), zs = c.contour.map((p) => p.z);
    const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
    return toWorld(mid, c);
  }, [c.contour, c.position, c.rotation]);

  return (
    <>
      <ambientLight ref={ambient} intensity={0.7} />
      <directionalLight
        ref={sun}
        position={[-12, 18, 10]}
        intensity={2.5}
        castShadow={!low}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-normalBias={0.02}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0003}
      />
      <pointLight ref={lamp} position={[home.x, floorBase(c) + 1.9, home.z]} color="#ffcf86" intensity={0} distance={16} decay={2} />
      <mesh ref={dome} material={domeMaterial} renderOrder={-2} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[150, 32, 16]} />
      </mesh>
      {clouds && (
        <group ref={cloudGroup}>
          {CLOUDS.map((k, i) => (
            <mesh key={i} material={cloudMaterial} position={[Math.sin(k.a) * 95, k.y, Math.cos(k.a) * 95]} rotation-y={k.a + Math.PI} renderOrder={-1} raycast={() => null}>
              <planeGeometry args={[k.w, k.w * 0.38]} />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- vegetación */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Pinta los vértices de la pieza con un degradado vertical (más oscuro abajo) y la deja sin índices para poder unirla. */
function paint(g: THREE.BufferGeometry, hex: string, y0: number, y1: number): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  const pos = out.getAttribute("position");
  const base = new THREE.Color(hex), arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.74 + 0.26 * clamp01((pos.getY(i) - y0) / Math.max(0.001, y1 - y0));
    arr[i * 3] = base.r * k;
    arr[i * 3 + 1] = base.g * k;
    arr[i * 3 + 2] = base.b * k;
  }
  out.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return out;
}
const move = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);

function buildTree(kind: TreeKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === "pino") {
    parts.push(paint(move(new THREE.CylinderGeometry(0.12, 0.2, 2.4, 7), 0, 1.2, 0), "#5b4129", 0, 2.4));
    ([[1.55, 2.6, 3.0], [1.2, 2.3, 4.5], [0.85, 1.9, 5.9]] as const).forEach(([r, h, y]) => parts.push(paint(move(new THREE.ConeGeometry(r, h, 8), 0, y, 0), "#2f5a34", y - h / 2, y + h / 2)));
  } else if (kind === "eucalipto") {
    parts.push(paint(move(new THREE.CylinderGeometry(0.14, 0.26, 5.2, 7), 0, 2.6, 0), "#8a8575", 0, 5.2));
    ([[1.55, 0, 6.4, 0], [1.2, 0.8, 5.5, 0.3], [1.1, -0.7, 7.5, -0.2]] as const).forEach(([r, x, y, z]) => parts.push(paint(move(new THREE.IcosahedronGeometry(r, 1), x, y, z), "#6f8a62", y - r, y + r)));
  } else if (kind === "palmera") {
    parts.push(paint(move(new THREE.CylinderGeometry(0.14, 0.22, 4.3, 7), 0, 2.15, 0), "#7a6a54", 0, 4.3));
    for (let i = 0; i < 8; i++) {
      const f = new THREE.ConeGeometry(0.24, 2.5, 4);
      f.translate(0, 1.25, 0);
      f.rotateZ(-1.15);
      f.rotateY((i * Math.PI) / 4);
      f.translate(0, 4.3, 0);
      parts.push(paint(f, "#4f7a3a", 3.4, 5.4));
    }
  } else {
    ([[0.62, 0, 0.55, 0], [0.5, 0.55, 0.42, 0.2], [0.45, -0.5, 0.4, -0.2]] as const).forEach(([r, x, y, z]) => parts.push(paint(move(new THREE.IcosahedronGeometry(r, 1), x, y, z), "#4d7340", 0, 1.2)));
  }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.BufferGeometry();
}

/** Árboles, arbustos y palmeras. El árbol seleccionado se muestra con un aro y se puede arrastrar. */
export function Trees({ low, palette }: { low: boolean; palette: ScenePalette }) {
  const trees = useEntorno((s) => s.trees);
  const show = useEntorno((s) => s.showVegetation);
  const selected = useEntorno((s) => s.selectedTree);
  const placing = useEntorno((s) => s.placing);
  const geometries = useMemo(() => {
    const m = {} as Record<TreeKind, THREE.BufferGeometry>;
    (["pino", "eucalipto", "palmera", "arbusto"] as const).forEach((k) => { m[k] = buildTree(k); });
    return m;
  }, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }), []);
  useEffect(() => () => { Object.values(geometries).forEach((g) => g.dispose()); material.dispose(); }, [geometries, material]);
  if (!show) return null;
  return (
    <group>
      {trees.map((t: Tree) => (
        <group key={t.id} position={[t.x, 0, t.z]} rotation-y={t.rot} scale={t.scale}>
          <mesh
            geometry={geometries[t.kind]}
            material={material}
            castShadow={!low}
            receiveShadow
            onPointerDown={(e) => {
              if (placing) return;
              e.stopPropagation();
              const st = useEntorno.getState();
              if (st.selectedTree === t.id) st.setMoving(t.id);
              else st.selectTree(t.id);
            }}
          />
          {selected === t.id && (
            <mesh rotation-x={-Math.PI / 2} position-y={0.05} raycast={() => null}>
              <ringGeometry args={[treeInfo(t.kind).radius * 0.8, treeInfo(t.kind).radius * 0.8 + 0.16, 40]} />
              <meshBasicMaterial color={palette.accent} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * Plantar y mover vegetación sobre el terreno. Usa un rayo desde la cámara hasta el plano del suelo, así que funciona
 * aunque la casa u otros objetos queden en el medio. Un toque corto planta; arrastrar sigue orbitando la cámara.
 */
export function TreeInteraction({ palette }: { palette: ScenePalette }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const placing = useEntorno((s) => s.placing);
  const moving = useEntorno((s) => s.movingTree);
  const house = useHouseVolume();
  const [ghost, setGhost] = useState<{ x: number; z: number; ok: boolean } | null>(null);
  const houseRef = useRef(house);
  houseRef.current = house;

  useEffect(() => {
    if (!placing && !moving) { setGhost(null); return; }
    const el = gl.domElement, ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3(), ndc = new THREE.Vector2();
    let down: { x: number; y: number; t: number } | null = null;
    const ground = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, get().camera);
      return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null;
    };
    const onMove = (ev: PointerEvent) => {
      const p = ground(ev);
      if (!p) return;
      const st = useEntorno.getState();
      if (moving) {
        const kind = st.trees.find((t) => t.id === moving)?.kind;
        if (kind) {
          const ok = canPlaceTree(st.trees, p, kind, houseRef.current, moving).ok;
          setGhost({ ...p, ok });
          if (ok) st.move(moving, p, houseRef.current);
        }
      } else if (placing) {
        setGhost({ ...p, ok: canPlaceTree(st.trees, p, placing, houseRef.current).ok });
      }
      invalidate();
    };
    const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; };
    const onUp = (ev: PointerEvent) => {
      const st = useEntorno.getState();
      if (moving) { st.setMoving(null); setGhost(null); return; }
      const d = down; down = null;
      if (!placing || !d || ev.button !== 0) return;
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
      const p = ground(ev);
      if (p) st.plant(p, houseRef.current);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, get, invalidate, placing, moving]);

  if (!ghost || !(placing || moving)) return null;
  const kind = placing ?? useEntorno.getState().trees.find((t) => t.id === moving)?.kind ?? "pino";
  const r = treeInfo(kind).radius;
  return (
    <mesh position={[ghost.x, 0.06, ghost.z]} rotation-x={-Math.PI / 2} raycast={() => null}>
      <ringGeometry args={[r * 0.7, r * 0.7 + 0.18, 40]} />
      <meshBasicMaterial color={ghost.ok ? palette.accent : palette.invalid} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
