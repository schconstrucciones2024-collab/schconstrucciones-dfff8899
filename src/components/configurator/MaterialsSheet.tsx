import { useEffect, useRef } from 'react';
import { drawMaterial, FINISH_MATERIALS, MATERIAL_NAMES, materialTextureUrl, type FinishId, type MaterialKind } from '@/config/materials';
function Swatch({ kind, label }: { kind: MaterialKind; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.drawImage(drawMaterial(kind, 128), 0, 0, 128, 128); // provisorio hasta que llega la textura real
    let alive = true; const img = new Image();
    img.onload = () => { if (alive) ctx.drawImage(img, 0, 0, 128, 128); };
    img.src = materialTextureUrl(kind, 'albedo', true);
    return () => { alive = false; };
  }, [kind]);
  return <div className="min-w-0"><canvas ref={ref} width={128} height={128} className="mb-2 aspect-square w-full rounded border border-border" aria-label={MATERIAL_NAMES[kind]} /><span className="block text-xs text-primary">{label}</span><span className="mt-1 block text-[11px] leading-5 text-foreground/70">{MATERIAL_NAMES[kind]}</span></div>;
}
export function MaterialsSheet({ finish }: { finish: FinishId }) {
  const f = FINISH_MATERIALS[finish]; return <div className="mt-5 grid grid-cols-2 gap-4"><Swatch kind={f.wall} label="Pared" /><Swatch kind={f.ceiling} label="Cielorraso" /><Swatch kind={f.floor} label="Piso" /><Swatch kind={f.siding} label="Exterior" /></div>;
}
