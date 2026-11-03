import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/store/useConfigurator";
import { reviewStairs, type StairAdvice } from "@/lib/stairAssistant.functions";
import { resolveProposal, stairDesignSummary } from "@/store/stairAdvice";

/** Lets the client describe where they want the stairs; the AI reviews conflicts and proposes a validated spot. */
export function StairAssistant() {
  const s = useConfigurator(), review = useServerFn(reviewStairs);
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<StairAdvice | null>(null), [applied, setApplied] = useState<string | null>(null);
  const hasInterior = s.config.stairs.some((v) => !v.exterior);
  const ask = async () => {
    setBusy(true); setError(null); setAdvice(null); setApplied(null);
    try {
      const r = await review({ data: { request: text, design: stairDesignSummary(s.config) } });
      if (r.ok) setAdvice(r.advice); else setError(r.error);
    } catch { setError("No pudimos consultar al asistente. Probá de nuevo."); }
    finally { setBusy(false); }
  };
  const apply = (i: number) => {
    const p = advice?.proposals[i]; if (!p) return;
    const r = resolveProposal(s.config, p);
    if (!r) { setApplied("No encontramos un lugar libre para esa escalera. Probá con otro pedido."); return; }
    const { id: _id, ...patch } = r.stair;
    if (s.editStair(p.stairId, patch)) {
      s.setFloor(r.stair.floor); s.select(r.stair.id);
      setApplied(r.adjusted ? "La propuesta chocaba con algo; la acomodamos en el lugar libre más cercano." : "Escalera ubicada.");
    } else setApplied("No se pudo aplicar la propuesta.");
  };
  if (!hasInterior) return null;
  return (
    <div className="col-span-2 mt-2 space-y-2 rounded-md border border-border p-2">
      <p className="text-xs font-medium text-foreground">Asistente de escaleras</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={800} rows={3}
        placeholder="Ej.: quiero la escalera contra la pared del fondo, lejos de la cocina"
        className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground" />
      <Button className="min-h-11 w-full text-xs" disabled={busy || text.trim().length < 3} onClick={ask}>
        {busy ? "Revisando diseño…" : "Revisar y proponer ubicación"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {advice && (
        <div className="space-y-2 text-xs text-foreground">
          <p>{advice.summary}</p>
          {advice.conflicts.length > 0 && <ul className="list-disc pl-4 text-muted-foreground">{advice.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {advice.proposals.map((p, i) => (
            <div key={i} className="rounded border border-border p-2">
              <p className="text-muted-foreground">{p.reason}</p>
              <Button variant="outline" className="mt-1 min-h-10 w-full text-xs" onClick={() => apply(i)}>Aplicar propuesta {i + 1}</Button>
            </div>
          ))}
          {applied && <p className="text-muted-foreground">{applied} Podés deshacer si no te gusta.</p>}
        </div>
      )}
    </div>
  );
}
