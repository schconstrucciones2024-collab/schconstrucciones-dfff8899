import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Check,
  DoorOpen,
  Download,
  Eraser,
  Eye,
  Hand,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { inside, type Point } from "@/config/geometry";
import { OPENINGS_CATALOG } from "@/config/openingsCatalog";
import {
  EMPTY_PLAN,
  PLAN,
  PLAN_OPENING_KINDS,
  PLAN_OPENING_NAMES,
  ROOM_NAMES,
  addRectangle,
  addWall,
  analyzePlan,
  editOpening,
  meters,
  openingWidth,
  parsePlan,
  removeOpening,
  removeWall,
  serializePlan,
  setLabel,
  setWallLength,
  squareMeters,
  wallLength,
  type PlanDoc,
  type PlanOpeningKind,
} from "@/config/planDraw";
import { downloadBlob } from "@/lib/mediaCapture";
import { configToPlan, planToConfig } from "@/store/planBridge";
import { useConfigurator } from "@/store/useConfigurator";
import { PlanCanvas, type PlanCanvasHandle, type PlanTool, type Selection } from "./PlanCanvas";
import { planToPng } from "./planSvg";
import { boxOf } from "./planView";

const STORAGE_KEY = "sch-plano-v1";
const HISTORY = 80;

const TOOLS: { id: PlanTool; name: string; Icon: typeof Pencil; hint: string }[] = [
  { id: "select", name: "Mover", Icon: MousePointer2, hint: "Tocá una pared o una abertura para elegirla. Arrastrá una esquina para moverla, o una pared para correrla de costado: la habitación se agranda sin deformarse. Con dos dedos acercás y movés el plano." },
  { id: "wall", name: "Pared", Icon: Pencil, hint: "Tocá donde empieza la pared y después donde termina; podés seguir tocando para encadenar paredes. Para cerrar la forma, tocá el primer punto. También podés arrastrar el dedo para trazar una sola pared." },
  { id: "room", name: "Habitación", Icon: Square, hint: "Arrastrá en diagonal para dibujar una habitación entera, o escribí sus medidas abajo. Si queda pegada a otra, comparten la pared." },
  { id: "door", name: "Puerta", Icon: DoorOpen, hint: "Tocá una pared y soltá donde quieras la puerta (mientras mantenés apretado, podés deslizarla). En una pared exterior es la puerta de entrada; en un tabique, una puerta interior." },
  { id: "window", name: "Ventana", Icon: AppWindow, hint: "Elegí el tipo de ventana, tocá una pared y soltá donde la quieras. Las ventanas grandes y el ventanal corredizo van en paredes exteriores." },
  { id: "name", name: "Nombre", Icon: Type, hint: "Tocá adentro de una habitación cerrada para ponerle nombre (Dormitorio, Baño, Cocina…). El nombre se ve también en el diseñador 3D." },
  { id: "erase", name: "Borrar", Icon: Eraser, hint: "Tocá una pared, una puerta o una ventana para borrarla. Si te equivocás, usá Deshacer." },
  { id: "pan", name: "Mano", Icon: Hand, hint: "Arrastrá para mover el plano. Con dos dedos también podés acercar y alejar." },
];

const parseM = (text: string) => Number(text.trim().replace(",", "."));
const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center gap-1.5 border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary hover:text-primary"}`;

/** El extremo «de referencia» de una pared: el de la izquierda (o el de arriba si es vertical). */
const startsAtReference = (w: { a: Point; b: Point }) => w.a.x < w.b.x - 1e-9 || (Math.abs(w.a.x - w.b.x) < 1e-9 && w.a.z <= w.b.z);

type History = { doc: PlanDoc; past: PlanDoc[]; future: PlanDoc[] };

