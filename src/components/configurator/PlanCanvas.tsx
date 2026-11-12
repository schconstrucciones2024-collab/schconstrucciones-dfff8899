import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as ReactPointer, type ReactNode } from "react";
import { Focus, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { distance, type Point } from "@/config/geometry";
import {
  PLAN,
  addRectangle,
  addWall,
  analyzePlan,
  editOpening,
  hitWall,
  meters,
  moveVertex,
  moveWall,
  nodesOf,
  openingWidth,
  pieceNormal,
  removeOpening,
  removeWall,
  snapPoint,
  snapTo,
  squareMeters,
  addOpening,
  type PlacedOpening,
  type PlanAnalysis,
  type PlanDoc,
  type PlanOpeningKind,
  type SnapGuide,
} from "@/config/planDraw";
import { openingGlyph } from "./planSvg";
import { boxOf, fitView, panBy, scaleBarMeters, toWorld, viewBox, zoomAt, type PlanView, type Px } from "./planView";

export type PlanTool = "select" | "wall" | "room" | "door" | "window" | "name" | "erase" | "pan";
export type Selection = { kind: "wall" | "opening"; id: string } | null;
export type PlanCanvasHandle = { fit: () => void; zoom: (factor: number) => void };

type Props = {
  doc: PlanDoc;
  analysis: PlanAnalysis;
  tool: PlanTool;
  /** Tipo de ventana que se coloca con la herramienta «Ventana». */
  windowKind: PlanOpeningKind;
  ortho: boolean;
  dims: boolean;
  selection: Selection;
  /** Último punto de la cadena de paredes que se está dibujando. */
  pen: Point | null;
  onSelect: (s: Selection) => void;
  onCommit: (doc: PlanDoc, selection?: Selection) => void;
  onPen: (p: Point | null) => void;
  onNameAt: (p: Point) => void;
  onNotice: (text: string) => void;
};

type Gesture =
  | { kind: "pan"; startPx: Px; view: PlanView; moved: boolean; tap?: Point; erase?: { kind: "wall" | "opening"; id: string } }
  | { kind: "corner"; from: Point; startPx: Px; moved: boolean }
  | { kind: "wall"; id: string; start: Point; startPx: Px; moved: boolean }
  | { kind: "opening"; id: string; startPx: Px; moved: boolean }
  | { kind: "draw"; start: Point; startPx: Px; moved: boolean }
  | { kind: "rect"; start: Point; startPx: Px; moved: boolean }
  | { kind: "place"; opening: PlanOpeningKind };

type Preview =
  | { kind: "doc"; doc: PlanDoc }
  | { kind: "wall"; a: Point; b: Point; guide: SnapGuide }
  | { kind: "rect"; a: Point; b: Point }
  | { kind: "opening"; wall: string; at: number; opening: PlanOpeningKind }
  | { kind: "hover"; p: Point; guide: SnapGuide };

const TAP_PX = 7;
const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.z - b.z) < 1e-3;
const unitOf = (a: Point, b: Point): Point => {
  const l = distance(a, b) || 1;
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
};
const fmtDims = (a: Point, b: Point) => `${meters(Math.abs(b.x - a.x))} × ${meters(Math.abs(b.z - a.z))}`;

