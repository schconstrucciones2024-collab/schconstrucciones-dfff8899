import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, OrthographicCamera } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import {
  Camera,
  Focus,
  Undo2,
  Redo2,
  Eye,
  Layers3,
  ScanLine,
  Route,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  Video,
  Square,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-sch-construcciones.png.asset.json";
import {
  floorBase,
  FLOOR_BASE,
  FLOOR_STEP,
  houseDimensions,
  useConfigurator,
  type ViewId,
} from "@/store/useConfigurator";
import { Ground, House, type ScenePalette } from "./House";
import { Atmosphere, SafeBoundary, StaticLights, TreeInteraction, Trees } from "./Entorno";
import { PostFX, type PostApi } from "./PostFX";
import { SkyReflections } from "./Reflections";
import { useEffectiveFx } from "./useEffectiveFx";
import { useHouseVolume } from "./useHouseVolume";
import { useEntorno } from "@/store/useEntorno";
import { useRenderFx } from "@/store/useRenderFx";
import { constrainCamera, presetPose } from "@/lib/cameraViews";
import { watchViewerContext } from './viewerLifecycle';
import { interiorCamera } from './interiorCamera';
import { TOUR_EXTERIOR_S, TOUR_INTERIOR_S, TOUR_TAIL_MS, exteriorOrbitPose, interiorSweepPose, type CameraPose } from './tour';
import {
  RECORD_LONG_SIDE,
  captureHiRes,
  downloadBlob,
  formatClock,
  loadLogo,
  mediaFileName,
  recordingSupport,
  startRecording,
  type RecorderHandle,
} from "@/lib/mediaCapture";

/** Entorno fijo de siempre (dos paneles de luz). Se usa en calidad Económico y si los reflejos del cielo fallan. */
function StaticEnvironment({ palette }: { palette: ScenePalette }) {
  return (
    <Suspense fallback={null}>
      <Environment resolution={256}>
        <Lightformer position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} intensity={2} />
        <Lightformer color={palette.sky} position={[-10, 3, 0]} rotation-y={Math.PI / 2} scale={[20, 8, 1]} intensity={1.5} />
      </Environment>
    </Suspense>
  );
}

/** Si la postproducción lanza un error al dibujarse, lo registra en el estado para que la barra lo explique y el visor siga con el render simple. */
function ReportPostFailure() {
  useEffect(() => {
    useRenderFx.getState().fail("la postproducción dejó de responder. Se usa el render simple.");
  }, []);
  return null;
}

