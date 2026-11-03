import { useMemo, useState } from 'react';
import { ArrowRight, BedDouble, Bath, Check, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { LAYOUT_PROPOSALS, type LayoutProposal } from '@/config/layoutProposals';
import { bounds, detectRooms } from '@/config/geometry';
import { buildLayoutProposal, designWalls, useConfigurator, type HouseConfig } from '@/store/useConfigurator';

function Preview({ config }: { config: HouseConfig }) {
  const b = bounds(config.contour), rooms = detectRooms(config.contour, config.walls[0] ?? []);
  return <svg viewBox={`${b.minX - 0.4} ${b.minZ - 0.4} ${b.width + 0.8} ${b.depth + 0.8}`} className="h-56 w-full bg-secondary" role="img" aria-label="Planta de la distribución">
    <polygon points={config.contour.map(p => `${p.x},${p.z}`).join(' ')} fill="var(--background)" />
    {rooms.map(r => <polygon key={r.id} points={r.polygon.map(p => `${p.x},${p.z}`).join(' ')} fill={(config.roomLabels[r.id] ?? '').startsWith('Baño') ? 'var(--scene-glass)' : (config.roomLabels[r.id] ?? '').startsWith('Dormitorio') ? 'var(--scene-fabric)' : 'var(--secondary)'} fillOpacity="0.4" />)}
    {designWalls(config, 0).map(w => <line key={w.id} x1={w.a.x} y1={w.a.z} x2={w.b.x} y2={w.b.z} stroke="var(--foreground)" strokeWidth="0.09" />)}
    {config.openings.map(o => { const w = designWalls(config, 0).find(w => w.id === o.wall); if (!w) return null; const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z), t = 0.5 + o.offset / len, x = w.a.x + (w.b.x - w.a.x) * t, z = w.a.z + (w.b.z - w.a.z) * t, dx = (w.b.x - w.a.x) / len * 0.4, dz = (w.b.z - w.a.z) / len * 0.4; return <line key={o.id} x1={x - dx} y1={z - dz} x2={x + dx} y2={z + dz} stroke="var(--primary)" strokeWidth="0.18" />; })}
    {config.fixtures.map(f => f.kind === 'cama' ? <rect key={f.id} x={f.x - 0.7} y={f.z - 0.95} width="1.4" height="1.9" fill="var(--foreground)" fillOpacity="0.8" rx="0.05" /> : f.kind === 'ducha' ? <rect key={f.id} x={f.x - 0.45} y={f.z - 0.45} width="0.9" height="0.9" fill="var(--scene-glass)" stroke="var(--foreground)" strokeWidth="0.04" /> : <ellipse key={f.id} cx={f.x} cy={f.z} rx="0.2" ry="0.35" fill="var(--foreground)" />)}
    {config.counters.map(v => <rect key={v.id} x={v.x - v.length / 2} y={v.z - v.depth / 2} width={v.length} height={v.depth} transform={`rotate(${v.rotation * 180 / Math.PI} ${v.x} ${v.z})`} fill="var(--primary)" />)}
  </svg>;
}

export function LayoutGallery() {
  const s = useConfigurator(), [open, setOpen] = useState(false), [pending, setPending] = useState<LayoutProposal | null>(null);
  const options = useMemo(() => LAYOUT_PROPOSALS.map(p => ({ proposal: p, config: buildLayoutProposal(s.config, p) })), [s.config]);
  return <>
    <Button variant="outline" className="min-h-11 gap-2 text-xs" onClick={() => setOpen(true)}><LayoutTemplate size={16} />Distribuciones</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90svh] max-w-5xl overflow-y-auto p-4 sm:p-6">
      <DialogTitle className="pr-7 font-display text-2xl">Elegí tu distribución</DialogTitle>
      <DialogDescription className="text-foreground/70">Cuatro propuestas de una planta. Recomendación inicial: 72 m² con dos dormitorios para una vivienda familiar.</DialogDescription>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map(({ proposal: p, config }) => <article key={p.id} className="overflow-hidden rounded border border-border">
          <Preview config={config} />
          <div className="space-y-3 p-4">
            <h3 className="font-display text-xl">{p.name}</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-primary"><span>{config.m2} m² · {p.width} × {p.depth} m</span><span className="flex items-center gap-1"><BedDouble size={14} />{p.bedrooms}</span><span className="flex items-center gap-1"><Bath size={14} />{p.bathrooms}</span></div>
            <p className="text-xs leading-relaxed text-foreground/75">{p.description}</p>
            <Button variant={p.id === 'familiar' ? 'default' : 'outline'} className="min-h-11 w-full gap-2" onClick={() => setPending(p)}>Elegir {p.name}<ArrowRight size={16} /></Button>
          </div>
        </article>)}
      </div>
      <p className="text-xs leading-relaxed text-foreground/60">Antepropuestas orientativas: la orientación solar, ventilación, terreno, accesibilidad y normativa local requieren revisión profesional antes de construir.</p>
    </DialogContent></Dialog>
    <AlertDialog open={pending !== null} onOpenChange={v => { if (!v) setPending(null); }}><AlertDialogContent><AlertDialogTitle>¿Aplicar {pending?.name}?</AlertDialogTitle><AlertDialogDescription>Se reemplazarán la forma, superficie, plantas y distribución actual. Se mantienen tus terminaciones. Todos los elementos seguirán siendo editables y podés recuperar el diseño anterior con Deshacer.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel><AlertDialogAction className="min-h-11 gap-2" onClick={() => { if (!pending) return; s.replaceDesign(buildLayoutProposal(s.config, pending)); if (useConfigurator.getState().error) return; s.setTool('wall'); s.setView('planta'); setOpen(false); setPending(null); }}><Check size={16} />Aplicar distribución</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}