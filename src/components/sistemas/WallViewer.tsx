import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, useCursor } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { WALL_MATERIAL_BASE, type SystemId, type WallMaterialKind } from "@/config/wallSystems";
import { loadPBR, pbrProps } from "@/components/configurator/pbr";
import { watchViewerContext } from "@/components/configurator/viewerLifecycle";
import { solidFromSpec, type Solid, type SolidSpec, type Vec3 } from "@/lib/wallGeometry";
import { buildWall, explodedBounds, type ModelLayer, type Part, type WallModel } from "@/lib/wallModel";
import { VIEW_POSES, cameraPosition, clampDistance, fitDistance, shortestAngle } from "@/lib/wallCamera";
import type { ViewId } from "@/lib/wallState";

/**
 * Visor 3D de las paredes del apartado "Sistemas constructivos".
 * Todo lo que se dibuja sale del modelo de `src/lib/wallModel.ts` (el mismo que se prueba): cada pieza es una instancia
 * de una malla compartida, con mapas PBR reales (color, normal, rugosidad y oclusión) de `public/textures/`.
 * El lienzo dibuja solo cuando algo cambia (`frameloop="demand"`), así que en reposo no consume GPU.
 */

const ACCENT = "#c8a15a";

export type WallViewerProps = {
  system: SystemId;
  optionsA: Record<string, string>;
  /** Pared B (solo al comparar). */
  optionsB: Record<string, string> | null;
  hidden: string[];
  selected: string | null;
  /** 0 = armada, 1 = totalmente explotada. */
  explode: number;
  view: ViewId;
  /** Cambia cada vez que se pide volver a encuadrar (restaurar). */
  resetKey: number;
  /** Cada cambio de `n` pide acercar o alejar la cámara multiplicando la distancia por `factor`. */
  zoom: { n: number; factor: number };
  /** true = el 3D no responde a gestos (para no atrapar el scroll de la página en pantallas táctiles). */
  locked: boolean;
  onSelect: (id: string | null) => void;
  onFail: () => void;
};

function toGeometry(s: Solid): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(s.positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(s.normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(s.uvs, 2));
  g.setIndex(s.indices);
  g.computeBoundingSphere();
  return g;
}

/** Mapas PBR reales del material; hasta que llegan (o si no se pueden cargar) devuelve `undefined` y se usa el color base. */
function useWallTexture(kind: WallMaterialKind, low: boolean): THREE.Texture | undefined {
  const [state, setState] = useState<{ kind: WallMaterialKind; map: THREE.Texture } | null>(null);
  useEffect(() => {
    if (kind === "acero") return;
    let alive = true;
    const handle = loadPBR(kind, low);
    handle.promise.then((map) => { if (alive) setState({ kind, map }); }).catch(() => undefined);
    return () => {
      alive = false;
      handle.release();
      setState((cur) => (cur && cur.kind === kind ? null : cur));
    };
  }, [kind, low]);
  return state && state.kind === kind ? state.map : undefined;
}

const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

function WallMaterial({ kind, low, opacity, ns, emissive }: { kind: WallMaterialKind; low: boolean; opacity: number; ns: number; emissive: number }) {
  const map = useWallTexture(kind, low);
  const common = { emissive: ACCENT, emissiveIntensity: emissive, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 } as const;
  if (kind === "acero") return <meshStandardMaterial color="#8c9198" metalness={0.9} roughness={0.34} {...common} />;
  if (!map) return <meshStandardMaterial key="color" color={rgb(WALL_MATERIAL_BASE[kind])} roughness={0.9} {...common} />;
  return <meshStandardMaterial key="texture" map={map} {...pbrProps(map)} roughness={1} normalScale={[ns, ns]} {...common} />;
}

