import { createFileRoute } from "@tanstack/react-router";
import { List, Section, ServicePage, WhatsAppButton } from "@/components/servicios/ServicePage";
import { LogisticsTable } from "@/components/servicios/LogisticsTable";
import { serviceHead, tradicionalCategories, type ServiceFaq } from "@/data/servicios";
import { formatUSD, type Category } from "@/lib/cotizador";
import { TRADICIONAL_EXCLUIDO, TRADICIONAL_OPCION, TRADICIONAL_TEXTOS, VOLUME_TIERS, discountedRate, incluyeFor, volumeTierRows } from "@/config/tradicional";

const [esencial, clasica] = tradicionalCategories as [Category, Category];
// Todos los precios salen de las tarifas del cotizador y de los tramos de config/tradicional.ts: nada se escribe a mano.
const [firstTier, lastTier] = [...VOLUME_TIERS].sort((a, b) => a.from - b.from) as [(typeof VOLUME_TIERS)[number], (typeof VOLUME_TIERS)[number]];
const TRADICIONAL_NO_INCLUYE = [...TRADICIONAL_EXCLUIDO.map((e) => e.replace(/\.$/, "")), "Gestión de trámites"];
const faqs: ServiceFaq[] = [
  { question: "¿Cuánto cuesta la construcción tradicional por m²?", answer: `Esencial con techo liviano ${formatUSD(esencial.price)}/m² y Clásica con losa de hormigón armado ${formatUSD(clasica.price)}/m². Desde ${firstTier.from} m² el precio por m² baja ${firstTier.discount}% y desde ${lastTier.from} m² baja ${lastTier.discount}%, por optimización de escala de obra. Fuera de Punta del Diablo se suma un costo logístico sobre el total de la obra.` },
  { question: "¿Cuánto demora?", answer: "Plazos orientativos: 48 a 60 m² entre 4,5 y 10 meses; 80 a 100 m² entre 6 y 16 meses." },
  { question: "¿Qué incluye y qué no?", answer: `Incluye platea de hormigón armado ejecutada in situ, mampostería tradicional apta para salinidad y viento costero, techo liviano o losa de hormigón armado según la opción, instalación eléctrica interior completa con firma de UTE, instalación sanitaria completa hasta la primera cámara sanitaria, aberturas completas y mesadas principales de cocina y baño. ${TRADICIONAL_TEXTOS.exclusiones}` },
  { question: "¿Cómo se paga?", answer: "Por avance de obra: no cobramos por adelantado, cobramos lo ejecutado." },
];
const title = "Construcción tradicional de viviendas en Uruguay | SCH Construcciones";
const description = `Casas de ladrillo (ticholo o común) desde ${formatUSD(esencial.price)}/m², con descuento por superficie desde ${firstTier.from} m². Opciones Esencial y Clásica, pago por avance de obra. Punta del Diablo y todo Uruguay.`;

export const Route = createFileRoute("/construccion-tradicional")({
  staticData: { sitemap: true },
  head: () => serviceHead("/construccion-tradicional", title, description, faqs),
  component: TradicionalPage,
});