export default function PlanStudio({ onShow3D }: { onShow3D: (message: string) => void }) {
  const [history, setHistory] = useState<History>({ doc: EMPTY_PLAN, past: [], future: [] });
  const doc = history.doc;
  const [tool, setToolState] = useState<PlanTool>("select");
  const [windowKind, setWindowKind] = useState<PlanOpeningKind>("ventana");
  const [ortho, setOrtho] = useState(true);
  const [dims, setDims] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [pen, setPen] = useState<Point | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [naming, setNaming] = useState<Point | null>(null);
  const [nameText, setNameText] = useState("");
  const [welcome, setWelcome] = useState(true);
  const [confirm, setConfirm] = useState<"clear" | "load3d" | null>(null);
  const [lengthText, setLengthText] = useState("");
  const [positionText, setPositionText] = useState("");
  const [stepText, setStepText] = useState("3");
  const [roomW, setRoomW] = useState("4");
  const [roomD, setRoomD] = useState("3");
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<PlanCanvasHandle>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  const analysis = useMemo(() => analyzePlan(doc), [doc]);

  const say = (text: string | null, ms = 6000) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = text ? setTimeout(() => setNotice(null), ms) : null;
  };
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  const refit = () => requestAnimationFrame(() => canvas.current?.fit());

  // Retoma el último plano de este navegador.
  useEffect(() => {
    let saved: PlanDoc | null = null;
    try { saved = parsePlan(window.localStorage.getItem(STORAGE_KEY)); } catch { /* sin almacenamiento */ }
    if (saved?.walls.length) {
      setHistory({ doc: saved, past: [], future: [] });
      setWelcome(false);
      say("Retomamos tu último plano.");
      refit();
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => { try { window.localStorage.setItem(STORAGE_KEY, serializePlan(doc)); } catch { /* sin almacenamiento */ } }, 300);
    return () => clearTimeout(t);
  }, [doc]);

  const commit = (next: PlanDoc, sel?: Selection) => {
    if (next === doc) return;
    setHistory((h) => ({ doc: next, past: [...h.past, h.doc].slice(-HISTORY), future: [] }));
    setProblems([]);
    if (sel !== undefined) setSelection(sel);
  };
  const undo = () => setHistory((h) => (h.past.length ? { doc: h.past.at(-1)!, past: h.past.slice(0, -1), future: [h.doc, ...h.future] } : h));
  const redo = () => setHistory((h) => (h.future.length ? { doc: h.future[0]!, past: [...h.past, h.doc], future: h.future.slice(1) } : h));
  const afterHistory = () => { setPen(null); setSelection(null); setNaming(null); };

  const setTool = (t: PlanTool) => {
    setToolState(t);
    setPen(null);
    setNaming(null);
    setWelcome(false);
    if (t !== "select") setSelection(null);
    say(null);
  };

  const selectedWall = selection?.kind === "wall" ? doc.walls.find((w) => w.id === selection.id) : undefined;
  const selectedOpening = selection?.kind === "opening" ? doc.openings.find((o) => o.id === selection.id) : undefined;
  const placed = selectedOpening ? analysis.openings.find((o) => o.id === selectedOpening.id) : undefined;
  const openingWall = selectedOpening ? doc.walls.find((w) => w.id === selectedOpening.wall) : undefined;

  // Los campos de medida siguen a lo que está elegido.
  useEffect(() => {
    if (selectedWall) setLengthText(wallLength(selectedWall).toFixed(2).replace(".", ","));
  }, [selectedWall?.id, selectedWall?.a.x, selectedWall?.a.z, selectedWall?.b.x, selectedWall?.b.z]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedOpening && openingWall) {
      const len = wallLength(openingWall);
      setPositionText((startsAtReference(openingWall) ? selectedOpening.at : len - selectedOpening.at).toFixed(2).replace(".", ","));
    }
  }, [selectedOpening?.id, selectedOpening?.at, selectedOpening?.wall]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selection && !selectedWall && !selectedOpening) setSelection(null);
  }, [selection, selectedWall, selectedOpening]);

  const rooms = analysis.rooms;
  const namingRoom = naming ? rooms.find((r) => inside(naming, r.room.polygon, false)) : undefined;
  useEffect(() => { setNameText(namingRoom?.label?.text ?? ""); }, [namingRoom?.room.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameAt = (p: Point) => {
    const r = rooms.find((v) => inside(p, v.room.polygon, false) && !(v.room.holes ?? []).some((h) => inside(p, h)));
    if (!r) { say("Tocá adentro de una habitación cerrada: las paredes tienen que formar una forma sin huecos."); return; }
    setNaming(r.room.center);
  };
  const renameRoom = (text: string) => {
    if (!namingRoom) return;
    const polygon = namingRoom.room.polygon;
    const cleaned = { ...doc, labels: doc.labels.filter((l) => !inside(l.at, polygon, false)) };
    commit(setLabel(cleaned, namingRoom.room.center, text));
    setNaming(null);
  };

  const applyLength = () => {
    if (!selectedWall) return;
    const v = parseM(lengthText);
    const next = Number.isFinite(v) ? setWallLength(doc, selectedWall.id, v) : doc;
    if (next === doc) { say(`Escribí un largo en metros (mínimo ${meters(PLAN.minWall)}).`); return; }
    commit(next);
  };
  const applyPosition = (value: number) => {
    if (!selectedOpening || !openingWall) return;
    const len = wallLength(openingWall);
    commit(editOpening(doc, selectedOpening.id, { at: startsAtReference(openingWall) ? value : len - value }));
  };
  const nudge = (delta: number) => {
    if (!selectedOpening || !openingWall) return;
    const len = wallLength(openingWall), cur = startsAtReference(openingWall) ? selectedOpening.at : len - selectedOpening.at;
    applyPosition(Math.min(len, Math.max(0, Math.round((cur + delta) * 100) / 100)));
  };
  const deleteSelected = () => {
    if (selectedWall) commit(removeWall(doc, selectedWall.id), null);
    else if (selectedOpening) commit(removeOpening(doc, selectedOpening.id), null);
  };

  const stepWall = (dx: number, dz: number) => {
    const len = parseM(stepText);
    if (!pen) return;
    if (!Number.isFinite(len) || len < PLAN.minWall) { say(`Escribí un largo en metros (mínimo ${meters(PLAN.minWall)}).`); return; }
    const end = { x: Math.round((pen.x + dx * len) * 1000) / 1000, z: Math.round((pen.z + dz * len) * 1000) / 1000 };
    const r = addWall(doc, pen, end);
    if (!r.ids.length) { say("Ya hay una pared dibujada en ese lugar."); return; }
    commit(r.doc);
    setPen(end);
  };
  const startAtOrigin = () => { setPen({ x: 0, z: 0 }); refit(); };

  const addRoomWithSize = () => {
    const w = parseM(roomW), d = parseM(roomD);
    if (![w, d].every((v) => Number.isFinite(v) && v >= PLAN.minWall && v <= 40)) { say("Escribí el ancho y el largo en metros (entre 0,20 y 40 m)."); return; }
    const box = boxOf(doc.walls.flatMap((v) => [v.a, v.b]));
    const x0 = box ? box.maxX : 0, z0 = box ? box.minZ : 0;
    const r = addRectangle(doc, { x: x0, z: z0 }, { x: x0 + w, z: z0 + d });
    if (!r.ids.length) { say("Esa habitación ya está dibujada."); return; }
    commit(r.doc);
    setWelcome(false);
    say(box ? `Agregamos la habitación de ${meters(w)} × ${meters(d)} a la derecha del plano. Arrastrala o correla de costado para acomodarla.` : null);
    refit();
  };

  const exportPng = async () => {
    if (!doc.walls.length) { say("Dibujá algo para poder descargar el plano."); return; }
    try {
      const r = await planToPng(doc, analysis);
      downloadBlob(r.blob, `SCH-plano-${r.width}x${r.height}.png`);
      say("Plano descargado como imagen, con todas las medidas.");
    } catch (e) {
      say(e instanceof Error ? e.message : "No pudimos descargar el plano.");
    }
  };

  const loadFrom3D = () => {
    const c = useConfigurator.getState().config;
    commit(configToPlan(c, 0));
    afterHistory();
    setWelcome(false);
    setTool("select");
    say("Dibujamos en el plano la casa de tu diseñador 3D (planta baja). Los muebles y las escaleras no se muestran acá.");
    refit();
  };

  const go3D = () => {
    const store = useConfigurator.getState();
    const result = planToConfig(doc, store.config);
    if (!result.ok) { setProblems(result.errors); return; }
    store.setError(null);
    store.replaceDesign(result.config);
    const error = useConfigurator.getState().error;
    if (error) { setProblems([error]); return; }
    store.setTool("select");
    store.setView("exterior");
    setProblems([]);
    const rooms = result.analysis.rooms.length;
    onShow3D(
      `Tu plano ya está en 3D: ${squareMeters(result.config.m2)}, ${rooms} ${rooms === 1 ? "ambiente" : "ambientes"} y ${result.config.openings.length} ${result.config.openings.length === 1 ? "abertura" : "aberturas"}. ` +
        `Agregá muebles y escaleras con las herramientas del diseñador, o usá «Deshacer» para recuperar el diseño anterior.` +
        (result.warnings.length ? ` Ojo: ${result.warnings.join(" ")}` : ""),
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const field = e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && !field) {
      const k = e.key.toLowerCase();
      if (k === "z" || k === "y") {
        e.preventDefault();
        e.stopPropagation();
        if (k === "y" || e.shiftKey) redo(); else undo();
        afterHistory();
      }
      return;
    }
    if (field) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
    if (e.key === "Escape") { setPen(null); setSelection(null); setNaming(null); }
  };

  const status = analysis.contour
    ? `${squareMeters(analysis.area)} · ${rooms.length} ${rooms.length === 1 ? "ambiente" : "ambientes"} · ${doc.openings.length} ${doc.openings.length === 1 ? "abertura" : "aberturas"}`
    : doc.walls.length
      ? `${doc.walls.length} ${doc.walls.length === 1 ? "pared" : "paredes"} · cerrá una forma para ver los m²`
      : "Plano vacío";
  const hint = TOOLS.find((t) => t.id === tool)!.hint;
  const empty = !doc.walls.length;

  const field = (id: string, label: string, value: string, set: (v: string) => void, enter?: () => void): ReactNode => (
    <label className="min-w-0 flex-1 text-xs" htmlFor={id}>
      {label}
      <input id={id} className="config-input mt-1" type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => set(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enter?.(); }} />
    </label>
  );

  return (
    <div ref={root} id="plano-estudio" tabIndex={-1} className="plan-studio border-y border-border bg-background outline-none" onKeyDown={onKeyDown} onPointerDown={(e) => { if (!(e.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName))) root.current?.focus({ preventScroll: true }); }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-medium sm:text-2xl">Dibujá tu plano</h3>
          <p className="text-xs text-foreground/70">En medidas reales: lo que dibujás de 4,50 m mide 4,50 m en la obra.</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs font-medium text-foreground/80" aria-live="polite">{status}</span>
          <Button variant="outline" size="icon" className="h-11 w-11" disabled={!history.past.length} aria-label="Deshacer" title="Deshacer" onClick={() => { undo(); afterHistory(); }}><Undo2 size={16} /></Button>
          <Button variant="outline" size="icon" className="h-11 w-11" disabled={!history.future.length} aria-label="Rehacer" title="Rehacer" onClick={() => { redo(); afterHistory(); }}><Redo2 size={16} /></Button>
        </div>
      </div>

      <div role="toolbar" aria-label="Herramientas del plano" className="grid grid-cols-4 gap-1 border-b border-border px-2 py-2 sm:grid-cols-8 sm:px-4">
        {TOOLS.map(({ id, name, Icon }) => (
          <button key={id} type="button" aria-pressed={tool === id} onClick={() => setTool(id)} className={`${chip(tool === id)} h-14 flex-col justify-center gap-0.5 px-1 text-[11px]`}>
            <Icon size={18} aria-hidden="true" />
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-3 py-1 text-xs sm:px-5">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={ortho} onChange={(e) => setOrtho(e.target.checked)} />Ángulos rectos</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={dims} onChange={(e) => setDims(e.target.checked)} />Mostrar medidas</label>
        <span className="text-foreground/60">Cuadrícula: 1 m · se ajusta de a 10 cm</span>
      </div>

      <div className="relative h-[62svh] min-h-[380px] border-b border-border lg:h-[600px]">
        <PlanCanvas
          ref={canvas}
          doc={doc}
          analysis={analysis}
          tool={tool}
          windowKind={windowKind}
          ortho={ortho}
          dims={dims}
          selection={selection}
          pen={pen}
          onSelect={setSelection}
          onCommit={commit}
          onPen={setPen}
          onNameAt={nameAt}
          onNotice={say}
        />
        {empty && welcome && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 p-4" role="dialog" aria-label="Cómo empezar el plano">
            <div className="w-full max-w-sm border border-border bg-background p-5 shadow-lg">
              <h4 className="font-display text-2xl font-medium">Empezá tu plano</h4>
              <p className="mt-2 text-sm leading-6 text-foreground/75">Se dibuja en metros reales. No hace falta experiencia: elegí cómo arrancar y después lo ajustás.</p>
              <div className="mt-4 grid gap-2">
                <Button className="min-h-12 justify-start gap-2" onClick={() => setTool("wall")}><Pencil size={16} />Dibujar paredes con el dedo</Button>
                <Button variant="outline" className="min-h-12 justify-start gap-2" onClick={() => setTool("room")}><Square size={16} />Una habitación con medidas</Button>
                <Button variant="outline" className="min-h-12 justify-start gap-2" onClick={loadFrom3D}><Box size={16} />Partir de mi casa del diseñador 3D</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 px-3 py-4 sm:px-5">
        <p className="text-xs leading-5 text-foreground/75">{hint}</p>

        {tool === "wall" && (
          <div className="space-y-2 border border-border p-3">
            {pen ? (
              <>
                <p className="text-xs font-medium">Largo exacto del próximo tramo</p>
                <div className="flex flex-wrap items-end gap-2">
                  {field("plano-largo-tramo", "Largo (m)", stepText, setStepText)}
                  <div className="flex gap-1" role="group" aria-label="Hacia dónde sigue la pared">
                    {([{ Icon: ArrowLeft, dx: -1, dz: 0, name: "hacia la izquierda" }, { Icon: ArrowUp, dx: 0, dz: -1, name: "hacia arriba" }, { Icon: ArrowDown, dx: 0, dz: 1, name: "hacia abajo" }, { Icon: ArrowRight, dx: 1, dz: 0, name: "hacia la derecha" }] as const).map(({ Icon, dx, dz, name }) => (
                      <Button key={name} variant="outline" size="icon" className="h-11 w-11" aria-label={`Pared ${name}`} title={`Pared ${name}`} onClick={() => stepWall(dx, dz)}><Icon size={18} /></Button>
                    ))}
                  </div>
                  <Button variant="ghost" className="min-h-11 gap-1 text-xs" onClick={() => setPen(null)}><Check size={16} />Terminar</Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span>Tocá en el plano para marcar dónde empieza la primera pared.</span>
                {empty && <Button variant="outline" className="min-h-11 text-xs" onClick={startAtOrigin}>Empezar en el punto 0,0</Button>}
              </div>
            )}
          </div>
        )}

        {tool === "room" && (
          <div className="flex flex-wrap items-end gap-2 border border-border p-3">
            {field("plano-hab-ancho", "Ancho (m)", roomW, setRoomW, addRoomWithSize)}
            {field("plano-hab-largo", "Largo (m)", roomD, setRoomD, addRoomWithSize)}
            <Button className="min-h-11 gap-1 text-xs" onClick={addRoomWithSize}><Square size={16} />Agregar habitación</Button>
          </div>
        )}

        {tool === "window" && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de ventana">
            {(["ventana", "ventanaGrande", "ventanal"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={windowKind === k} className={chip(windowKind === k)} onClick={() => setWindowKind(k)}>
                {PLAN_OPENING_NAMES[k]} · {meters(openingWidth(k, true))}
              </button>
            ))}
          </div>
        )}
        {tool === "door" && (
          <p className="text-xs text-foreground/65">Medidas: puerta de entrada {meters(OPENINGS_CATALOG.entrada.width)} · puerta interior {meters(OPENINGS_CATALOG.interior.width)}.</p>
        )}

        {tool === "name" && naming && namingRoom && (
          <div className="space-y-2 border border-border p-3">
            <p className="text-xs font-medium">Nombre de esta habitación ({squareMeters(namingRoom.room.area)})</p>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_NAMES.map((n) => <button key={n} type="button" className={chip(nameText === n)} onClick={() => renameRoom(n)}>{n}</button>)}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs" htmlFor="plano-nombre">Otro nombre
                <input id="plano-nombre" className="config-input mt-1" maxLength={PLAN.maxLabel} value={nameText} onChange={(e) => setNameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameRoom(nameText); }} />
              </label>
              <Button className="min-h-11 gap-1 text-xs" onClick={() => renameRoom(nameText)}><Check size={16} />Guardar</Button>
              {namingRoom.label && <Button variant="outline" className="min-h-11 text-xs" onClick={() => renameRoom("")}>Quitar nombre</Button>}
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Cerrar" onClick={() => setNaming(null)}><X size={16} /></Button>
            </div>
          </div>
        )}

        {tool === "select" && selectedWall && (
          <div className="space-y-2 border border-border p-3">
            <p className="text-xs font-medium">
              Pared elegida · {meters(wallLength(selectedWall))}
              {analysis.contour && (() => { const piece = analysis.pieces.find((p) => p.sources.includes(selectedWall.id)); return piece ? ` · ${piece.kind === "exterior" ? "exterior" : piece.kind === "interior" ? "interior" : "suelta (fuera de la casa)"}` : ""; })()}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              {field("plano-largo", "Largo (m)", lengthText, setLengthText, applyLength)}
              <Button className="min-h-11 gap-1 text-xs" onClick={applyLength}><Check size={16} />Aplicar</Button>
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Borrar la pared" title="Borrar la pared" onClick={deleteSelected}><Trash2 size={16} /></Button>
            </div>
            <p className="text-[11px] leading-5 text-foreground/60">Si la pared es el lado de una habitación, al cambiar el largo la habitación se agranda o se achica sin deformarse.</p>
          </div>
        )}

        {tool === "select" && selectedOpening && openingWall && (
          <div className="space-y-2 border border-border p-3">
            <p className="text-xs font-medium">
              {placed?.type ? OPENINGS_CATALOG[placed.type].name : PLAN_OPENING_NAMES[selectedOpening.kind]} · {meters(placed?.width ?? openingWidth(selectedOpening.kind, false))} de ancho
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de abertura">
              {PLAN_OPENING_KINDS.map((k) => <button key={k} type="button" aria-pressed={selectedOpening.kind === k} className={chip(selectedOpening.kind === k)} onClick={() => commit(editOpening(doc, selectedOpening.id, { kind: k }))}>{PLAN_OPENING_NAMES[k]}</button>)}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Correr 10 cm hacia el extremo de referencia" title="−10 cm" onClick={() => nudge(-0.1)}><ArrowLeft size={16} /></Button>
              {field("plano-pos", `Distancia desde el extremo ${Math.abs(openingWall.a.x - openingWall.b.x) < 1e-9 ? "de arriba" : "izquierdo"} (m)`, positionText, setPositionText, () => { const v = parseM(positionText); if (Number.isFinite(v)) applyPosition(v); })}
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Correr 10 cm hacia el otro extremo" title="+10 cm" onClick={() => nudge(0.1)}><ArrowRight size={16} /></Button>
              <Button className="min-h-11 gap-1 text-xs" onClick={() => { const v = parseM(positionText); if (Number.isFinite(v)) applyPosition(v); else say("Escribí la distancia en metros."); }}><Check size={16} />Aplicar</Button>
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Borrar la abertura" title="Borrar la abertura" onClick={deleteSelected}><Trash2 size={16} /></Button>
            </div>
            {placed?.problem && <p role="alert" className="text-xs text-destructive">{placed.problem}</p>}
          </div>
        )}

        <div role="status" aria-live="polite" className="min-h-5 text-xs text-foreground/80">{notice}</div>

        {analysis.contour && analysis.issues.length > 0 && <p className="text-xs text-destructive">{analysis.issues.join(" ")}</p>}
        {analysis.warnings.length > 0 && <p className="text-xs text-foreground/70">{analysis.warnings.join(" ")}</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button className="min-h-12 flex-1 gap-2 sm:flex-none" onClick={go3D}><Eye size={17} />Ver mi plano en 3D</Button>
          <Button variant="outline" className="min-h-12 gap-2" onClick={exportPng}><Download size={16} />Descargar plano</Button>
          <Button variant="outline" className="min-h-12 gap-2" onClick={() => (empty ? loadFrom3D() : setConfirm("load3d"))}><Box size={16} />Usar mi casa 3D</Button>
          <Button variant="ghost" className="min-h-12 gap-2 text-destructive hover:text-destructive" disabled={empty} onClick={() => setConfirm("clear")}><Trash2 size={16} />Empezar de nuevo</Button>
        </div>
        {problems.length > 0 && (
          <div role="alert" className="border border-destructive/60 bg-destructive/5 p-3 text-xs leading-5">
            <p className="font-medium">Todavía no se puede pasar a 3D:</p>
            <ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        <p className="text-[11px] leading-5 text-foreground/60">
          El plano se guarda solo en este celular o computadora. Al pasarlo a 3D se arma la casa con sus paredes, puertas y ventanas (una planta); los muebles y las escaleras se agregan después en el diseñador.
        </p>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>{confirm === "clear" ? "¿Empezar de nuevo?" : "¿Reemplazar el plano por tu casa 3D?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === "clear" ? "Se borra todo lo dibujado. Podés recuperarlo con Deshacer." : "Se dibuja en el plano la casa que tenés en el diseñador 3D (planta baja) y se reemplaza lo que dibujaste. Podés recuperarlo con Deshacer."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => { if (confirm === "clear") { commit(EMPTY_PLAN); afterHistory(); setWelcome(true); } else loadFrom3D(); setConfirm(null); }}>Sí, continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
