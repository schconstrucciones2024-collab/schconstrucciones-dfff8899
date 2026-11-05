import { createFileRoute } from "@tanstack/react-router";
import { List, Section, ServicePage, WhatsAppButton } from "@/components/servicios/ServicePage";
import { LogisticsTable } from "@/components/servicios/LogisticsTable";
import { SERVICE_EXCLUDED, serviceHead, woodframeCategories, type ServiceFaq } from "@/data/servicios";
import { EXTERIOR_REVESTIMIENTO, formatUSD, type Category } from "@/lib/cotizador";

const [rustica, moderna, allwood] = woodframeCategories as [Category, Category, Category];
const faqs: ServiceFaq[] = [
  { question: "¿Cuánto cuesta una cabaña woodframe por m²?", answer: `Rústica ${formatUSD(rustica.price)}/m², Moderna ${formatUSD(moderna.price)}/m² y Allwood ${formatUSD(allwood.price)}/m². Fuera de Punta del Diablo se suma un costo logístico sobre el total de la obra.` },
  { question: "¿Cuánto demora?", answer: "Plazos orientativos llave en mano: 48 a 60 m² entre 3 y 5 meses; 80 a 100 m² entre 4 y 8 meses. El woodframe reduce entre 30% y 50% el tiempo de obra frente a la construcción tradicional." },
  { question: "¿Qué incluye y qué no?", answer: "Incluye eléctrica interior completa con firma de UTE, sanitaria completa hasta la primera cámara y mesadas de cocina y baño. No incluye grifería, artefactos sanitarios, pintura, decks, pérgolas, parrilleros ni gestión de trámites." },
  { question: "¿Pilotes o platea?", answer: "En suelo arenoso de zona costera recomendamos pilotes de hormigón o de madera curada, porque la platea se lava y se mueve con el tiempo. En suelo firme se puede hacer platea." },
];
const title = "Cabañas woodframe llave en mano en Uruguay | SCH Construcciones";
const description = "Cabañas de madera woodframe desde USD 850/m², llave en mano en 3 a 5 meses. Punta del Diablo y todo Uruguay. Pago por avance de obra.";

export const Route = createFileRoute("/woodframe")({
  staticData: { sitemap: true },
  head: () => serviceHead("/woodframe", title, description, faqs),
  component: WoodframePage,
});

function WoodframePage() {
  return (
    <ServicePage eyebrow="Woodframe" title="Cabañas de madera woodframe llave en mano en Uruguay" faqs={faqs}
      intro="En SCH Construcciones construimos cabañas woodframe llave en mano con madera 100% curada y tratada, desde USD 850 por m². Estamos en Av. Central, Punta del Diablo (Rocha) desde 2015 y construimos en todo Uruguay con más de 40 años de trayectoria. Una cabaña de 48 a 60 m² se entrega en 3 a 5 meses.">
      <Section title="Tres opciones por m²">
        <div className="grid gap-4 md:grid-cols-3">
          {woodframeCategories.map((c) => <div key={c.id} className="rounded-sm border border-border p-5"><h3 className="font-display text-xl font-semibold">{c.name}</h3><p className="mt-2 text-2xl font-semibold text-primary">{formatUSD(c.price)}/m²</p><p className="mt-3 text-sm">{c.description}</p><p className="mt-3 text-xs font-semibold uppercase text-primary">Revestimientos interiores</p><p className="mt-1 text-sm">{c.interior}</p></div>)}
        </div>
        <p>{EXTERIOR_REVESTIMIENTO}</p>
      </Section>
      <Section title="Qué incluye">
        <List checked items={["Madera 100% curada y tratada", "Eléctrica interior completa con firma de UTE", "Sanitaria completa hasta la primera cámara", "Mesada de cocina y mesada de baño"]} />
      </Section>
      <Section title="Qué no incluye"><List checked={false} items={SERVICE_EXCLUDED} /></Section>
      <Section title="Plazos orientativos llave en mano">
        <ul className="list-disc space-y-2 pl-5"><li>48 a 60 m²: entre 3 y 5 meses.</li><li>80 a 100 m²: entre 4 y 8 meses.</li></ul>
        <p>El woodframe reduce entre 30% y 50% el tiempo de obra.</p>
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
