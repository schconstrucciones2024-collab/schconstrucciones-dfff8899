import { useRef, useState, type PointerEvent } from 'react';
import { Check, Focus, Hand, MousePointer2, Pencil, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { bounds, detectRooms, stairGeometry, distance, exteriorSegments, magnet, polygonArea, presetPolygon, validateContour, type Footprint, type Point } from '@/config/geometry';
import { endpointAtLength, followContour, moveCorner, pencilPoint, resizeExterior } from '@/config/wallEditing';
import { designWalls, roomName, suggestedLayout, useConfigurator } from '@/store/useConfigurator';

type Mode = 'edit' | 'draw' | 'erase' | 'pan';
type Gesture = { pointer: number; start: Point; corner: number | undefined; pan: Point | undefined; moved: boolean; stair?: { id: string; x: number; z: number } };

export default function PlanEditor({ resetKey }: { resetKey: number }) {
  const s = useConfigurator(), c = s.config, exterior = s.tool === 'contour';
  const [mode, setMode] = useState<Mode>('edit'), [draft, setDraft] = useState<Point[]>([]),
    [hover, setHover] = useState<Point | null>(null), [preview, setPreview] = useState<Point[] | null>(null),
    [pan, setPan] = useState<Point>({ x: 0, z: 0 }), [zoom, setZoom] = useState(1),
    [confirm, setConfirm] = useState<Point[] | null>(null), [stairMove, setStairMove] = useState<{ id: string; x: number; z: number } | null>(null), [length, setLength] = useState('');
  const svg = useRef<SVGSVGElement>(null), gesture = useRef<Gesture | null>(null);
  const contour = preview ?? c.contour, walls = designWalls(c, s.activeFloor),
    selected = walls.find(w => w.id === s.selectedId), index = selected?.id.startsWith('edge-') ? Number(selected.id.slice(5)) : -1,
    b = bounds(c.contour), extent = Math.max(b.width, b.depth, 8) + 5,
    size = extent / zoom, cx = (b.minX + b.maxX) / 2 + pan.x, cz = (b.minZ + b.maxZ) / 2 + pan.z,
    vb = `${cx - size / 2} ${cz - size / 2} ${size} ${size}`,
    rooms = detectRooms(c.contour, c.walls[s.activeFloor] ?? []);
  const point = (e: PointerEvent<SVGSVGElement>): Point => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, z: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: p.x, z: p.y };
  };
  const choose = (id: string) => {
    s.select(id);
    const w = walls.find(w => w.id === id);
    setLength(w ? distance(w.a, w.b).toFixed(2) : '');
  };
  const applyContour = (next: Point[]) => {
    const error = validateContour(next, c.floors);
    if (error) { s.setError(error); return; }
    s.update({ contour: next, walls: c.walls.map(ws => ws.map(w => ({ ...w, a: followContour(w.a, c.contour, next), b: followContour(w.b, c.contour, next) }))) });
  };
  const finishShape = () => {
    let next = draft;
    const first = next[0], last = next.at(-1);
    if (c.orthogonal && first && last && Math.abs(first.x - last.x) > 1e-7 && Math.abs(first.z - last.z) > 1e-7)
      next = [...next, { x: first.x, z: last.z }];
    const error = validateContour(next, c.floors);
    if (error) { s.setError(error); return; }
    setConfirm(next);
  };
  const addPoint = (p: Point) => {
    const last = draft.at(-1), first = draft[0];
    if (exterior && first && draft.length >= 3 && distance(p, first) < size * 0.025) { finishShape(); return; }
    const q = exterior ? pencilPoint(p, last, c.orthogonal) : magnet(p, walls, c.orthogonal ? last : undefined);
    if (last && distance(last, q) < 0.2) return;
    if (!exterior && last) {
      s.addWall(last, q);
      if (!useConfigurator.getState().error) { setDraft([]); setHover(null); }
    } else setDraft([...draft, q]);
  };
  const erase = () => {
    if (!selected) return;
    if (index >= 0) {
      const next = c.contour.filter((_, i) => i !== (index + 1) % c.contour.length);
      s.setContour(next);
    } else s.deleteObject(selected.id);
  };
  const saveLength = () => {
    if (!selected) return;
    const n = Number(length);
    if (!Number.isFinite(n) || n <= 0) { s.setError('Ingresá un largo válido en metros.'); return; }
    if (index >= 0) applyContour(resizeExterior(c.contour, index, n, c.orthogonal));
    else s.editWall(selected.id, { b: endpointAtLength(selected.a, selected.b, n) });
  };
  const changeMode = (v: Mode) => { setMode(v); setDraft([]); setHover(null); s.setError(null); };
  const drawCandidate = draft.length ? [...draft, ...(hover ? [hover] : [])] : [];
  return (
    <div className="plan-editor flex h-full min-h-0 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        {([{ id: 'edit', name: 'Editar pared', Icon: MousePointer2 }, { id: 'draw', name: exterior ? 'Dibujar forma' : 'Agregar pared', Icon: Pencil }, { id: 'erase', name: 'Quitar pared', Icon: Trash2 }, { id: 'pan', name: 'Mover plano', Icon: Hand }] as const).map(({ id, name, Icon }) => (
          <Button key={id} variant={mode === id ? 'default' : 'outline'} className="h-11 gap-1.5 px-2 text-xs" aria-label={name} aria-pressed={mode === id} onClick={() => changeMode(id)} title={name}><Icon size={16} />{id !== 'pan' && name}</Button>
        ))}
        {exterior && <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={c.orthogonal} onChange={e => s.update({ orthogonal: e.target.checked })} />Ángulos rectos</label>}
      </div>
      <div className="relative min-h-0 flex-1">
        <svg ref={svg} viewBox={vb} className="plan-canvas h-full w-full touch-none" aria-label="Plano de paredes en metros" role="img"
          onPointerDown={e => {
            if (!e.isPrimary) return;
            const p = point(e), target = e.target as SVGElement, corner = target.dataset['corner'], stairId = target.dataset['stair'];
            const st = mode === 'edit' && stairId ? c.stairs.find(v => v.id === stairId) : undefined;
            if (st) s.select(st.id);
            gesture.current = { pointer: e.pointerId, start: p, corner: corner === undefined ? undefined : Number(corner), pan: mode === 'pan' ? pan : undefined, moved: false, ...(st && !st.locked ? { stair: { id: st.id, x: st.x, z: st.z } } : {}) };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e => {
            const p = point(e), g = gesture.current;
            if (mode === 'draw') setHover(exterior ? pencilPoint(p, draft.at(-1), c.orthogonal) : magnet(p, walls, c.orthogonal ? draft.at(-1) : undefined));
            if (!g || g.pointer !== e.pointerId) return;
            if (distance(p, g.start) > size * 0.012) g.moved = true;
            if (g.corner !== undefined && mode === 'edit') setPreview(moveCorner(c.contour, g.corner, pencilPoint(p), c.orthogonal));
            if (g.stair && g.moved) setStairMove({ id: g.stair.id, x: Math.round((g.stair.x + p.x - g.start.x) * 20) / 20, z: Math.round((g.stair.z + p.z - g.start.z) * 20) / 20 });
            if (g.pan) setPan({ x: g.pan.x - (p.x - g.start.x), z: g.pan.z - (p.z - g.start.z) });
          }}
          onPointerUp={e => {
            const g = gesture.current;
            if (!g || g.pointer !== e.pointerId) return;
            const p = point(e);
            if (g.stair && g.moved && stairMove) s.editStair(stairMove.id, { x: stairMove.x, z: stairMove.z });
            else if (g.corner !== undefined && mode === 'edit' && g.moved) applyContour(moveCorner(c.contour, g.corner, pencilPoint(p), c.orthogonal));
            else if (mode === 'draw') {
              if (g.moved && !draft.length) {
                const a = exterior ? pencilPoint(g.start) : magnet(g.start, walls), q = exterior ? pencilPoint(p, a, c.orthogonal) : magnet(p, walls, c.orthogonal ? a : undefined);
                if (distance(a, q) >= 0.2) {
                  if (exterior) setDraft([a, q]); else s.addWall(a, q);
                }
              } else addPoint(p);
            }
            gesture.current = null; setPreview(null); setStairMove(null);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => { gesture.current = null; setPreview(null); setStairMove(null); }}>
          <defs><pattern id={`metric-grid-${resetKey}`} width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" className="plan-grid" fill="none" strokeWidth="0.012" /></pattern></defs>
          <rect x={cx - size / 2} y={cz - size / 2} width={size} height={size} fill={`url(#metric-grid-${resetKey})`} />
          <polygon points={contour.map(p => `${p.x},${p.z}`).join(' ')} className="plan-floor" />
          {rooms.map((r, i) => <g key={r.id} className="plan-label" pointerEvents="none"><title>{roomName(c, s.activeFloor, r, i)} · {r.area.toFixed(2)} m²</title></g>)}
          {[...exteriorSegments(contour), ...(c.walls[s.activeFloor] ?? [])].map((w, i) => {
            const active = selected?.id === w.id, outer = w.id.startsWith('edge-');
            return <g key={w.id} className={active ? 'plan-wall-selected' : 'plan-wall'}>
              <line x1={w.a.x} y1={w.a.z} x2={w.b.x} y2={w.b.z} strokeWidth={active ? 0.14 : 0.09} />
              <line data-wall={w.id} x1={w.a.x} y1={w.a.z} x2={w.b.x} y2={w.b.z} stroke="transparent" strokeWidth={size * 0.07}
                onPointerDown={e => { if (mode === 'draw' || mode === 'pan') return; choose(w.id); if (mode === 'erase') { if (outer) s.setContour(c.contour.filter((_, n) => n !== (i + 1) % c.contour.length)); else s.deleteObject(w.id); } }} />
              <text x={(w.a.x + w.b.x) / 2} y={(w.a.z + w.b.z) / 2 - size * 0.025} textAnchor="middle" fontSize={size * 0.025} pointerEvents="none" className="plan-dimension">{distance(w.a, w.b).toFixed(2)} m</text>
            </g>;
          })}
          {c.stairs.filter(v => !v.exterior && v.floor === s.activeFloor - 1).map(v => <polygon key={`hole-${v.id}`} points={stairGeometry(v, 2.85).hole.map(p => `${p.x},${p.z}`).join(' ')} className="plan-stair-hole" fill="none" strokeWidth="0.05" strokeDasharray="0.12 0.08" pointerEvents="none" />)}
          {c.stairs.filter(v => !v.exterior && v.floor === s.activeFloor).map(v => {
            const m = stairMove?.id === v.id ? { ...v, ...stairMove } : v, g = stairGeometry(m, 2.85), active = s.selectedId === v.id;
            const tf = (q: { x: number; z: number }) => ({ x: m.x + q.x * Math.cos(m.rotation) - q.z * Math.sin(m.rotation), z: m.z + q.x * Math.sin(m.rotation) + q.z * Math.cos(m.rotation) });
            return <g key={v.id} className={active ? 'plan-stair plan-stair-selected' : 'plan-stair'}>
              <polygon data-stair={v.id} points={g.footprint.map(p => `${p.x},${p.z}`).join(' ')} strokeWidth={active ? 0.06 : 0.035} style={{ cursor: v.locked ? 'not-allowed' : 'move' }}><title>Escalera · arrastrala para moverla</title></polygon>
              {g.steps.map((t, i) => { const p = tf(t), r = m.rotation + t.rotation, w = t.width / 2; return <line key={i} pointerEvents="none" x1={p.x - Math.cos(r) * w} y1={p.z - Math.sin(r) * w} x2={p.x + Math.cos(r) * w} y2={p.z + Math.sin(r) * w} strokeWidth="0.02" />; })}
              <polygon points={g.hole.map(p => `${p.x},${p.z}`).join(' ')} fill="none" strokeWidth="0.03" strokeDasharray="0.1 0.06" pointerEvents="none" />
            </g>;
          })}
          {exterior && mode === 'edit' && contour.map((p, i) => <circle key={i} data-corner={i} cx={p.x} cy={p.z} r={size * 0.026} className="plan-corner" />)}
          {drawCandidate.length > 0 && <g className="plan-draft" pointerEvents="none"><polyline points={drawCandidate.map(p => `${p.x},${p.z}`).join(' ')} fill="none" strokeWidth="0.08" strokeDasharray="0.15 0.08" />{draft.map((p, i) => <circle key={i} cx={p.x} cy={p.z} r={size * 0.016} />)}{drawCandidate.length > 1 && (() => { const a = drawCandidate.at(-2), v = drawCandidate.at(-1); if (!a || !v) return null; return <text x={(a.x + v.x) / 2} y={(a.z + v.z) / 2 - size * 0.04} textAnchor="middle" fontSize={size * 0.03}>{distance(a, v).toFixed(2)} m</text>; })()}</g>}
        </svg>
        <div className="pointer-events-none absolute bottom-2 left-3 text-xs text-foreground/70">1 cuadrícula = 1 m · {polygonArea(c.contour).toFixed(2)} m²</div>
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          <Button size="icon" variant="secondary" className="h-11 w-11" aria-label="Acercar plano" title="Acercar plano" onClick={() => setZoom(Math.min(3, zoom * 1.2))}><Plus size={16} /></Button>
          <Button size="icon" variant="secondary" className="h-11 w-11" aria-label="Alejar plano" title="Alejar plano" onClick={() => setZoom(Math.max(0.5, zoom / 1.2))}>−</Button>
          <Button size="icon" variant="secondary" className="h-11 w-11" aria-label="Centrar plano" title="Centrar plano" onClick={() => { setPan({ x: 0, z: 0 }); setZoom(1); }}><Focus size={16} /></Button>
        </div>
        <div className="absolute bottom-8 left-3 flex gap-1">
          <Button size="icon" variant="secondary" className="h-11 w-11" disabled={!s.past.length} aria-label="Deshacer edición" title="Deshacer edición" onClick={s.undo}><Undo2 size={16} /></Button>
          <Button size="icon" variant="secondary" className="h-11 w-11" disabled={!s.future.length} aria-label="Rehacer edición" title="Rehacer edición" onClick={s.redo}><Redo2 size={16} /></Button>
        </div>
      </div>
      <div className="border-t border-border px-3 py-2">
        {mode === 'draw' ? <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-foreground/70">{exterior ? `${draft.length} esquinas` : draft.length ? 'Inicio marcado' : 'Pared interior'}</span>
          {exterior && <Button className="min-h-11 gap-1 text-xs" disabled={draft.length < 3} onClick={finishShape}><Check size={16} />Cerrar forma</Button>}
          <Button variant="outline" size="icon" className="h-11 w-11" disabled={!draft.length} aria-label="Deshacer trazo" title="Deshacer trazo" onClick={() => setDraft(draft.slice(0, -1))}><Undo2 size={16} /></Button>
          <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Cancelar dibujo" title="Cancelar dibujo" onClick={() => changeMode('edit')}><X size={16} /></Button>
        </div> : <>
          <label className="flex items-center gap-2 text-xs">Pared<select className="config-input min-w-0 flex-1" aria-label="Elegir pared" value={selected?.id ?? ''} onChange={e => choose(e.target.value)}><option value="">Elegir pared</option>{walls.map((w, i) => <option key={w.id} value={w.id}>{w.id.startsWith('edge-') ? `Exterior ${i + 1}` : `Interior ${i - c.contour.length + 1}`} · {distance(w.a, w.b).toFixed(2)} m</option>)}</select></label>
          {selected && <div className="mt-2 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs">Largo (m)<input className="config-input mt-1" type="number" inputMode="decimal" min={index >= 0 ? 1.5 : 0.2} step="0.01" value={length} onChange={e => setLength(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveLength(); }} /></label><Button className="h-11 gap-1 px-3 text-xs" onClick={saveLength}><Check size={16} />Aplicar</Button><Button variant="outline" size="icon" className="h-11 w-11" aria-label="Quitar pared seleccionada" title="Quitar pared seleccionada" onClick={erase}><Trash2 size={16} /></Button>{index >= 0 && <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Agregar esquina en pared" title="Agregar esquina en pared" onClick={() => { const next = [...c.contour]; next.splice(index + 1, 0, { x: (selected.a.x + selected.b.x) / 2, z: (selected.a.z + selected.b.z) / 2 }); s.setContour(next); }}><Plus size={16} /></Button>}</div>}
          {exterior && !selected && <label className="mt-2 flex items-center gap-2 text-xs">Forma<select className="config-input min-w-0 flex-1" aria-label="Forma inicial" value="" onChange={e => { if (e.target.value) setConfirm(presetPolygon(e.target.value as Footprint, c.m2 / c.floors)); }}><option value="">Elegir forma inicial</option>{(['rectangular', 'L', 'U', 'T', 'escalonada'] as Footprint[]).map(v => <option key={v} value={v}>{v === 'rectangular' ? 'Rectangular' : v === 'escalonada' ? 'Escalonada' : `En ${v}`}</option>)}</select></label>}
        </>}
        <div role="status" aria-live="polite" className="mt-1 text-xs text-destructive">{s.error}</div>
      </div>
      <AlertDialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null); }}><AlertDialogContent><AlertDialogTitle>¿Usar esta nueva forma?</AlertDialogTitle><AlertDialogDescription>Se reemplazará la distribución interior y se generarán de nuevo los ambientes y las aberturas. Podés recuperar tu diseño anterior con Deshacer.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel><AlertDialogAction className="min-h-11" onClick={() => { if (!confirm) return; s.replaceDesign(suggestedLayout({ ...c, contour: confirm, m2: polygonArea(confirm) * c.floors, walls: Array.from({ length: c.floors }, () => []), stairs: [], openings: [] })); if (!useConfigurator.getState().error) { setDraft([]); setHover(null); setMode('edit'); setPan({ x: 0, z: 0 }); setZoom(1); } }}>Usar forma</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}