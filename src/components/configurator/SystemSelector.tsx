import { Check, Hammer, TreePine } from "lucide-react";
import { SYSTEMS, formatUSD, type SystemId } from "@/lib/cotizador";
import { systemOf, systemPatch } from "@/config/systems";
import { VOLUME_TIERS, type TradicionalId } from "@/config/tradicional";
import { IncluyeAccordion } from "@/components/cotizador/PrecioTradicional";
import { useConfigurator } from "@/store/useConfigurator";

/** «Desde USD 1.200/m²» y los tramos de bonificación, leídos de la misma tarifa y los mismos tramos que usa el cálculo. */
const tradicionalPrecio = () =>
  `Desde ${formatUSD(Math.min(...SYSTEMS.tradicional.categories.map((c) => c.price)))}/m² · ` +
  [...VOLUME_TIERS].sort((a, b) => a.from - b.from).map((t) => `-${t.discount}% desde ${t.from} m²`).join(" · ");

const OPTIONS: { id: SystemId; icon: typeof Hammer; lines: string[] }[] = [
  {
    id: "woodframe",
    icon: TreePine,
    lines: ["Paneles de madera curada", "Sobre pilotes, obra seca y rápida"],
  },
  {
    id: "tradicional",
    icon: Hammer,
    lines: ["Mampostería con revoque", "Sobre platea de hormigón armado, obra húmeda"],
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
                {(id === "tradicional" ? [...lines, tradicionalPrecio()] : lines).map((line) => (
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
      {system === "tradicional" && <IncluyeAccordion className="mt-3" variant="panel" option={config.finish as TradicionalId} />}
      <p className="mt-3 px-1 text-xs leading-6 text-foreground/60">
        Al cambiar de sistema se conserva tu diseño; se adaptan los materiales, la base y el techo.
        Cada sistema tiene sus propias distribuciones.
      </p>
    </fieldset>
  );
}
