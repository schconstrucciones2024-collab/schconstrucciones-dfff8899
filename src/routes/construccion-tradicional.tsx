import { createFileRoute } from "@tanstack/react-router";
import { List, Section, ServicePage, WhatsAppButton } from "@/components/servicios/ServicePage";
import { LogisticsTable } from "@/components/servicios/LogisticsTable";
import { SERVICE_EXCLUDED, serviceHead, tradicionalCategories, type ServiceFaq } from "@/data/servicios";
import { formatUSD, type Category } from "@/lib/cotizador";

const [esencial, clasica] = tradicionalCategories as [Category, Category];
const faqs: ServiceFaq[] = [
  { question: "¿Cuánto cuesta la construcción tradicional por m²?", answer: `Esencial ${formatUSD(esencial.price)}/m² y Clásica ${formatUSD(clasica.price)}/m². Fuera de Punta del Diablo se suma un costo logístico sobre el total de la obra.` },
  { question: "¿Cuánto demora?", answer: "Plazos orientativos: 48 a 60 m² entre 4,5 y 10 meses; 80 a 100 m² entre 6 y 16 meses." },
  { question: "¿Qué incluye y qué no?", answer: "Ambas opciones incluyen eléctrica interior completa con firma de UTE y sanitaria completa hasta la primera cámara. No incluyen grifería, artefactos sanitarios, pintura, decks, pérgolas, parrilleros ni gestión de trámites." },
  { question: "¿Cómo se paga?", answer: "Por avance de obra: no cobramos por adelantado, cobramos lo ejecutado." },
];
const title = "Construcción tradicional de viviendas en Uruguay | SCH Construcciones";
const description = "Casas de ladrillo (ticholo o común) desde USD 1.300/m². Opciones Esencial y Clásica, pago por avance de obra. Punta del Diablo y todo Uruguay.";

export const Route = createFileRoute("/construccion-tradicional")({
  head: () => serviceHead("/construccion-tradicional", title, description, faqs),
  component: TradicionalPage,
});

function TradicionalPage() {
  return (
    <ServicePage eyebrow="Construcción tradicional" title="Construcción tradicional de viviendas en Uruguay" faqs={faqs}
      intro="En SCH Construcciones construimos viviendas tradicionales con muros de ladrillo hueco (ticholo) o ladrillo común, desde USD 1.300 por m². Estamos en Av. Central, Punta del Diablo (Rocha) desde 2015 y construimos en todo Uruguay con más de 40 años de trayectoria. Una vivienda de 48 a 60 m² demora entre 4,5 y 10 meses.">
      <Section title="Dos opciones por m²">
        <p>Muros de ladrillo hueco (ticholo) o ladrillo común, a elección.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-sm border border-border p-5"><h3 className="font-display text-xl font-semibold">ESENCIAL</h3><p className="mt-2 text-2xl font-semibold text-primary">{formatUSD(esencial.price)}/m²</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm"><li>Revoque común</li><li>Cielorraso de yeso</li><li>Piso cerámico estándar</li><li>Aberturas</li><li>Techo liviano de chapa con aislación básica</li></ul></div>
          <div className="rounded-sm border border-border p-5"><h3 className="font-display text-xl font-semibold">CLÁSICA</h3><p className="mt-2 text-2xl font-semibold text-primary">{formatUSD(clasica.price)}/m²</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm"><li>Revoque fino</li><li>Losa de hormigón con aislación térmica y membrana asfáltica</li><li>Piso porcelanato</li><li>Aberturas</li><li>Sin cielorraso</li></ul></div>
        </div>
      </Section>
      <Section title="Qué incluye">
        <List checked items={["Eléctrica interior completa con firma de UTE", "Sanitaria completa hasta la primera cámara"]} />
      </Section>
      <Section title="Qué no incluye"><List checked={false} items={SERVICE_EXCLUDED} /></Section>
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
