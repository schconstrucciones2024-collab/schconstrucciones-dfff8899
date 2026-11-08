import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Bath, BedDouble, Check, LayoutTemplate, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  planArea,
  planFloors,
  planShape,
  plansFor,
  type LayoutProposal,
  type PlanShape,
} from "@/config/layoutProposals";
import { systemOf } from "@/config/systems";
import { SYSTEMS } from "@/lib/cotizador";
import { buildLayoutProposal, useConfigurator, type HouseConfig } from "@/store/useConfigurator";
import { PlanPreview } from "./PlanPreview";

type ShapeFilter = "todas" | PlanShape;
const SHAPES: { id: ShapeFilter; label: string }[] = [
  { id: "todas", label: "Todas las formas" },
  { id: "rectangular", label: "Rectangular" },
  { id: "L", label: "En L" },
];
const floorLabel = (n: number) =>
  n === 1 ? "Planta baja" : n === 2 ? "Planta alta" : "2ª planta alta";
const num = (v: number) => Number(v.toFixed(1)).toString().replace(".", ",");

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 border px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}
    >
      {children}
    </button>
  );
}

function PlanCard({
  plan,
  config,
  onChoose,
}: {
  plan: LayoutProposal;
  config: HouseConfig;
  onChoose: () => void;
}) {
  const [floor, setFloor] = useState(0),
    floors = planFloors(plan),
    shape = planShape(plan);
  return (
    <article className="flex flex-col overflow-hidden rounded border border-border">
      <div className="relative">
        <PlanPreview
          config={config}
          floor={Math.min(floor, floors - 1)}
          className="h-64 w-full bg-secondary"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1 text-[10px] font-semibold uppercase">
          {plan.recommended && (
            <span className="flex items-center gap-1 bg-primary px-2 py-1 text-primary-foreground">
              <Star size={10} aria-hidden="true" />
              Recomendada
            </span>
          )}
          {shape === "L" && <span className="bg-foreground px-2 py-1 text-background">En L</span>}
          <span className="bg-background px-2 py-1 text-foreground">
            {floors} {floors === 1 ? "planta" : "plantas"}
          </span>
        </div>
      </div>
      {floors > 1 && (
        <div
          className="flex border-y border-border"
          role="group"
          aria-label="Planta que se muestra"
        >
          {Array.from({ length: floors }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={floor === i}
              onClick={() => setFloor(i)}
              className={`min-h-11 flex-1 px-2 text-xs ${floor === i ? "bg-foreground text-background" : "bg-background hover:bg-secondary"}`}
            >
              {floorLabel(i + 1)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-1 flex-col space-y-3 p-4">
        <h3 className="font-display text-xl">{plan.name}</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs text-primary">
          <span>
            {num(planArea(plan))} m² cubiertos
            {floors > 1 ? ` · ${num(planArea(plan) / floors)} m² por planta` : ""}
          </span>
          <span className="flex items-center gap-1" title="Dormitorios">
            <BedDouble size={14} aria-hidden="true" />
            {plan.bedrooms}
            <span className="sr-only"> dormitorios</span>
          </span>
          <span className="flex items-center gap-1" title="Baños">
            <Bath size={14} aria-hidden="true" />
            {plan.bathrooms}
            <span className="sr-only"> baños</span>
          </span>
        </div>
        <p className="text-xs leading-relaxed text-foreground/75">{plan.description}</p>
        {plan.notes && plan.notes.length > 0 && (
          <details className="text-xs leading-relaxed text-foreground/75">
            <summary className="min-h-8 cursor-pointer font-semibold text-foreground">
              Criterio de proyecto
            </summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              {plan.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex-1" />
        <Button
          variant={plan.recommended ? "default" : "outline"}
          className="min-h-11 w-full gap-2"
          onClick={onChoose}
        >
          Elegir esta distribución
          <ArrowRight size={16} />
        </Button>
      </div>
    </article>
  );
}

export function LayoutGallery() {
  const s = useConfigurator(),
    [open, setOpen] = useState(false),
    [pending, setPending] = useState<LayoutProposal | null>(null),
    [floors, setFloors] = useState(0),
    [shape, setShape] = useState<ShapeFilter>("todas"),
    system = systemOf(s.config.finish);
  const all = useMemo(() => plansFor(system), [system]);
  const options = useMemo(() => {
    if (!open) return [];
    const base = useConfigurator.getState().config;
    return all
      .filter((p) => (floors === 0 || planFloors(p) === floors) && (shape === "todas" || planShape(p) === shape))
      .sort(
        (a, b) => Number(!!b.recommended) - Number(!!a.recommended) || planArea(a) - planArea(b),
      )
      .map((proposal) => ({ proposal, config: buildLayoutProposal(base, proposal) }));
  }, [all, open, floors, shape]);
  const count = (n: number) => all.filter((p) => planFloors(p) === n).length;
  return (
    <>
      <Button
        variant="outline"
        className="min-h-11 gap-2 text-xs"
        onClick={() => {
          setFloors(0);
          setShape("todas");
          setOpen(true);
        }}
      >
        <LayoutTemplate size={16} />
        Distribuciones
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] max-w-5xl overflow-y-auto p-4 sm:p-6">
          <DialogTitle className="pr-7 font-display text-2xl">Elegí tu distribución</DialogTitle>
          <DialogDescription className="text-foreground/70">
            {all.length} propuestas para {SYSTEMS[system].name}, de una a tres plantas,
            rectangulares y en L. Las marcadas como recomendadas son las que mejor resuelven cada
            caso.
          </DialogDescription>
          <div
            className="flex flex-wrap gap-x-6 gap-y-3"
            role="group"
            aria-label="Filtros de distribuciones"
          >
            <div className="flex flex-wrap gap-1" role="group" aria-label="Cantidad de plantas">
              <Chip active={floors === 0} onClick={() => setFloors(0)}>
                Todas las plantas ({all.length})
              </Chip>
              {[1, 2, 3].map((n) => (
                <Chip key={n} active={floors === n} onClick={() => setFloors(n)}>
                  {n} {n === 1 ? "planta" : "plantas"} ({count(n)})
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Forma de la casa">
              {SHAPES.map((v) => (
                <Chip key={v.id} active={shape === v.id} onClick={() => setShape(v.id)}>
                  {v.label}
                </Chip>
              ))}
            </div>
          </div>
          {options.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground/70">
              No hay propuestas con esa combinación. Probá con otra forma o cantidad de plantas.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {options.map(({ proposal, config }) => (
                <PlanCard
                  key={proposal.id}
                  plan={proposal}
                  config={config}
                  onChoose={() => setPending(proposal)}
                />
              ))}
            </div>
          )}
          <p className="text-xs leading-relaxed text-foreground/60">
            Anteproyectos orientativos: la orientación solar, ventilación, terreno, accesibilidad,
            estructura y normativa local requieren revisión profesional antes de construir.
          </p>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>¿Aplicar {pending?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se reemplazarán la forma, superficie, plantas y distribución actual. Se mantienen tus
            terminaciones. Todos los elementos seguirán siendo editables y podés recuperar el diseño
            anterior con Deshacer.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 gap-2"
              onClick={() => {
                if (!pending) return;
                s.replaceDesign(buildLayoutProposal(s.config, pending));
                if (useConfigurator.getState().error) return;
                s.setTool("wall");
                s.setView("planta");
                setOpen(false);
                setPending(null);
              }}
            >
              <Check size={16} />
              Aplicar distribución
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
