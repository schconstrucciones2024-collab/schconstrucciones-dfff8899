import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorToolbar, EditorPanel } from "./EditorTools";
import PlanEditor from './PlanEditor';
import { EntornoToolbar } from "./EntornoToolbar";
import {
  decodeDesign,
  useConfigurator,
} from "@/store/useConfigurator";
import { Panels, STEPS } from "./Panels";
import { Summary } from "./Summary";
import "./configurator.css";
const Viewer3D = lazy(() => import("./Viewer3D"));
class ViewerBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onFail();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function Configurator() {
  const [step, setStep] = useState(0),
    [failed, setFailed] = useState(false),
    [viewerAttempt, setViewerAttempt] = useState(0),
    s = useConfigurator();
  useEffect(() => {
    // Siempre abrimos con la distribución sugerida (Compacta abierta).
    // Solo se carga un diseño guardado si llega por link compartido (?design=).
    try {
      const encoded = new URLSearchParams(window.location.search).get("design");
      if (encoded) {
        const design = decodeDesign(encoded);
        if (design) useConfigurator.setState({ config: design, past: [], future: [] });
      }
    } catch {}
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) setFailed(true);
    const key = (e: KeyboardEvent) => {
      if (
        !(e.ctrlKey || e.metaKey) ||
        (e.target instanceof HTMLElement &&
          ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      )
        return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? useConfigurator.getState().redo() : useConfigurator.getState().undo();
      }
      if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        useConfigurator.getState().redo();
      }
    };
    const host = document.getElementById("configurador-3d");
    host?.addEventListener("keydown", key);
    return () => {
      host?.removeEventListener("keydown", key);
    };
  }, []);
  const changeStep = (n: number) => {
    setStep(n);
    s.setPlacing(null);
    if (n === 5) s.setView("corte");
  };
  return (
    <section
      id="configurador-3d"
      className="scroll-mt-28 border-y border-border bg-secondary py-14 sm:py-20"
      aria-labelledby="config-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase text-primary">
              SCH Construcciones · Woodframe
            </p>
            <h2 id="config-title" className="font-display text-4xl font-medium sm:text-5xl">
              Diseñá tu casa
            </h2>
          </div>
          <span className="text-xs text-foreground/60">
            {Number(s.config.m2.toFixed(2))} m² · {s.config.openings.length} aberturas
          </span>
        </div>
        <EditorToolbar />
        {!failed && <EntornoToolbar onStep={changeStep} />}
        {failed && !(s.view === 'planta' && (s.tool === 'contour' || s.tool === 'wall')) ? (
          <div className="border-y border-border py-10">
            <p className="text-sm text-foreground/75">
              No pudimos iniciar el visor 3D.
            </p>
            <Button variant="outline" className="mt-4 mr-2 min-h-11" onClick={() => { setFailed(false); setViewerAttempt(v => v + 1); }}>
              <RotateCcw size={16} />Reintentar 3D
            </Button>
            <Button asChild variant="outline" className="mt-4 min-h-11">
              <a href="#cotiza">
                Usar cotizador clásico <ArrowRight size={16} />
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid min-w-0 gap-0 border-y border-border lg:grid-cols-[minmax(0,1fr)_380px]">
            {s.view === 'planta' && (s.tool === 'contour' || s.tool === 'wall') ? <div className="config-viewer"><PlanEditor key={s.tool} resetKey={0} /></div> : <ViewerBoundary key={viewerAttempt} onFail={() => setFailed(true)}>
              <Suspense
                fallback={
                  <div
                    className="config-viewer flex items-center justify-center bg-secondary text-sm text-foreground/70"
                    role="status"
                  >
                    Preparando tu casa…
                  </div>
                }
              >
                <Viewer3D onFail={() => setFailed(true)} />
              </Suspense>
            </ViewerBoundary>}
            <div className="config-panel min-w-0 border-border bg-background px-4 py-5 sm:px-6 lg:border-l">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-primary">
                  {String(step + 1).padStart(2, "0")} / 07
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Reiniciar configuración"
                  title="Reiniciar configuración"
                  onClick={() => {
                    s.reset();
                    setStep(0);
                  }}
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
              <nav aria-label="Pasos de configuración" className="mb-6 grid grid-cols-7 gap-1">
                {STEPS.map((name, i) => (
                  <Button
                    key={name}
                    variant="ghost"
                    className="h-11 min-h-11 rounded-none p-0"
                    aria-label={`${i + 1}. ${name}`}
                    aria-current={step === i ? "step" : undefined}
                    title={name}
                    onClick={() => changeStep(i)}
                  >
                    <span className={`h-1 w-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />
                  </Button>
                ))}
              </nav>
              <EditorPanel />
              <h3 className="mt-5 font-display text-2xl font-medium">{STEPS[step]}</h3>
              <Panels step={step} />
              <div className="mb-6 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  className="min-h-11"
                  disabled={step === 0}
                  onClick={() => changeStep(step - 1)}
                >
                  <ArrowLeft size={16} />
                  Anterior
                </Button>
                {step < 6 && (
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => changeStep(step + 1)}
                  >
                    Siguiente
                    <ArrowRight size={16} />
                  </Button>
                )}
              </div>
              {step !== 6 && <Summary />}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