export const PlanCanvas = forwardRef<PlanCanvasHandle, Props>(function PlanCanvas(props, ref) {
  const { doc, analysis, tool, windowKind, ortho, dims, selection, pen, onSelect, onCommit, onPen, onNameAt, onNotice } = props;
  const host = useRef<HTMLDivElement>(null);
  const gridId = useId().replace(/:/g, "");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<PlanView | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const ptrs = useRef(new Map<number, Px>());
  const pinch = useRef<{ dist: number; center: Px; view: PlanView } | null>(null);
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allPoints = () => doc.walls.flatMap((w) => [w.a, w.b]);
  useEffect(() => {
    if (!view && size.w > 0 && size.h > 0) setView(fitView(boxOf(allPoints()), size.w, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, view]);

  useImperativeHandle(ref, () => ({
    fit: () => { if (size.w > 0) setView(fitView(boxOf(allPoints()), size.w, size.h)); },
    zoom: (factor: number) => setView((v) => (v ? zoomAt(v, size.w, size.h, factor, { x: size.w / 2, y: size.h / 2 }) : v)),
  }));

  // La rueda del mouse acerca y aleja; tiene que ser un listener nativo para poder frenar el scroll de la página.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => (v ? zoomAt(v, el.clientWidth, el.clientHeight, e.deltaY < 0 ? 1.15 : 1 / 1.15, { x: e.clientX - r.left, y: e.clientY - r.top }) : v));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const shownDoc = preview?.kind === "doc" ? preview.doc : doc;
  const shown = useMemo(() => (preview?.kind === "doc" ? analyzePlan(preview.doc) : analysis), [preview, analysis]);
  const ppm = view?.ppm ?? 50;
  const tol = (px: number) => px / ppm;

  const rel = (e: ReactPointer<HTMLDivElement>): Px => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (px: Px): Point => toWorld(view!, size.w, size.h, px);
  const moved = (g: { startPx: Px }, px: Px) => Math.hypot(px.x - g.startPx.x, px.y - g.startPx.y) > TAP_PX;
  const placeKind = (): PlanOpeningKind => (tool === "door" ? "puerta" : windowKind);

  const hitOpening = (p: Point, d = doc, a = analysis): PlacedOpening | undefined =>
    a.openings.find((o) => d.openings.some((x) => x.id === o.id) && distance(o.center, p) <= o.width / 2 + tol(12));

  const onDown = (e: ReactPointer<HTMLDivElement>) => {
    if (!view || size.w === 0) return;
    const px = rel(e);
    ptrs.current.set(e.pointerId, px);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()] as [Px, Px];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view };
      gesture.current = null;
      setPreview(null);
      return;
    }
    if (ptrs.current.size > 2) return;
    const p = world(px);
    const startPan = (tap?: Point, erase?: { kind: "wall" | "opening"; id: string }): Gesture => ({ kind: "pan", startPx: px, view, moved: false, ...(tap ? { tap } : {}), ...(erase ? { erase } : {}) });
    if (tool === "pan") gesture.current = startPan();
    else if (tool === "select") {
      const op = hitOpening(p);
      const node = nodesOf(doc).find((n) => distance(n, p) <= tol(16));
      const wall = hitWall(doc, p, tol(14));
      if (op) { gesture.current = { kind: "opening", id: op.id, startPx: px, moved: false }; onSelect({ kind: "opening", id: op.id }); }
      else if (node) gesture.current = { kind: "corner", from: node, startPx: px, moved: false };
      else if (wall) gesture.current = { kind: "wall", id: wall.wall.id, start: p, startPx: px, moved: false };
      else gesture.current = startPan(p);
    } else if (tool === "wall") {
      gesture.current = { kind: "draw", start: snapPoint(doc, p, { tol: tol(14) }).point, startPx: px, moved: false };
    } else if (tool === "room") {
      gesture.current = { kind: "rect", start: snapPoint(doc, p, { tol: tol(14) }).point, startPx: px, moved: false };
    } else if (tool === "door" || tool === "window") {
      gesture.current = { kind: "place", opening: placeKind() };
      const hit = hitWall(doc, p, tol(26));
      if (hit) setPreview({ kind: "opening", wall: hit.wall.id, at: snapTo(hit.at, 0.05), opening: placeKind() });
    } else if (tool === "erase") {
      const op = hitOpening(p), wall = hitWall(doc, p, tol(14));
      gesture.current = startPan(p, op ? { kind: "opening", id: op.id } : wall ? { kind: "wall", id: wall.wall.id } : undefined);
    } else gesture.current = startPan(p);
  };

  const onMove = (e: ReactPointer<HTMLDivElement>) => {
    if (!view || size.w === 0) return;
    const px = rel(e);
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, px);
    if (pinch.current && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()] as [Px, Px];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1, center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const base = pinch.current;
      const zoomed = zoomAt(base.view, size.w, size.h, dist / base.dist, base.center);
      setView(panBy(zoomed, center.x - base.center.x, center.y - base.center.y));
      return;
    }
    const g = gesture.current, p = world(px);
    if (!g) {
      if (e.pointerType === "mouse") {
        if (tool === "wall") { const s = snapPoint(doc, p, { tol: tol(14), from: pen ?? undefined, ortho }); setPreview({ kind: "hover", p: s.point, guide: s.guide }); }
        else if (tool === "door" || tool === "window") {
          const hit = hitWall(doc, p, tol(26));
          setPreview(hit ? { kind: "opening", wall: hit.wall.id, at: snapTo(hit.at, 0.05), opening: placeKind() } : null);
        } else if (preview) setPreview(null);
      }
      return;
    }
    if (g.kind === "pan") {
      if (moved(g, px)) g.moved = true;
      if (g.moved) setView(panBy(g.view, px.x - g.startPx.x, px.y - g.startPx.y));
    } else if (g.kind === "corner") {
      if (moved(g, px)) g.moved = true;
      if (!g.moved) return;
      const rest = { ...doc, walls: doc.walls.filter((w) => !near(w.a, g.from) && !near(w.b, g.from)) };
      const s = snapPoint(rest, p, { tol: tol(14) });
      setPreview({ kind: "doc", doc: moveVertex(doc, g.from, s.point) });
    } else if (g.kind === "wall") {
      if (moved(g, px)) g.moved = true;
      if (!g.moved) return;
      const w = doc.walls.find((v) => v.id === g.id);
      if (!w) return;
      const d = unitOf(w.a, w.b), n = { x: -d.z, z: d.x };
      const s = snapTo((p.x - g.start.x) * n.x + (p.z - g.start.z) * n.z);
      setPreview({ kind: "doc", doc: moveWall(doc, g.id, { x: n.x * s, z: n.z * s }) });
    } else if (g.kind === "opening") {
      if (moved(g, px)) g.moved = true;
      const o = doc.openings.find((v) => v.id === g.id), w = o && doc.walls.find((v) => v.id === o.wall);
      if (!g.moved || !o || !w) return;
      const d = unitOf(w.a, w.b), at = snapTo((p.x - w.a.x) * d.x + (p.z - w.a.z) * d.z, 0.05);
      setPreview({ kind: "doc", doc: editOpening(doc, g.id, { at }) });
    } else if (g.kind === "draw") {
      if (moved(g, px)) g.moved = true;
      if (!g.moved) return;
      const s = snapPoint(doc, p, { tol: tol(14), from: g.start, ortho });
      setPreview({ kind: "wall", a: g.start, b: s.point, guide: s.guide });
    } else if (g.kind === "rect") {
      if (moved(g, px)) g.moved = true;
      if (!g.moved) return;
      setPreview({ kind: "rect", a: g.start, b: snapPoint(doc, p, { tol: tol(14) }).point });
    } else if (g.kind === "place") {
      const hit = hitWall(doc, p, tol(26));
      setPreview(hit ? { kind: "opening", wall: hit.wall.id, at: snapTo(hit.at, 0.05), opening: g.opening } : null);
    }
  };

  const onUp = (e: ReactPointer<HTMLDivElement>) => {
    const px = ptrs.current.get(e.pointerId) ?? rel(e);
    ptrs.current.delete(e.pointerId);
    if (pinch.current) { if (ptrs.current.size < 2) pinch.current = null; return; }
    const g = gesture.current, pv = preview;
    gesture.current = null;
    setPreview(null);
    if (!g || !view) return;
    const p = world(px);
    if (g.kind === "pan") {
      if (!g.moved && g.tap) {
        if (tool === "select") onSelect(null);
        else if (tool === "name") onNameAt(g.tap);
        else if (tool === "erase") {
          if (g.erase?.kind === "opening") onCommit(removeOpening(doc, g.erase.id), null);
          else if (g.erase?.kind === "wall") onCommit(removeWall(doc, g.erase.id), null);
          else onNotice("Tocá una pared, puerta o ventana para borrarla.");
        }
      }
    } else if (g.kind === "corner") {
      if (g.moved && pv?.kind === "doc") onCommit(pv.doc);
      else onSelect(null);
    } else if (g.kind === "wall") {
      if (g.moved && pv?.kind === "doc") onCommit(pv.doc, { kind: "wall", id: g.id });
      else onSelect({ kind: "wall", id: g.id });
    } else if (g.kind === "opening") {
      if (g.moved && pv?.kind === "doc") onCommit(pv.doc, { kind: "opening", id: g.id });
    } else if (g.kind === "draw") {
      if (g.moved && pv?.kind === "wall") {
        const r = addWall(doc, pv.a, pv.b);
        if (!r.ids.length) onNotice(distance(pv.a, pv.b) < PLAN.minWall ? "La pared es muy corta (mínimo 20 cm)." : "Ya hay una pared dibujada en ese lugar.");
        else onCommit(r.doc);
        onPen(pv.b);
      } else if (!pen) {
        onPen(snapPoint(doc, p, { tol: tol(14) }).point);
      } else {
        const end = snapPoint(doc, p, { tol: tol(14), from: pen, ortho }).point;
        if (near(end, pen)) { onPen(null); return; }
        const r = addWall(doc, pen, end);
        if (!r.ids.length) onNotice(distance(pen, end) < PLAN.minWall ? "La pared es muy corta (mínimo 20 cm)." : "Ya hay una pared dibujada en ese lugar.");
        else onCommit(r.doc);
        // Cerrar la forma sobre un punto ya existente termina la cadena.
        const closes = nodesOf(doc).some((n) => near(n, end));
        onPen(closes && r.ids.length ? null : end);
      }
    } else if (g.kind === "rect") {
      if (g.moved && pv?.kind === "rect") {
        const r = addRectangle(doc, pv.a, pv.b);
        if (!r.ids.length) onNotice("Esa habitación es muy chica (mínimo 20 cm de lado) o ya está dibujada.");
        else onCommit(r.doc);
      } else onNotice("Arrastrá en diagonal para dibujar la habitación, o escribí sus medidas abajo.");
    } else if (g.kind === "place") {
      if (pv?.kind === "opening") {
        const r = addOpening(doc, pv.opening, pv.wall, pv.at);
        if (r.id) onCommit(r.doc, { kind: "opening", id: r.id });
      } else onNotice("Tocá sobre una pared para ponerla.");
    }
  };

  const onCancel = (e: ReactPointer<HTMLDivElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    gesture.current = null;
    setPreview(null);
  };

  const cursor = tool === "pan" ? "grab" : tool === "select" ? "default" : tool === "name" || tool === "erase" ? "pointer" : "crosshair";
  const scaleM = scaleBarMeters(ppm);
  const drawable = (k: "exterior" | "interior" | "stray") => (shown.contour ? k : "draft");

  const grid = (
    <defs>
      <pattern id={`${gridId}-m`} width="1" height="1" patternUnits="userSpaceOnUse">
        <path d="M 1 0 L 0 0 0 1" fill="none" stroke="var(--border)" strokeWidth={1 / ppm} />
      </pattern>
      <pattern id={`${gridId}-5`} width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--foreground)" strokeOpacity="0.22" strokeWidth={1.4 / ppm} />
      </pattern>
    </defs>
  );

  const sel = selection?.kind === "wall" ? shownDoc.walls.find((w) => w.id === selection.id) : undefined;
  const selOpening = selection?.kind === "opening" ? shown.openings.find((o) => o.id === selection.id) : undefined;
  const label = (x: number, z: number, text: string, size = 12, extra: Record<string, string | number> = {}): ReactNode => (
    <text x={x} y={z} fontSize={size / ppm} textAnchor="middle" fill="var(--foreground)" stroke="var(--background)" strokeWidth={3.2 / ppm} paintOrder="stroke" pointerEvents="none" {...extra}>{text}</text>
  );

  let previewOpening: PlacedOpening | null = null;
  if (preview?.kind === "opening") {
    const w = shownDoc.walls.find((v) => v.id === preview.wall);
    if (w) {
      const d = unitOf(w.a, w.b);
      previewOpening = { id: "preview", kind: preview.opening, type: null, segment: null, offset: 0, width: openingWidth(preview.opening, true), center: { x: w.a.x + d.x * preview.at, z: w.a.z + d.z * preview.at }, dir: d, inward: { x: -d.z, z: d.x }, exterior: true, problem: null };
    }
  }

  return (
    <div
      ref={host}
      className="plan-canvas relative h-full w-full select-none overflow-hidden touch-none bg-background"
      style={{ cursor }}
      role="group"
      aria-label="Lienzo del plano. Usá las herramientas de arriba y los campos de abajo para medidas exactas."
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onPointerLeave={(e) => { if (e.pointerType === "mouse" && !gesture.current) setPreview(null); }}
    >
      {view && size.w > 0 && (
        <svg className="absolute inset-0 h-full w-full" viewBox={viewBox(view, size.w, size.h)} role="img" aria-label={`Plano de ${shown.rooms.length} ambientes, ${squareMeters(shown.area)}`}>
          {grid}
          {ppm >= 14 && <rect x={view.cx - size.w / ppm} y={view.cz - size.h / ppm} width={(size.w * 2) / ppm} height={(size.h * 2) / ppm} fill={`url(#${gridId}-m)`} pointerEvents="none" />}
          <rect x={view.cx - size.w / ppm} y={view.cz - size.h / ppm} width={(size.w * 2) / ppm} height={(size.h * 2) / ppm} fill={`url(#${gridId}-5)`} pointerEvents="none" />

          {shown.rooms.map((r, i) => (
            <path key={r.room.id} d={[r.room.polygon, ...(r.room.holes ?? [])].map((ring) => `M ${ring.map((q) => `${q.x} ${q.z}`).join(" L ")} Z`).join(" ")} fillRule="evenodd" fill="var(--primary)" fillOpacity={i % 2 ? 0.1 : 0.05} pointerEvents="none" />
          ))}

          {sel && <line x1={sel.a.x} y1={sel.a.z} x2={sel.b.x} y2={sel.b.z} stroke="var(--primary)" strokeOpacity="0.4" strokeWidth={Math.max(0.3, 12 / ppm)} strokeLinecap="round" pointerEvents="none" />}
          {selOpening && <circle cx={selOpening.center.x} cy={selOpening.center.z} r={selOpening.width / 2 + 0.2} fill="var(--primary)" fillOpacity="0.22" pointerEvents="none" />}

          {shown.pieces.map((pc, i) => {
            const k = drawable(pc.kind), t = k === "exterior" ? PLAN.exteriorLine : PLAN.interiorLine;
            return <line key={i} x1={pc.a.x} y1={pc.a.z} x2={pc.b.x} y2={pc.b.z} stroke={k === "stray" ? "var(--destructive)" : "var(--foreground)"} strokeOpacity={k === "interior" ? 0.85 : 1} strokeDasharray={k === "stray" ? `${6 / ppm} ${4 / ppm}` : undefined} strokeWidth={Math.max(t, 3 / ppm)} strokeLinecap="square" pointerEvents="none" />;
          })}

          {shown.openings.map((o) => {
            const g = openingGlyph(o, o.exterior ? PLAN.exteriorLine : PLAN.interiorLine), color = o.problem ? "var(--destructive)" : "var(--foreground)";
            const w = Math.max(g.cut.width, 4 / ppm);
            return (
              <g key={o.id} pointerEvents="none">
                <line x1={g.cut.x1} y1={g.cut.z1} x2={g.cut.x2} y2={g.cut.z2} stroke="var(--background)" strokeWidth={w} />
                {g.lines.map((l, i) => <line key={i} x1={l.x1} y1={l.z1} x2={l.x2} y2={l.z2} stroke={color} strokeWidth={Math.max(0.025, 1.6 / ppm)} />)}
                {g.leaf && <line x1={g.leaf.x1} y1={g.leaf.z1} x2={g.leaf.x2} y2={g.leaf.z2} stroke={color} strokeWidth={Math.max(0.035, 2 / ppm)} />}
                {g.arc && <path d={g.arc} fill="none" stroke={color} strokeWidth={Math.max(0.02, 1.3 / ppm)} strokeDasharray={`${5 / ppm} ${4 / ppm}`} />}
                {o.problem && <circle cx={o.center.x} cy={o.center.z} r={9 / ppm} fill="none" stroke="var(--destructive)" strokeWidth={2 / ppm} />}
              </g>
            );
          })}

          {dims && shown.pieces.map((pc, i) => {
            const len = distance(pc.a, pc.b);
            if (len * ppm < 34) return null;
            const n = pieceNormal(shown, pc), off = (Math.abs(n.x) * 26 + Math.abs(n.z) * 12) / ppm;
            const active = !!sel && pc.sources.includes(sel.id);
            return <g key={`d${i}`}>{label((pc.a.x + pc.b.x) / 2 + n.x * off, (pc.a.z + pc.b.z) / 2 + n.z * off + 4 / ppm, meters(len), active ? 13 : 11, active ? { fontWeight: 700, fill: "var(--primary)" } : { fillOpacity: 0.8 })}</g>;
          })}

          {shown.rooms.map((r) => {
            const name = r.label?.text, b = boxOf(r.room.polygon)!;
            const wpx = (b.maxX - b.minX) * ppm, fs = Math.min(13, Math.max(8, wpx / Math.max(6, (name?.length ?? 6) * 0.72)));
            if (wpx < 46 || (b.maxZ - b.minZ) * ppm < 34) return null;
            return (
              <g key={`n${r.room.id}`}>
                {name && label(r.room.center.x, r.room.center.z - 2 / ppm, name, fs + 1, { fontWeight: 700 })}
                {label(r.room.center.x, r.room.center.z + (name ? (fs + 5) / ppm : 4 / ppm), squareMeters(r.room.area), fs, { fillOpacity: 0.75 })}
              </g>
            );
          })}

          {tool === "select" && nodesOf(shownDoc).map((n, i) => {
            const on = !!sel && (near(sel.a, n) || near(sel.b, n));
            return <circle key={i} cx={n.x} cy={n.z} r={(on ? 8 : 6) / ppm} fill={on ? "var(--primary)" : "var(--background)"} stroke="var(--primary)" strokeWidth={2 / ppm} pointerEvents="none" />;
          })}

          {preview?.kind === "wall" && (
            <g pointerEvents="none">
              {preview.guide.x !== undefined && <line x1={preview.guide.x} y1={view.cz - size.h / ppm} x2={preview.guide.x} y2={view.cz + size.h / ppm} stroke="var(--primary)" strokeOpacity="0.5" strokeWidth={1 / ppm} strokeDasharray={`${4 / ppm} ${4 / ppm}`} />}
              {preview.guide.z !== undefined && <line x1={view.cx - size.w / ppm} y1={preview.guide.z} x2={view.cx + size.w / ppm} y2={preview.guide.z} stroke="var(--primary)" strokeOpacity="0.5" strokeWidth={1 / ppm} strokeDasharray={`${4 / ppm} ${4 / ppm}`} />}
              <line x1={preview.a.x} y1={preview.a.z} x2={preview.b.x} y2={preview.b.z} stroke="var(--primary)" strokeWidth={Math.max(0.1, 4 / ppm)} strokeLinecap="round" strokeDasharray={`${8 / ppm} ${5 / ppm}`} />
              <circle cx={preview.a.x} cy={preview.a.z} r={5 / ppm} fill="var(--primary)" />
              <circle cx={preview.b.x} cy={preview.b.z} r={6 / ppm} fill="var(--primary)" />
              {label(preview.b.x, preview.b.z - 44 / ppm, meters(distance(preview.a, preview.b)), 15, { fontWeight: 700, fill: "var(--primary)" })}
            </g>
          )}
          {preview?.kind === "rect" && (
            <g pointerEvents="none">
              <rect x={Math.min(preview.a.x, preview.b.x)} y={Math.min(preview.a.z, preview.b.z)} width={Math.abs(preview.b.x - preview.a.x)} height={Math.abs(preview.b.z - preview.a.z)} fill="var(--primary)" fillOpacity="0.12" stroke="var(--primary)" strokeWidth={Math.max(0.1, 4 / ppm)} strokeDasharray={`${8 / ppm} ${5 / ppm}`} />
              {label((preview.a.x + preview.b.x) / 2, (preview.a.z + preview.b.z) / 2, `${fmtDims(preview.a, preview.b)} · ${squareMeters(Math.abs((preview.b.x - preview.a.x) * (preview.b.z - preview.a.z)))}`, 13, { fontWeight: 700, fill: "var(--primary)" })}
            </g>
          )}
          {previewOpening && (() => {
            const g = openingGlyph(previewOpening, PLAN.interiorLine);
            return (
              <g pointerEvents="none" opacity="0.9">
                <line x1={g.cut.x1} y1={g.cut.z1} x2={g.cut.x2} y2={g.cut.z2} stroke="var(--primary)" strokeOpacity="0.35" strokeWidth={Math.max(0.3, 10 / ppm)} />
                {g.lines.map((l, i) => <line key={i} x1={l.x1} y1={l.z1} x2={l.x2} y2={l.z2} stroke="var(--primary)" strokeWidth={2 / ppm} />)}
                {g.leaf && <line x1={g.leaf.x1} y1={g.leaf.z1} x2={g.leaf.x2} y2={g.leaf.z2} stroke="var(--primary)" strokeWidth={2.5 / ppm} />}
                {g.arc && <path d={g.arc} fill="none" stroke="var(--primary)" strokeWidth={1.5 / ppm} strokeDasharray={`${5 / ppm} ${4 / ppm}`} />}
                {preview?.kind === "opening" && label(previewOpening.center.x, previewOpening.center.z - 34 / ppm, `a ${meters(preview.at)} del inicio`, 12, { fontWeight: 700, fill: "var(--primary)" })}
              </g>
            );
          })()}
          {preview?.kind === "hover" && (
            <g pointerEvents="none">
              {pen && <line x1={pen.x} y1={pen.z} x2={preview.p.x} y2={preview.p.z} stroke="var(--primary)" strokeWidth={Math.max(0.08, 3 / ppm)} strokeDasharray={`${8 / ppm} ${5 / ppm}`} />}
              <circle cx={preview.p.x} cy={preview.p.z} r={5 / ppm} fill="var(--primary)" fillOpacity="0.6" />
              {pen && label((pen.x + preview.p.x) / 2, (pen.z + preview.p.z) / 2 - 12 / ppm, meters(distance(pen, preview.p)), 13, { fontWeight: 700, fill: "var(--primary)" })}
            </g>
          )}
          {tool === "wall" && pen && (
            <g pointerEvents="none">
              <circle cx={pen.x} cy={pen.z} r={13 / ppm} fill="var(--primary)" fillOpacity="0.18" className="motion-safe:animate-pulse" />
              <circle cx={pen.x} cy={pen.z} r={6 / ppm} fill="var(--primary)" />
            </g>
          )}
        </svg>
      )}

      <div className="pointer-events-none absolute bottom-2 left-3 flex items-end gap-2 text-[11px] text-foreground/75">
        <div>
          <div className="h-2 border-x-2 border-b-2 border-foreground/70" style={{ width: scaleM * ppm }} aria-hidden="true" />
          <span className="font-medium">{String(scaleM).replace(".", ",")} m</span>
          <span className="ml-2 hidden sm:inline">Medidas reales: 1 m del plano = 1 m de obra</span>
        </div>
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <Button size="icon" variant="secondary" className="h-11 w-11" aria-label="Acercar plano" title="Acercar" onClick={() => setView((v) => (v ? zoomAt(v, size.w, size.h, 1.3, { x: size.w / 2, y: size.h / 2 }) : v))}><Plus size={16} /></Button>
        <Button size="icon" variant="secondary" className="h-11 w-11" aria-label="Alejar plano" title="Alejar" onClick={() => setView((v) => (v ? zoomAt(v, size.w, size.h, 1 / 1.3, { x: size.w / 2, y: size.h / 2 }) : v))}><Minus size={16} /></Button>
        <Button size="icon" variant="secondary" className="h-11 w-11" aria-label="Ver todo el plano" title="Ver todo el plano" onClick={() => setView(fitView(boxOf(allPoints()), size.w, size.h))}><Focus size={16} /></Button>
      </div>
    </div>
  );
});
