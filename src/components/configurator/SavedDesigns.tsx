import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, FolderOpen, Link2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINISH_NAMES } from "@/config/pricing";
import type { FinishId } from "@/config/materials";
import { useConfigurator } from "@/store/useConfigurator";
import { MAX_NAME_LENGTH, MAX_SAVED_DESIGNS, defaultName, savedDesignUrl, type SavedDesign } from "@/store/designStorage";
import { hasUnsavedChanges, useDesignLibrary } from "@/store/useDesignLibrary";

type Pending =
  | { kind: "delete"; id: string }
  | { kind: "open"; id: string }
  | { kind: "new" };

function when(ms: number): string {
  try {
    return new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms);
  } catch {
    return "";
  }
}

function detail(d: SavedDesign): string {
  const finish = FINISH_NAMES[d.summary.finish as FinishId] ?? d.summary.finish;
  return [when(d.savedAt), `${d.summary.m2} m²`, `${d.summary.floors} ${d.summary.floors === 1 ? "planta" : "plantas"}`, finish].filter(Boolean).join(" · ");
}

const small =
  "min-h-11 px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * «Mis diseños»: el cliente guarda lo que diseña con un nombre, lo abre cuando quiera, lo modifica, lo duplica o lo borra.
 * Además, lo que arma se autoguarda solo en su dispositivo (ver `useDesignLibrary`), así que si sale de la web y vuelve lo retoma.
 * Va arriba del diseñador, plegado: cerrado ocupa una línea con el estado del guardado.
 */