function resolvePalette(): ScenePalette {
  const style = getComputedStyle(document.documentElement),
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const color = (token: string) => {
    if (!ctx) return "rgb(128,128,128)";
    ctx.fillStyle = style.getPropertyValue(token).trim();
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0]},${d[1]},${d[2]})`;
  };
  return {
    sky: color("--scene-sky"),
    trim: color("--scene-trim"),
    glass: color("--scene-glass"),
    light: color("--scene-light"),
    warm: color("--scene-warm"),
    fabric: color("--scene-fabric"),
    accent: color("--primary"),
    invalid: color("--destructive"),
  };
}
function CameraRig({ resetKey, dragging, onCamera, onControls }: { resetKey: number; dragging: boolean; onCamera:(camera:THREE.Camera)=>void; onControls:(controls:OrbitControlsImpl|null)=>void }) {
  const c = useConfigurator((s) => s.config),
    view = useConfigurator((s) => s.view),
    floor = useConfigurator((s) => s.activeFloor),
    under = useConfigurator((s) => s.underHouse);
  const { camera, invalidate, size } = useThree(),
    controls = useRef<OrbitControlsImpl>(null);
  const house = useHouseVolume(),
    presetN = useEntorno((s) => s.preset.n);
  useEffect(()=>onCamera(camera),[camera,onCamera]);
  useEffect(() => { onControls(controls.current); return () => onControls(null); }, [view, onControls]);
  const goal = useRef({
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    moving: false,
    tour: false,
    elapsed: 0,
    reduced: false,
    /** Segundos del barrido interior (-1 = inactivo) y vista general de la que parte. */
    sweepT: -1,
    sweepNext: false,
    base: { position: [0, 0, 0], target: [0, 0, 0] } as CameraPose,
  });
  useEffect(() => {
    const { width, depth } = houseDimensions(c),
      h = FLOOR_BASE + c.floors * FLOOR_STEP,
      extent = Math.max(width, depth, h),
      portrait = size.width < size.height ? 1.4 : 1;
    const g = goal.current;
    g.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    g.elapsed = 0;
    g.tour = view === "recorrido" && !g.reduced;
    if (view === "interior" || (view === "recorrido" && g.reduced)) {
      const overview = interiorCamera(c.contour, floorBase(c) + floor * FLOOR_STEP + 0.1, size.width / size.height);
      g.position.fromArray(overview.position);
      g.target.fromArray(overview.target);
    } else if (under) {
      g.position.set(extent * 0.95, 0.45, extent * 1.15 * portrait);
      g.target.set(0, 0.4, 0);
    } else {
      g.position.set(
        extent * 0.95 * portrait,
        h + extent * (view === "corte" ? 0.7 : 0.4),
        extent * 1.15 * portrait,
      );
      g.target.set(0, h * 0.42, 0);
    }
    g.position.x+=c.position.x;g.position.z+=c.position.z;g.target.x+=c.position.x;g.target.z+=c.position.z;
    g.base = { position: g.position.toArray() as CameraPose["position"], target: g.target.toArray() as CameraPose["target"] };
    g.sweepT = view === "interior" && g.sweepNext && !g.reduced ? 0 : -1;
    g.sweepNext = false;
    g.moving = true;
    invalidate();
  }, [c.m2, c.floors, c.shape, c.position.x, c.position.z,c.rotation,c.pileHeight,c.foundation, view, floor, under, resetKey, size.width, size.height, invalidate]);
  // Vistas predefinidas (frontal, lateral, aérea, fachada, encuadre automático): se aplican al pedirlas, una vez por pedido.
  useEffect(() => {
    const { preset, trees } = useEntorno.getState();
    if (!preset.id || presetN === 0) return;
    const g = goal.current,
      pose = presetPose(preset.id, house, size.width / Math.max(1, size.height), trees);
    g.position.fromArray(pose.position);
    g.target.fromArray(pose.target);
    g.tour = false;
    g.sweepT = -1;
    g.sweepNext = false;
    g.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    g.moving = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el pedido (presetN)
  }, [presetN]);
  useFrame((_, raw) => {
    const g = goal.current,
      ctrl = controls.current;
    if (!ctrl) return;
    const dt = Math.min(raw, 0.05);
    if (g.tour) {
      g.elapsed += raw;
      const { width, depth } = houseDimensions(c),
        h = FLOOR_BASE + c.floors * FLOOR_STEP,
        extent = Math.max(width, depth, h);
      if (g.elapsed < TOUR_EXTERIOR_S) {
        const pose = exteriorOrbitPose(g.elapsed, extent, h, c.position);
        g.position.fromArray(pose.position);
        g.target.fromArray(pose.target);
      } else {
        // Termina la vuelta exterior: pasa al interior y ahí hace un barrido suave.
        g.sweepNext = true;
        useConfigurator.getState().setView("interior");
        g.tour = false;
      }
      g.moving = true;
    }
    if (g.sweepT >= 0 && view === "interior") {
      g.sweepT += raw;
      if (g.sweepT >= TOUR_INTERIOR_S) g.sweepT = -1;
      else g.position.fromArray(interiorSweepPose(g.base, g.sweepT, TOUR_INTERIOR_S).position);
      g.moving = true;
      invalidate();
    }
    if (g.moving && view!=="planta") {
      const alpha = g.reduced ? 1 : 1 - Math.exp(-8 * dt);
      camera.position.lerp(g.position, alpha);
      ctrl.target.lerp(g.target, alpha);
      ctrl.update();
      g.moving =
        camera.position.distanceTo(g.position) > 0.015 || ctrl.target.distanceTo(g.target) > 0.015;
      invalidate();
    }
    if (g.tour) invalidate();
    // La cámara no atraviesa el suelo ni las paredes (en el interior solo queda por encima del piso activo).
    if (view !== "planta") {
      const fix = constrainCamera(
        camera.position.toArray() as [number, number, number],
        house,
        view === "interior" ? "interior" : under ? "under" : "exterior",
        floorBase(c) + floor * FLOOR_STEP,
      );
      if (fix.changed) {
        camera.position.set(fix.position[0], fix.position[1], fix.position[2]);
        invalidate();
      }
    }
  });
  const interior = view === "interior";
  if (view === "planta")
    return (
      <>
        <OrthographicCamera
          makeDefault
          position={[c.position.x, 60, c.position.z]}
          zoom={
            Math.min(size.width, size.height) /
            (Math.max(houseDimensions(c).width, houseDimensions(c).depth) + 4)
          }
          near={0.1}
          far={150}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <OrbitControls
          makeDefault
          enabled={!dragging}
          enableRotate={false}
          touches={{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}}
          minZoom={5}
          maxZoom={150}
          target={[c.position.x, 0, c.position.z]}
        />
      </>
    );
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!dragging}
      enableDamping
      dampingFactor={0.09}
      minDistance={interior ? 0.3 : 3}
      maxDistance={120}
      enableZoom
      maxPolarAngle={under ? Math.PI * 0.51 : Math.PI * 0.48}
      enablePan
      touches={{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN}}
      onStart={() => {
        goal.current.moving = false;
        goal.current.tour = false;
        goal.current.sweepT = -1;
        goal.current.sweepNext = false;
      }}
    />
  );
}
export default function Viewer3D({ onFail }: { onFail: () => void }) {
  const s = useConfigurator(),
    [palette, setPalette] = useState<ScenePalette | null>(null),
    [dragging, setDragging] = useState<string | null>(null),
    [resetKey, setResetKey] = useState(0),
    [busy, setBusy] = useState(false),
    [low, setLow] = useState(false),
    [recording, setRecording] = useState<{ since: number; tour: boolean } | null>(null),
    [clock, setClock] = useState(0),
    [note, setNote] = useState<string | null>(null),
    [canRecord, setCanRecord] = useState(false),
    [visible, setVisible] = useState(true);
  const movingTree = useEntorno((st) => st.movingTree);
  const fx = useEffectiveFx();
  const postOk = useRenderFx((st) => st.failed === null);
  const post = useRef<PostApi | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const houseVol = useHouseVolume();
  // Vegetación inicial (una sola vez) y, si la casa cambia de lugar o de tamaño, la aleja de las paredes.
  useEffect(() => {
    const st = useEntorno.getState();
    st.seed(houseVol);
    st.clear(houseVol);
  }, [houseVol]);
  const holder = useRef<HTMLDivElement>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null),
    scene = useRef<THREE.Scene | null>(null),
    camera = useRef<THREE.Camera | null>(null);
  const orbit = useRef<OrbitControlsImpl | null>(null);
  const recorder = useRef<RecorderHandle | null>(null),
    noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    logoRef = useRef<Promise<HTMLImageElement | null> | null>(null),
    tourSeen = useRef(false);
  /** Aviso breve de estado (captura / grabación); lo leen los lectores de pantalla. */
  const flash = useCallback((text: string | null, ms = 8000) => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNote(text);
    noteTimer.current = text ? setTimeout(() => setNote(null), ms) : null;
  }, []);
  const getLogo = () => {
    if (!logoRef.current) logoRef.current = loadLogo(logo.url).then((img) => { if (!img) logoRef.current = null; return img; });
    return logoRef.current;
  };
  const zoomView = (factor: number) => {
    const ctrl = orbit.current, cam = camera.current;
    if (!ctrl || !cam) return;
    const offset = cam.position.clone().sub(ctrl.target);
    const length = offset.length();
    if (length < 0.001) return;
    offset.multiplyScalar(Math.min(ctrl.maxDistance, Math.max(ctrl.minDistance, length * factor)) / length);
    cam.position.copy(ctrl.target).add(offset);
    ctrl.dispatchEvent({ type: 'start', target: ctrl });
    ctrl.update();
    ctrl.dispatchEvent({ type: 'change', target: ctrl });
  };
  const stopContextWatch = useRef<(() => void) | null>(null);
  useEffect(() => () => {
    stopContextWatch.current?.();
    stopContextWatch.current = null;
  }, []);
  // El cielo animado solo corre mientras el visor está en pantalla.
  useEffect(() => {
    const el = holder.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    setPalette(resolvePalette());
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    setLow(mobile || navigator.hardwareConcurrency <= 4);
    // Calidad de render inicial según el equipo (una sola vez por carga de la página; después manda lo que elija la persona).
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    useRenderFx.getState().init({ mobile, cores: navigator.hardwareConcurrency, memoryGB: nav.deviceMemory, saveData: nav.connection?.saveData === true });
    setCanRecord(recordingSupport().supported);
  }, []);
  useEffect(() => () => {
    recorder.current?.cancel();
    recorder.current = null;
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);
  useEffect(() => {
    const stop = () => setDragging(null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);
  /** Imagen PNG en 4K (lado mayor 3840 px) con el logo de SCH como marca de agua. */
  const capture = async () => {
    const gl = renderer.current,
      sc = scene.current,
      cam = camera.current;
    if (!gl || !sc || !cam || recorder.current) return;
    setBusy(true);
    flash("Generando imagen 4K…", 60000);
    try {
      // Un cuadro de respiro para que se vea el aviso antes del trabajo pesado.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      // Con efectos de render activos, la captura pasa por la misma cadena que el visor (si falla, sale sin efectos y se avisa).
      const withFx = post.current;
      let withoutFx = false;
      const shot = await captureHiRes({
        gl, scene: sc, camera: cam, logo: await getLogo(),
        ...(withFx
          ? {
              draw: (size: { width: number; height: number }) => {
                try { withFx.renderOnce(size); } catch (error) { console.warn("[render] La captura con efectos falló; se hace sin efectos.", error); withoutFx = true; gl.render(sc, cam); }
              },
              restored: () => invalidateRef.current?.(),
            }
          : {}),
      });
      downloadBlob(shot.blob, mediaFileName("imagen", shot.size, "png"));
      const px = `${shot.size.width} × ${shot.size.height} px`;
      flash(withoutFx ? `Imagen guardada (${px}) sin efectos de render: tu dispositivo no pudo aplicarlos en esa resolución.` : shot.is4K ? `Imagen 4K guardada (${px}).` : `Tu dispositivo no permite 4K: la imagen se guardó en ${px}.`);
    } catch {
      flash(null);
      s.setError("No pudimos descargar la imagen. Probá nuevamente.");
    } finally {
      setBusy(false);
    }
  };
  /** Termina la grabación y descarga el video. */
  const stopRecord = useCallback(async () => {
    const handle = recorder.current;
    if (!handle) return;
    recorder.current = null;
    setRecording(null);
    try {
      const result = await handle.stop();
      downloadBlob(result.blob, mediaFileName("recorrido", result.size, result.extension));
      flash(`Recorrido guardado: ${formatClock(result.durationMs)}, ${result.size.width} × ${result.size.height} px, ${result.extension.toUpperCase()}.`);
    } catch {
      flash(null);
      useConfigurator.getState().setError("No pudimos guardar el video. Probá nuevamente.");
    }
  }, [flash]);
  /**
   * Graba lo que se ve en el visor (con marca de agua). Si el sistema permite animaciones, arranca el recorrido automático
   * (vuelta exterior + barrido interior) y se detiene solo al terminar; si no, graba tu navegación hasta que toques Detener.
   */
  const startRecord = async () => {
    const gl = renderer.current;
    if (!gl || recorder.current || busy) return;
    try {
      const handle = startRecording({ source: gl.domElement, logo: await getLogo(), longSide: low ? 1280 : RECORD_LONG_SIDE, onLimit: () => void stopRecord() });
      recorder.current = handle;
      const tour = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tourSeen.current = false;
      setClock(0);
      setRecording({ since: performance.now(), tour });
      flash(tour ? "Grabando el recorrido. Se detiene solo al terminar." : "Grabando. Navegá por el modelo y tocá Detener.", 6000);
      if (tour) {
        if (s.view === "recorrido") setResetKey((v) => v + 1);
        else s.setView("recorrido");
      }
    } catch {
      flash(null);
      s.setError("Tu navegador no permite grabar video. Probá con Chrome, Edge o Safari actualizado.");
    }
  };
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setClock(performance.now() - recording.since), 250);
    return () => clearInterval(timer);
  }, [recording]);
  // Recorrido automático: cuando la vuelta exterior termina (la vista deja de ser "recorrido") sigue el barrido interior y se corta.
  useEffect(() => {
    if (!recording?.tour) return;
    if (s.view === "recorrido") { tourSeen.current = true; return; }
    if (!tourSeen.current) return;
    const timer = setTimeout(() => void stopRecord(), TOUR_TAIL_MS);
    return () => clearTimeout(timer);
  }, [recording, s.view, stopRecord]);
  const views: { id: ViewId; name: string; Icon: typeof Eye }[] = [
    { id: "planta", name: "Planta", Icon: ScanLine },
    { id: "exterior", name: "Exterior", Icon: Eye },
    { id: "interior", name: "Interior", Icon: Layers3 },
    { id: "corte", name: "Corte", Icon: ScanLine },
    { id: "recorrido", name: "Recorrido", Icon: Route },
  ];
  return (
    <div
      ref={holder}
      className="config-viewer relative min-w-0 overflow-hidden"
      aria-label="Vista 3D de tu cabaña"
      onDoubleClick={() => setResetKey((v) => v + 1)}
    >
      {palette && (
        <Canvas
          frameloop="demand"
          shadows={!low}
          dpr={[1, fx.post ? fx.profile.dprMax : low ? 1.5 : 2]}
          camera={{ position: [12, 9, 14], fov: 45, near: 0.08, far: 180 }}
          gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
          onPointerMissed={() => {
            // Tocar el terreno vacío deselecciona el árbol (si no se está plantando uno nuevo).
            const e = useEntorno.getState();
            if (e.selectedTree && !e.placing && !e.movingTree) e.selectTree(null);
          }}
          onCreated={({ gl, scene: sc, camera: cam, invalidate }) => {
            invalidateRef.current = invalidate;
            renderer.current = gl;
            scene.current = sc;
            camera.current = cam;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            stopContextWatch.current?.();
            stopContextWatch.current = watchViewerContext(gl.domElement, onFail);
          }}
          fallback={
            <div className="p-8 text-foreground">
              El visor no está disponible. Podés usar el cotizador de abajo.
            </div>
          }
        >
          <SafeBoundary label="El cielo y las luces" fallback={<StaticLights palette={palette} low={low} />}>
            <Atmosphere low={low} active={visible} shadowSize={fx.profile.shadowMap} />
          </SafeBoundary>
          {fx.reflections ? (
            <SafeBoundary label="Los reflejos del cielo" fallback={<StaticEnvironment palette={palette} />}>
              <SkyReflections resolution={fx.profile.reflectionRes} />
            </SafeBoundary>
          ) : (
            <StaticEnvironment palette={palette} />
          )}
          <Suspense fallback={null}>
            <Ground underHouse={s.underHouse} />
            <House palette={palette} dragging={dragging} setDragging={setDragging} />
          </Suspense>
          <SafeBoundary label="La vegetación" fallback={null}>
            <Trees low={low} palette={palette} />
            <TreeInteraction palette={palette} />
          </SafeBoundary>
          <CameraRig
            onControls={ctrl => { orbit.current = ctrl; }}
            onCamera={cam=>{camera.current=cam;}}
            resetKey={resetKey}
            dragging={
              !!dragging || !!s.placing || s.editing || s.tool === "wall" || s.tool === "contour" || !!movingTree
            }
          />
          {/* Postproducción: oclusión ambiental, brillo, tono de cine y color. Se apaga sola si falla (ver PostFX). */}
          <SafeBoundary key={postOk ? "post-on" : "post-off"} label="La postproducción" fallback={<ReportPostFailure />}>
            <PostFX api={post} />
          </SafeBoundary>
        </Canvas>
      )}
      <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
        {views.map(({ id, name, Icon }) => (
          <Button
            key={id}
            variant={s.view === id ? "default" : "secondary"}
            className="min-h-11 gap-2 px-3 text-xs"
            aria-pressed={s.view === id}
            onClick={() => s.setView(id)}
          >
            <Icon size={15} />
            {name}
          </Button>
        ))}
      </div>
      {(s.view === "interior" || s.view === "corte" || s.view === "planta") && s.config.floors > 1 && (
        <div className="absolute left-3 top-28 flex gap-1">
          {Array.from({ length: s.config.floors }, (_, i) => (
            <Button
              key={i}
              variant={i === s.activeFloor ? "default" : "secondary"}
              className="min-h-11 text-xs"
              onClick={() => s.setFloor(i)}
              aria-pressed={i === s.activeFloor}
            >
              {i === 0 ? "Planta baja" : `${i}ª planta`}
            </Button>
          ))}
        </div>
      )}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between gap-2">
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11"
            title="Centrar casa"
            aria-label="Centrar casa"
            onClick={() => setResetKey((v) => v + 1)}
          >
            <Focus size={18} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11"
            title="Ver bajo la casa"
            aria-label="Ver bajo la casa"
            aria-pressed={s.underHouse}
            onClick={s.toggleUnder}
          >
            <ArrowDown size={18} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11"
            disabled={!s.past.length}
            title="Deshacer"
            aria-label="Deshacer"
            onClick={s.undo}
          >
            <Undo2 size={17} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11"
            disabled={!s.future.length}
            title="Rehacer"
            aria-label="Rehacer"
            onClick={s.redo}
          >
            <Redo2 size={17} />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button
            variant={recording ? "destructive" : "secondary"}
            size="icon"
            className="h-11 w-11"
            aria-label={recording ? "Detener grabación" : "Grabar recorrido"}
            title={canRecord ? (recording ? "Detener y descargar el video" : "Grabar recorrido en video (con marca de agua)") : "Tu navegador no permite grabar video"}
            aria-pressed={!!recording}
            disabled={!canRecord || busy}
            onClick={() => (recording ? void stopRecord() : void startRecord())}
          >
            {recording ? <Square size={16} fill="currentColor" /> : <Video size={18} />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="relative h-11 w-11"
            aria-label="Capturar imagen 4K"
            title="Capturar imagen en 4K (con marca de agua)"
            disabled={busy || !!recording}
            onClick={capture}
          >
            {busy ? <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> : <Camera size={18} />}
            <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-sm bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">4K</span>
          </Button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-[4.25rem] flex items-end justify-between gap-2">
        <p role="status" aria-live="polite" className={`max-w-[75%] rounded-sm border border-border bg-background/90 px-3 py-1.5 text-xs text-foreground ${note ? "" : "sr-only"}`}>{note}</p>
        {recording && (
          <span className="ml-auto inline-flex items-center gap-2 rounded-sm border border-border bg-background/90 px-3 py-1.5 text-xs font-semibold tabular-nums text-foreground">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" />
            REC {formatClock(clock)}
          </span>
        )}
      </div>
      {s.view === 'interior' && <div className="absolute right-3 top-28 flex flex-col gap-1">
        <Button variant="secondary" size="icon" className="h-11 w-11" aria-label="Acercar interior" title="Acercar interior" onClick={() => zoomView(0.8)}><ZoomIn size={18} /></Button>
        <Button variant="secondary" size="icon" className="h-11 w-11" aria-label="Alejar interior" title="Alejar interior" onClick={() => zoomView(1.25)}><ZoomOut size={18} /></Button>
      </div>}
    </div>
  );
}