type MeshProps = {
  spec: SolidSpec;
  parts: Part[];
  pivot: Vec3;
  layerId: string;
  kind: WallMaterialKind;
  opacity: number;
  ns: number;
  emissive: number;
  low: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

function PartMesh({ spec, parts, pivot, layerId, kind, opacity, ns, emissive, low, onSelect, onHover }: MeshProps) {
  const specKey = JSON.stringify(spec);
  const geometry = useMemo(() => toGeometry(solidFromSpec(spec)), [specKey]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    parts.forEach((p, i) => {
      dummy.position.set(p.pos[0] - pivot[0], p.pos[1] - pivot[1], p.pos[2] - pivot[2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      color.setScalar(0.93 + p.tint * 0.14);
      m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [parts, pivot, geometry, invalidate]);
  return (
    <instancedMesh
      key={`${geometry.uuid}:${parts.length}`}
      ref={mesh}
      args={[geometry, undefined, parts.length]}
      castShadow={!low && opacity >= 1}
      receiveShadow={!low}
      renderOrder={opacity < 1 ? 2 : 0}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 4) return; // fue un arrastre para girar, no un clic
        e.stopPropagation();
        onSelect(layerId);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(layerId); }}
      onPointerOut={() => onHover(null)}
    >
      <WallMaterial kind={kind} low={low} opacity={opacity} ns={ns} emissive={emissive} />
    </instancedMesh>
  );
}

/** Piezas de una capa que comparten el mismo desplazamiento extra al explotar (p. ej. cada columna del encadenado vertical). */
function partitionByEx(parts: Part[]): { ex: Vec3; parts: Part[] }[] {
  const map = new Map<string, { ex: Vec3; parts: Part[] }>();
  for (const p of parts) {
    const ex: Vec3 = p.ex ?? [0, 0, 0];
    const key = ex.join(",");
    const hit = map.get(key);
    if (hit) hit.parts.push(p);
    else map.set(key, { ex, parts: [p] });
  }
  return [...map.values()];
}

type LayerProps = {
  layer: ModelLayer;
  origin: Vec3;
  hiddenByUser: boolean;
  selected: boolean;
  hovered: boolean;
  explode: number;
  /** true si la capa aparece después de armada la escena (crece desde su centro). */
  enter: boolean;
  reduced: boolean;
  low: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

function LayerGroup(p: LayerProps) {
  const { layer } = p;
  const group = useRef<THREE.Group>(null);
  const subs = useRef<(THREE.Group | null)[]>([]);
  const cur = useRef({ e: p.explode, pr: p.enter && !p.reduced ? 0 : p.hiddenByUser ? 0 : 1 });
  const { invalidate } = useThree();
  const partitions = useMemo(() => partitionByEx(layer.parts), [layer]);
  const meshGroups = useMemo(
    () => partitions.map((part) => {
      const by = new Map<string, { spec: SolidSpec; parts: Part[]; kind: WallMaterialKind; opacity: number; ns: number }>();
      for (const q of part.parts) {
        const opacity = q.opacity ?? 1, ns = q.ns ?? 1;
        const key = `${q.material}|${JSON.stringify(q.spec)}|${opacity}|${ns}`;
        const hit = by.get(key);
        if (hit) hit.parts.push(q);
        else by.set(key, { spec: q.spec, parts: [q], kind: q.material, opacity, ns });
      }
      return [...by.entries()].map(([key, v]) => ({ key, ...v }));
    }),
    [partitions],
  );

  const place = () => {
    const g = group.current;
    if (!g) return;
    const c = cur.current;
    const pr = smooth(Math.min(1, Math.max(0, c.pr)));
    g.position.set(
      p.origin[0] + layer.pivot[0] + layer.explode[0] * c.e,
      p.origin[1] + layer.pivot[1] + layer.explode[1] * c.e,
      p.origin[2] + layer.pivot[2] + layer.explode[2] * c.e,
    );
    g.scale.setScalar(Math.max(pr, 0.0001));
    g.visible = pr > 0.003;
    partitions.forEach((part, i) => subs.current[i]?.position.set(part.ex[0] * c.e, part.ex[1] * c.e, part.ex[2] * c.e));
  };

  useLayoutEffect(() => { place(); invalidate(); });
  useFrame((_, dt) => {
    const c = cur.current;
    const targetPr = p.hiddenByUser ? 0 : 1;
    if (Math.abs(c.e - p.explode) < 4e-4 && Math.abs(c.pr - targetPr) < 4e-4) {
      if (c.e !== p.explode || c.pr !== targetPr) { c.e = p.explode; c.pr = targetPr; place(); }
      return;
    }
    const k = p.reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 7);
    c.e += (p.explode - c.e) * k;
    c.pr += (targetPr - c.pr) * (p.reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 6));
    place();
    invalidate();
  });
  useEffect(() => { invalidate(); }, [p.explode, p.hiddenByUser, p.origin, invalidate]);

  const emissive = p.selected ? 0.3 : p.hovered ? 0.14 : 0;
  return (
    <group ref={group}>
      {partitions.map((part, i) => (
        <group key={part.ex.join(",")} ref={(el) => { subs.current[i] = el; }}>
          {meshGroups[i]!.map((mg) => (
            <PartMesh
              key={mg.key}
              spec={mg.spec}
              parts={mg.parts}
              pivot={layer.pivot}
              layerId={layer.id}
              kind={mg.kind}
              opacity={mg.opacity}
              ns={mg.ns}
              emissive={emissive}
              low={p.low}
              onSelect={p.onSelect}
              onHover={p.onHover}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

const variantKey = (layer: ModelLayer) => `${layer.id}:${layer.parts[0]?.material}:${layer.parts[0]?.spec.k}:${layer.parts.length}`;

function Wall({ model, origin, hidden, selected, hovered, explode, entered, reduced, low, onSelect, onHover }: {
  model: WallModel; origin: Vec3; hidden: string[]; selected: string | null; hovered: string | null; explode: number; entered: boolean; reduced: boolean; low: boolean;
  onSelect: (id: string) => void; onHover: (id: string | null) => void;
}) {
  return (
    <>
      {model.layers.map((layer) => (
        <LayerGroup
          key={`${model.system}:${variantKey(layer)}`}
          layer={layer}
          origin={origin}
          hiddenByUser={hidden.includes(layer.id)}
          selected={selected === layer.id}
          hovered={hovered === layer.id}
          explode={explode}
          enter={entered}
          reduced={reduced}
          low={low}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </>
  );
}

type Frame = { radius: (e: number) => number; cy: number; key: string };

function CameraRig({ view, resetKey, zoom, explode, frame, reduced, locked }: { view: ViewId; resetKey: number; zoom: { n: number; factor: number }; explode: number; frame: Frame; reduced: boolean; locked: boolean }) {
  const { camera, invalidate, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef({ az: VIEW_POSES.iso.az, el: VIEW_POSES.iso.el, dist: 8, moving: false });
  const last = useRef({ explode, zoomN: zoom.n });
  const tmp = useMemo(() => new THREE.Spherical(), []);
  const off = useMemo(() => new THREE.Vector3(), []);
  const zero = useMemo(() => new THREE.Vector3(), []);
  // El encuadre y el tamaño se leen desde referencias: cambiar una opción o redimensionar la ventana NO debe mover la cámara.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  // Vista nueva, restaurar o cambio de paredes: se vuelve a encuadrar.
  useEffect(() => {
    const g = goal.current;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    g.az = VIEW_POSES[view].az;
    g.el = VIEW_POSES[view].el;
    g.dist = fitDistance(frameRef.current.radius(last.current.explode), fov, sizeRef.current.width / Math.max(1, sizeRef.current.height));
    g.moving = true;
    controls.current?.target.set(0, frameRef.current.cy, 0);
    invalidate();
  }, [view, resetKey, frame.key, camera, invalidate]);

  // Al explotar o rearmar, la cámara se aleja o se acerca lo justo (sin perder el giro ni el zoom que puso la persona).
  useEffect(() => {
    const prev = last.current.explode;
    last.current.explode = explode;
    if (prev === explode) return;
    off.copy(camera.position).sub(controls.current?.target ?? zero);
    const s = tmp.setFromVector3(off);
    const g = goal.current;
    g.az = s.theta;
    g.el = Math.PI / 2 - s.phi;
    g.dist = clampDistance(s.radius * (frameRef.current.radius(explode) / frameRef.current.radius(prev)), 1.2, 16);
    g.moving = true;
    invalidate();
  }, [explode, camera, invalidate, off, tmp, zero]);

  useEffect(() => {
    if (last.current.zoomN === zoom.n) return;
    last.current.zoomN = zoom.n;
    off.copy(camera.position).sub(controls.current?.target ?? zero);
    const s = tmp.setFromVector3(off);
    const g = goal.current;
    g.az = s.theta;
    g.el = Math.PI / 2 - s.phi;
    g.dist = clampDistance(s.radius * zoom.factor, 1.2, 16);
    g.moving = true;
    invalidate();
  }, [zoom, camera, invalidate, off, tmp, zero]);

  // Si la persona toma la cámara, se cancela cualquier movimiento automático.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => { goal.current.moving = false; };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, []);

  useFrame((_, dt) => {
    const c = controls.current, g = goal.current;
    if (!c || !g.moving) return;
    off.copy(camera.position).sub(c.target);
    const s = tmp.setFromVector3(off);
    const curEl = Math.PI / 2 - s.phi;
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 6);
    const dAz = shortestAngle(s.theta, g.az), dEl = g.el - curEl, dDist = g.dist - s.radius;
    const az = s.theta + dAz * k, el = curEl + dEl * k, dist = s.radius + dDist * k;
    const p = cameraPosition([c.target.x, c.target.y, c.target.z], az, el, dist);
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(c.target);
    c.update();
    if (Math.abs(dAz) < 1e-3 && Math.abs(dEl) < 1e-3 && Math.abs(dDist) < 1e-3 * dist) g.moving = false;
    else invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!locked}
      enablePan={false}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.8}
      minDistance={1.2}
      maxDistance={16}
      minPolarAngle={0.03}
      maxPolarAngle={Math.PI / 2 - 0.03}
    />
  );
}

function Scene(props: WallViewerProps & { low: boolean; reduced: boolean }) {
  const { system, optionsA, optionsB, hidden, selected, explode, low, reduced, onSelect } = props;
  const keyA = JSON.stringify(optionsA), keyB = optionsB ? JSON.stringify(optionsB) : "";
  const models = useMemo(() => ({ a: buildWall(system, optionsA), b: optionsB ? buildWall(system, optionsB) : null }), [system, keyA, keyB]);
  const [hover, setHover] = useState<string | null>(null);
  useCursor(hover !== null);
  const entered = useRef(false);
  useEffect(() => { entered.current = true; }, []);
  const { invalidate, gl } = useThree();
  // Bloqueado: el dedo sobre el 3D sigue haciendo scroll en la página.
  useEffect(() => { gl.domElement.style.touchAction = props.locked ? "pan-y" : "none"; }, [gl, props.locked]);

  const layout = useMemo(() => {
    const width = models.a.max[0] - models.a.min[0];
    const dx = models.b ? width / 2 + 0.45 : 0;
    const originOf = (m: WallModel, side: -1 | 1): Vec3 => [side * dx - m.center[0], 0, -m.center[2]];
    return { a: originOf(models.a, -1), b: models.b ? originOf(models.b, 1) : null };
  }, [models]);

  const frame = useMemo<Frame>(() => {
    const walls = [{ m: models.a, o: layout.a }, ...(models.b && layout.b ? [{ m: models.b, o: layout.b }] : [])];
    const radius = (e: number) => {
      const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (const { m, o } of walls) {
        const b = explodedBounds(m, e);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, b.min[k]! + o[k]!); max[k] = Math.max(max[k]!, b.max[k]! + o[k]!); }
      }
      return 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 0.82;
    };
    return { radius, cy: (models.a.min[1] + models.a.max[1]) / 2, key: `${system}:${models.b ? "cmp" : "one"}` };
  }, [models, layout, system]);

  useEffect(() => { invalidate(); }, [hidden, selected, hover, models, invalidate]);

  const common = { hidden, selected, hovered: hover, explode, entered: entered.current, reduced, low, onSelect: (id: string) => onSelect(id), onHover: setHover };
  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight
        position={[4, 7, 5]}
        intensity={2.1}
        castShadow={!low}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-5, 4, -6]} intensity={0.9} />
      <Suspense fallback={null}>
        <Environment resolution={256}>
          <Lightformer position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} intensity={1.6} />
          <Lightformer color="#f3e6cf" position={[-10, 3, 2]} rotation-y={Math.PI / 2} scale={[20, 8, 1]} intensity={1.2} />
          <Lightformer color="#dfe8f2" position={[10, 3, -2]} rotation-y={-Math.PI / 2} scale={[20, 8, 1]} intensity={0.9} />
        </Environment>
      </Suspense>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.004} receiveShadow>
        <circleGeometry args={[8, 72]} />
        <meshStandardMaterial color="#cfc8b9" roughness={1} />
      </mesh>
      <Wall model={models.a} origin={layout.a} {...common} />
      {models.b && layout.b && <Wall model={models.b} origin={layout.b} {...common} />}
      <CameraRig view={props.view} resetKey={props.resetKey} zoom={props.zoom} explode={explode} frame={frame} reduced={reduced} locked={props.locked} />
    </>
  );
}

export default function WallViewer(props: WallViewerProps) {
  const low = useMemo(() => window.matchMedia("(max-width:767px)").matches, []);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  return (
    <Canvas
      frameloop="demand"
      shadows={!low}
      dpr={[1, low ? 1.5 : 1.75]}
      camera={{ position: [6, 3, 8], fov: 32, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        stop.current?.();
        stop.current = watchViewerContext(gl.domElement, props.onFail);
      }}
      fallback={<div className="p-8">El visor 3D no está disponible en este dispositivo. Los textos y las opciones de abajo siguen funcionando.</div>}
    >
      <Scene {...props} low={low} reduced={reduced} />
    </Canvas>
  );
}