export function SavedDesigns() {
  const { ready, storageOk, list, activeId, touched, notice } = useDesignLibrary();
  const config = useConfigurator((s) => s.config);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [manualLink, setManualLink] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [wantFocus, setWantFocus] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

  // Al tocar «Guardar diseño» el cursor queda en el nombre, apenas el campo aparece.
  useEffect(() => {
    if (open && wantFocus) {
      nameInput.current?.focus();
      setWantFocus(false);
    }
  }, [open, wantFocus]);

  const dirty = useMemo(() => hasUnsavedChanges(config, list, activeId, touched), [config, list, activeId, touched]);
  const active = activeId ? list.find((d) => d.id === activeId) : undefined;
  const full = list.length >= MAX_SAVED_DESIGNS;
  const lib = useDesignLibrary.getState;

  if (!ready) return null;

  const openPanel = () => {
    setOpen(true);
    setWantFocus(true);
  };
  const saveAsNew = () => {
    const result = lib().saveNew(name);
    if (result.ok) setName("");
    return result.ok;
  };
  /** Lo que se hace después de decidir qué pasa con los cambios sin guardar. */
  const run = (p: Pending) => {
    if (p.kind === "open") lib().open(p.id);
    else if (p.kind === "new") lib().startNew();
    else lib().remove(p.id);
    setPending(null);
  };
  const ask = (p: Pending) => {
    if (p.kind !== "delete" && !dirty) run(p);
    else setPending(p);
  };
  const saveThenRun = (p: Pending) => {
    const ok = active ? lib().saveChanges().ok : saveAsNew();
    if (ok) run(p);
    else setPending(null);
  };
  const copyLink = async (d: SavedDesign) => {
    const url = savedDesignUrl(d, window.location.href);
    try {
      await navigator.clipboard.writeText(url);
      setManualLink(null);
      setCopied(d.id);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(null), 2200);
    } catch {
      setManualLink({ id: d.id, url });
    }
  };
  const target = pending && pending.kind !== "new" ? list.find((d) => d.id === pending.id) : undefined;

  return (
    <section aria-labelledby="mis-disenos-title" className="mb-6 border border-border bg-background p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h3 id="mis-disenos-title" className="text-[10px] font-semibold uppercase text-primary">Mis diseños</h3>
          {!storageOk ? (
            <p className="mt-1 text-sm leading-6">
              <strong className="font-semibold text-destructive">No se puede guardar acá.</strong> Tu navegador no deja guardar en este
              dispositivo (modo privado, bloqueado o sin espacio), así que el diseño se pierde al salir. Para no perderlo, copiá su link.
            </p>
          ) : active ? (
            <p className="mt-1 text-sm leading-6">
              Abierto: <strong className="font-semibold">{active.name}</strong>
              <span className={dirty ? "text-primary" : "text-foreground/65"}>{dirty ? " · con cambios sin guardar" : " · sin cambios"}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-foreground/80">
              Tu diseño se guarda solo en este dispositivo: si salís de la web y volvés, lo retomás y lo seguís modificando.
              {dirty && <span className="text-primary"> Todavía no tiene nombre: guardalo para tenerlo siempre a mano.</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {active && dirty && (
            <Button type="button" className={small} onClick={() => lib().saveChanges()}>
              <Save aria-hidden="true" />Guardar cambios
            </Button>
          )}
          <Button
            type="button"
            variant={active && dirty ? "outline" : "default"}
            className={small}
            disabled={!storageOk}
            onClick={openPanel}
          >
            <Save aria-hidden="true" />{active ? "Guardar como nuevo…" : "Guardar diseño"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={small}
            aria-expanded={open}
            aria-controls="mis-disenos-panel"
            onClick={() => setOpen((v) => !v)}
          >
            <FolderOpen aria-hidden="true" />Mis diseños ({list.length})
            <ChevronDown aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
          </Button>
          <Button type="button" variant="outline" className={small} onClick={() => ask({ kind: "new" })}>
            <Plus aria-hidden="true" />Diseño nuevo
          </Button>
        </div>
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mt-3 flex items-start justify-between gap-3 border p-3 text-sm leading-6 ${
            notice.tone === "error" ? "border-destructive/60 bg-destructive/5" : "border-primary/50 bg-primary/5"
          }`}
        >
          <p>{notice.text}</p>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Cerrar aviso" onClick={() => lib().dismissNotice()}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {pending && (
        <div role="group" aria-label="Confirmar" className="mt-3 border border-primary/50 bg-primary/5 p-3 text-sm leading-6">
          {pending.kind === "delete" ? (
            <>
              <p>¿Eliminar «{target?.name ?? "este diseño"}»? No se puede deshacer.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="destructive" className={small} onClick={() => run(pending)}>
                  <Trash2 aria-hidden="true" />Sí, eliminar
                </Button>
                <Button type="button" variant="outline" className={small} onClick={() => setPending(null)}>Cancelar</Button>
              </div>
            </>
          ) : (
            <>
              <p>
                {pending.kind === "new" ? "Si empezás un diseño nuevo" : `Si abrís «${target?.name ?? "ese diseño"}»`}, lo que ves ahora y no está guardado se pierde.
                {active ? ` Podés guardar antes los cambios en «${active.name}».` : " Podés guardarlo antes con un nombre."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(active || !full) && (
                  <Button type="button" className={small} onClick={() => saveThenRun(pending)}>
                    <Save aria-hidden="true" />Guardar y seguir
                  </Button>
                )}
                <Button type="button" variant="outline" className={small} onClick={() => run(pending)}>Seguir sin guardar</Button>
                <Button type="button" variant="outline" className={small} onClick={() => setPending(null)}>Cancelar</Button>
              </div>
            </>
          )}
        </div>
      )}

      {open && (
        <div id="mis-disenos-panel" className="mt-4 border-t border-border pt-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!storageOk) return;
              saveAsNew();
            }}
          >
            <label className="block min-w-0 flex-1 basis-56 text-xs text-foreground/75">
              Nombre del diseño
              <input
                ref={nameInput}
                className="config-input mt-2"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                placeholder={defaultName(list)}
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button type="submit" className={small} disabled={!storageOk || full}>
              <Save aria-hidden="true" />Guardar como nuevo
            </Button>
          </form>
          {full && <p className="mt-2 text-xs leading-5 text-foreground/70">Llegaste al máximo de {MAX_SAVED_DESIGNS} diseños. Eliminá alguno para guardar otro.</p>}

          {list.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-foreground/70">
              {storageOk
                ? "Todavía no guardaste ningún diseño. Escribí un nombre y tocá «Guardar como nuevo» para tenerlo siempre a mano."
                : "Mientras el navegador no deje guardar, no hay diseños guardados para mostrar."}
            </p>
          ) : (
            <ul className="mt-4">
              {list.map((d) => {
                const isActive = d.id === activeId;
                const editing = renaming?.id === d.id;
                return (
                  <li key={d.id} className="border-t border-border py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="break-words text-sm font-semibold">
                          {d.name}
                          {isActive && <span className="ml-2 border border-primary px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase text-primary">Abierto</span>}
                        </p>
                        <p className="mt-1 text-xs text-foreground/65">{detail(d)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {!isActive && (
                          <Button type="button" className={small} onClick={() => ask({ kind: "open", id: d.id })}>
                            <FolderOpen aria-hidden="true" />Abrir
                          </Button>
                        )}
                        <Button type="button" variant="outline" className={small} onClick={() => setRenaming({ id: d.id, text: d.name })}>
                          <Pencil aria-hidden="true" />Renombrar
                        </Button>
                        <Button type="button" variant="outline" className={small} disabled={full} onClick={() => lib().duplicate(d.id)}>
                          <Copy aria-hidden="true" />Duplicar
                        </Button>
                        <Button type="button" variant="outline" className={small} onClick={() => copyLink(d)}>
                          {copied === d.id ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                          {copied === d.id ? "Link copiado" : "Copiar link"}
                        </Button>
                        <Button type="button" variant="outline" className={small} onClick={() => setPending({ kind: "delete", id: d.id })}>
                          <Trash2 aria-hidden="true" />Eliminar
                        </Button>
                      </div>
                    </div>
                    {editing && renaming && (
                      <form
                        className="mt-3 flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (lib().rename(d.id, renaming.text)) setRenaming(null);
                        }}
                      >
                        <label className="block min-w-0 flex-1 basis-56 text-xs text-foreground/75">
                          Nuevo nombre
                          <input
                            className="config-input mt-2"
                            value={renaming.text}
                            maxLength={MAX_NAME_LENGTH}
                            autoComplete="off"
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                            onChange={(e) => setRenaming({ id: d.id, text: e.target.value })}
                          />
                        </label>
                        <Button type="submit" className={small} disabled={!renaming.text.trim()}>Guardar nombre</Button>
                        <Button type="button" variant="outline" className={small} onClick={() => setRenaming(null)}>Cancelar</Button>
                      </form>
                    )}
                    {manualLink?.id === d.id && (
                      <label className="mt-3 block text-xs text-foreground/75">
                        No pudimos copiarlo solos. Copiá este link a mano:
                        <input className="config-input mt-2" readOnly value={manualLink.url} onFocus={(e) => e.currentTarget.select()} />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-5 text-foreground/60">
            Tus diseños quedan guardados en este navegador y este dispositivo; si borrás los datos del navegador, se borran. Para pasar un diseño
            a otro dispositivo o guardarlo aparte, usá «Copiar link».
          </p>
        </div>
      )}
    </section>
  );
}
