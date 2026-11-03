import { LOGISTICS_ROWS } from "@/data/servicios";

export function LogisticsTable() {
  return (
    <div className="overflow-x-auto rounded-sm border border-border" tabIndex={0} role="region" aria-label="Costo logístico por distancia">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-secondary text-primary"><tr><th scope="col" className="px-4 py-3">Distancia desde Punta del Diablo</th><th scope="col" className="px-4 py-3">Ejemplos</th><th scope="col" className="px-4 py-3">Costo extra</th></tr></thead>
        <tbody>{LOGISTICS_ROWS.map((z) => <tr key={z.id} className="border-t border-border"><th scope="row" className="px-4 py-3 font-medium">{z.label}</th><td className="px-4 py-3 text-foreground/80">{z.places}</td><td className="px-4 py-3 font-semibold">{z.max}% del total de la obra</td></tr>)}</tbody>
      </table>
    </div>
  );
}
