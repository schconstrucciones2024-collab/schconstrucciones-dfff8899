import { MapPin, Truck } from "lucide-react";
import {
  LOGISTICS_ZONES, calculateLogistics, clampArea, estimateFor, formatUSD, volumeBonus,
  getLogisticsZone, logisticsPercentage, type Category, type Areas, type LogisticsSelection, type LogisticsZoneId,
} from "@/lib/cotizador";
import { CATEGORY_COLOR, ZONE_COLOR, tone } from "./palette";

export function LogisticsCalculator({ categories, areas, selection, onChange }: {
  categories: Category[];
  areas: Areas;
  selection: LogisticsSelection;
  onChange: (selection: LogisticsSelection) => void;
}) {
  const zone = getLogisticsZone(selection.zoneId);
  const separateTrip = zone.id === "far" && selection.separateTrip;
  const percentage = logisticsPercentage(selection);
  const zoneIndex = LOGISTICS_ZONES.findIndex((item) => item.id === zone.id);
  return (
    <div className="mt-16 border-t border-border pt-10" aria-labelledby="logistica-title">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary"><Truck size={18} aria-hidden="true" /> Ubicación de la obra</p>
      <h3 id="logistica-title" className="mt-4 text-2xl font-semibold text-foreground">COSTO LOGÍSTICO EXTRA</h3>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground/75">Toda obra fuera de Punta del Diablo tiene un costo logístico extra. Se aplica el porcentaje del tramo correspondiente al valor de la obra y se suma por separado, sin modificar el precio por m².</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <label htmlFor="zona-logistica" className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-foreground/60"><MapPin size={16} aria-hidden="true" /> Zona / distancia desde Punta del Diablo</label>
          <select id="zona-logistica" value={zone.id} style={tone(ZONE_COLOR[zone.id])} onChange={(event) => onChange({ zoneId: event.target.value as LogisticsZoneId, separateTrip: false })} className="mt-3 min-h-12 w-full rounded-sm border border-border border-l-4 border-l-(--tone) bg-card px-3 py-3 text-sm text-foreground transition-[border-color] duration-300 focus-visible:outline-2 focus-visible:outline-(--tone)">
            {LOGISTICS_ZONES.map((item) => <option key={item.id} value={item.id}>{item.label}{item.id === "local" ? "" : ` · ${item.max}%`}</option>)}
          </select>
          <p className="mt-3 text-sm text-foreground/70">{zone.places}</p>
          {zone.id !== "local" && <div style={tone(ZONE_COLOR[zone.id])} className="fade-up mt-6 flex items-center justify-between gap-4 border border-border border-l-4 border-l-(--tone) bg-card px-4 py-3">
            <span className="text-xs uppercase tracking-[0.15em] text-foreground/60">Porcentaje logístico aplicado</span>
            <span className="text-2xl font-semibold text-(--tone)">{percentage}%</span>
          </div>}
          <p className="mt-3 text-xs leading-6 text-foreground/60">Porcentaje orientativo; SCH confirmará el costo logístico según la ubicación y las necesidades de la obra.</p>
          {zone.id === "far" && <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 text-sm text-foreground"><input type="checkbox" checked={separateTrip} onChange={(event) => onChange({ ...selection, separateTrip: event.target.checked })} className="h-5 w-5 accent-primary" /> Cotizar el viaje aparte</label>}
          {zone.id === "local" && <p className="mt-6 text-sm text-primary">En Punta del Diablo no se suma este costo extra.</p>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-foreground/60">Porcentajes sobre el total base de la obra</p>
          <div aria-hidden="true" className="mt-3 flex gap-1">
            {LOGISTICS_ZONES.map((item, i) => <span key={item.id} style={tone(ZONE_COLOR[item.id])} className={`h-1 flex-1 origin-left transition-[transform,background-color] duration-500 ${i <= zoneIndex ? "bg-(--tone)" : "bg-foreground/15"}`} />)}
          </div>
          <ul className="mt-3 divide-y divide-border">
            {LOGISTICS_ZONES.filter((item) => item.id !== "local").map((item) => {
              const on = item.id === zone.id;
              return <li key={item.id} style={tone(ZONE_COLOR[item.id])} aria-current={on ? "true" : undefined} className={`flex items-start justify-between gap-4 border-l-2 py-3 pl-3 text-sm transition-[background-color,border-color] duration-300 ${on ? "border-l-(--tone) bg-(--tone)/10" : "border-l-transparent"}`}><div><p className="font-semibold text-foreground">{item.label}</p><p className="mt-1 text-xs leading-5 text-foreground/60">{item.places}</p></div><span className="shrink-0 font-semibold text-(--tone)">{item.max}%</span></li>;
            })}
          </ul>
          <p className="mt-3 text-xs leading-6 text-foreground/60">Más de 300 km: {getLogisticsZone("far").max}% o viaje a cotizar aparte. Las localidades son referencias; la distancia de la obra determina el tramo.</p>
        </div>
      </div>

      <div className={`mt-8 grid gap-5 ${categories.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`} aria-live="polite" aria-atomic="true">
        {categories.map((category) => {
          const area = areas[category.id] ?? 40,
            base = estimateFor(category, area),
            bonus = volumeBonus(category, clampArea(area));
          const result = calculateLogistics(base, selection);
          return <article key={category.id} style={tone(CATEGORY_COLOR[category.id])} className="rounded-sm border border-border border-t-2 border-t-(--tone) bg-card p-5">
            <h4 className="flex items-center gap-3 font-semibold text-foreground"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-(--tone)" />{category.name} · {areas[category.id]} m²</h4>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-foreground/60">Obra base</dt><dd className="font-semibold text-foreground">{formatUSD(base)}</dd></div>
              {bonus && <div className="-mt-1 text-[11px] leading-5 text-foreground/60">Con bonificación por superficie (-{bonus.discount}%): {formatUSD(bonus.rate)}/m² en vez de {formatUSD(bonus.baseRate)}/m².</div>}
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-foreground/60">Logística{separateTrip ? "" : ` · ${result.percentage}%`}</dt><dd className="font-semibold text-foreground">{result.surcharge === null ? "A cotizar aparte" : formatUSD(result.surcharge)}</dd></div>
              <div className="border-t border-border pt-4"><dt className="text-xs text-foreground/60">Total estimado con logística</dt><dd className="mt-2 text-2xl font-semibold text-(--tone)"><span key={result.total ?? "pendiente"} className="tone-tick inline-block">{result.total === null ? "Pendiente de cotización" : formatUSD(result.total)}</span></dd></div>
            </dl>
          </article>;
        })}
      </div>
    </div>
  );
}