function TradicionalPage() {
  return (
    <ServicePage eyebrow="Construcción tradicional" title="Construcción tradicional de viviendas en Uruguay" faqs={faqs}
      intro={`En SCH Construcciones construimos viviendas tradicionales con muros de ladrillo hueco (ticholo) o ladrillo común, desde ${formatUSD(esencial.price)} por m², con descuento por superficie desde ${firstTier.from} m². Estamos en Av. Central, Punta del Diablo (Rocha) desde 2015 y construimos en todo Uruguay con más de 40 años de trayectoria. Una vivienda de 48 a 60 m² demora entre 4,5 y 10 meses.`}>
      <Section title="Dos opciones por m²">
        <p>Muros de ladrillo hueco (ticholo) o ladrillo común, a elección.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-sm border border-border p-5"><h3 className="font-display text-xl font-semibold">ESENCIAL · {TRADICIONAL_OPCION.esencial.toUpperCase()}</h3><p className="mt-2 text-2xl font-semibold text-primary">{formatUSD(esencial.price)}/m²</p>
            <p className="mt-1 text-xs text-foreground/60">{formatUSD(discountedRate(esencial.price, firstTier.from))}/m² desde {firstTier.from} m² · {formatUSD(discountedRate(esencial.price, lastTier.from))}/m² desde {lastTier.from} m²</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm"><li>Revoque común</li><li>Cielorraso de yeso</li><li>Piso cerámico estándar</li><li>Aberturas</li><li>Techo liviano de chapa con aislación térmica/hidrófuga reforzada</li></ul></div>
          <div className="rounded-sm border border-border p-5"><h3 className="font-display text-xl font-semibold">CLÁSICA · {TRADICIONAL_OPCION.clasica.toUpperCase()} DE HORMIGÓN ARMADO</h3><p className="mt-2 text-2xl font-semibold text-primary">{formatUSD(clasica.price)}/m²</p>
            <p className="mt-1 text-xs text-foreground/60">{formatUSD(discountedRate(clasica.price, firstTier.from))}/m² desde {firstTier.from} m² · {formatUSD(discountedRate(clasica.price, lastTier.from))}/m² desde {lastTier.from} m²</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm"><li>Revoque fino</li><li>Losa llena de hormigón armado con aislación térmica y membrana asfáltica</li><li>Piso porcelanato</li><li>Aberturas</li><li>Sin cielorraso</li></ul></div>
        </div>
      </Section>
      <Section title={TRADICIONAL_TEXTOS.tramosTitulo}>
        <p>{TRADICIONAL_TEXTOS.tramosIntro}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.15em] text-foreground/60"><tr><th className="py-2 pr-4">Superficie</th><th className="py-2 pr-4">Esencial · {TRADICIONAL_OPCION.esencial}</th><th className="py-2">Clásica · {TRADICIONAL_OPCION.clasica}</th></tr></thead>
            <tbody>{volumeTierRows().map((tier) => (
              <tr key={tier.desde} className="border-t border-border">
                <td className="py-3 pr-4 font-semibold">{tier.hasta === null ? `${tier.desde} m² o más` : `${tier.desde} a ${tier.hasta} m²`}{tier.descuento > 0 && <span className="ml-2 text-xs font-semibold text-primary">-{tier.descuento}%</span>}</td>
                <td className="py-3 pr-4">{formatUSD(discountedRate(esencial.price, tier.desde))}/m²</td>
                <td className="py-3">{formatUSD(discountedRate(clasica.price, tier.desde))}/m²</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>
      <Section title={TRADICIONAL_TEXTOS.incluyeTitulo}>
        <List checked items={incluyeFor().map((item) => `${item.titulo}: ${item.texto}`)} />
      </Section>
      <Section title="Qué no incluye">
        <List checked={false} items={TRADICIONAL_NO_INCLUYE} />
        <p>{TRADICIONAL_TEXTOS.exclusiones}</p>
      </Section>
      <Section title="Plazos orientativos">
        <ul className="list-disc space-y-2 pl-5"><li>48 a 60 m²: entre 4,5 y 10 meses.</li><li>80 a 100 m²: entre 6 y 16 meses.</li></ul>
      </Section>
      <Section title="Pago por avance de obra"><p>No cobramos por adelantado: cobramos lo ejecutado.</p></Section>
      <Section title="Obras fuera de Punta del Diablo">
        <p>Se suma un costo logístico extra sobre el total de la obra:</p>
        <LogisticsTable />
      </Section>
      <Section title="Presupuesto a medida gratis">
        <p>Pasanos los m² que querés construir y te enviamos el presupuesto sin costo.</p>
        <WhatsAppButton label="Pedir presupuesto por WhatsApp" />
      </Section>
    </ServicePage>
  );
}
