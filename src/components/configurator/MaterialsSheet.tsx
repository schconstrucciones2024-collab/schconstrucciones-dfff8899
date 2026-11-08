import { useEffect, useRef } from 'react';
import { BATHROOM_MATERIALS, drawMaterial, FINISH_MATERIALS, FINISH_SHEET_TEXT, MATERIAL_NAMES, materialTextureUrl, type FinishId, type MaterialKind } from '@/config/materials';
function Swatch({ kind, label, name }: { kind: MaterialKind; label: string; name?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const text = name ?? MATERIAL_NAMES[kind];
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.drawImage(drawMaterial(kind, 128), 0, 0, 128, 128); // provisorio hasta que llega la textura real
    let alive = true; const img = new Image();
    img.onload = () => { if (alive) ctx.drawImage(img, 0, 0, 128, 128); };
    img.src = materialTextureUrl(kind, 'albedo', true);
    return () => { alive = false; };
  }, [kind]);
  return <div className="min-w-0"><canvas ref={ref} width={128} height={128} className="mb-2 aspect-square w-full rounded border border-border" aria-label={text} /><span className="block text-xs text-primary">{label}</span><span className="mt-1 block text-[11px] leading-5 text-foreground/70">{text}</span></div>;
}
export function MaterialsSheet({ finish }: { finish: FinishId }) {
  const f = FINISH_MATERIALS[finish], extra = FINISH_SHEET_TEXT[finish], bath = BATHROOM_MATERIALS[finish];
  return (
    <div className="mt-5 grid grid-cols-2 gap-4">
      <Swatch kind={f.wall} label="Pared" name={extra?.names?.wall} />
      <Swatch kind={f.ceiling} label={extra?.ceilingLabel ?? "Cielorraso"} name={extra?.names?.ceiling} />
      <Swatch kind={f.floor} label="Piso" name={extra?.names?.floor} />
      <Swatch kind={f.siding} label="Exterior" name={extra?.names?.siding} />
      {bath && <Swatch kind={bath.floor} label="Baño · piso" />}
      {bath && <Swatch kind={bath.wall} label="Baño · pared" />}
    </div>
  );
}
