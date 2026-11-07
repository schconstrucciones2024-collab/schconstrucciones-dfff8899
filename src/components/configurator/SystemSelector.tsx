import { Check, Hammer, TreePine } from "lucide-react";
import { SYSTEMS, type SystemId } from "@/lib/cotizador";
import { systemOf, systemPatch } from "@/config/systems";
import { useConfigurator } from "@/store/useConfigurator";

const OPTIONS: { id: SystemId; icon: typeof Hammer; lines: string[] }[] = [
  {
    id: "woodframe",
    icon: TreePine,
    lines: ["Paneles de madera curada", "Sobre pilotes, obra seca y rápida"],
  },
  {
    id: "tradicional",
    icon: Hammer,
    lines: ["Mampostería con revoque", "Sobre platea de hormigón, obra húmeda"],
  },
];

/**
 * Selector principal del diseñador: elige con qué sistema constructivo se diseña. Va arriba de todos los paneles porque
 * condiciona las terminaciones, la base, el techo y las distribuciones que se ofrecen. Cambiar de sistema conserva el diseño.
 */
export function SystemSelector() {
  const config = useConfigurator((s) => s.config),
    update = useConfigurator((s) => s.update),
    system = systemOf(config.finish);
  return (
    <fieldset className="mb-6 border border-border bg-background p-3 sm:p-4">
      <legend className="px-2 text-[10px] font-semibold uppercase text-primary">
        1 · Elegí cómo querés construir
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map(({ id, icon: Icon, lines }) => {
          const active = system === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                const patch = systemPatch(config, id);
                if (Object.keys(patch).length) update(patch);
              }}
              className={`flex min-h-16 items-center gap-3 border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              <Icon size={22} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-medium leading-tight">
                  {SYSTEMS[id].name}
                </span>
                {lines.map((line) => (
                  <span
                    key={line}
                    className={`block text-xs leading-5 ${active ? "opacity-85" : "text-foreground/65"}`}
                  >
                    {line}
                  </span>
                ))}
              </span>
              {active && <Check size={18} aria-hidden="true" className="shrink-0" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 px-1 text-xs leading-6 text-foreground/60">
        Al cambiar de sistema se conserva tu diseño; se adaptan los materiales, la base y el techo.
        Cada sistema tiene sus propias distribuciones.
      </p>
    </fieldset>
  );
}
