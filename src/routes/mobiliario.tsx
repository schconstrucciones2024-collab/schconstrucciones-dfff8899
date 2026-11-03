import { createFileRoute } from "@tanstack/react-router";
import { List, Section, ServicePage, WhatsAppButton } from "@/components/servicios/ServicePage";
import { serviceHead, type ServiceFaq } from "@/data/servicios";

const faqs: ServiceFaq[] = [
  { question: "¿Qué muebles hacen?", answer: "Mesadas, islas, mesas, camas, muebles a medida y mobiliario en drywall, por ejemplo mesadas de drywall." },
  { question: "¿La cabaña completa incluye muebles?", answer: "Sí: cada cabaña completa incluye mesada de cocina y mesada de baño." },
  { question: "¿Hacen muebles para casas que no construyeron ustedes?", answer: "Sí, hacemos mobiliario a medida para tu cabaña o casa. Escribinos por WhatsApp con las medidas y lo que necesitás." },
  { question: "¿Cómo pido presupuesto?", answer: "Por WhatsApp al 095 564 068, con las medidas y una foto o idea del mueble." },
];
const title = "Mobiliario a medida en Punta del Diablo | SCH Construcciones";
const description = "Mesadas, islas, mesas, camas y muebles de drywall a medida para tu cabaña o casa. Punta del Diablo, Rocha. Presupuesto por WhatsApp 095 564 068.";

export const Route = createFileRoute("/mobiliario")({
  head: () => serviceHead("/mobiliario", title, description, faqs),
  component: MobiliarioPage,
});

function MobiliarioPage() {
  return (
    <ServicePage eyebrow="Mobiliario" title="Mobiliario a medida para tu cabaña o casa" faqs={faqs}
      intro="En SCH Construcciones hacemos mesadas, islas, mesas, camas, muebles y mobiliario en drywall a medida. Estamos en Av. Central, Punta del Diablo (Rocha) desde 2015 y trabajamos en todo Uruguay con más de 40 años de trayectoria. El plazo depende de cada pieza: pedinos presupuesto por WhatsApp y te lo confirmamos.">
      <Section title="Qué hacemos">
        <List checked items={["Mesadas", "Islas de cocina", "Mesas", "Camas", "Muebles a medida", "Mobiliario en drywall (por ejemplo, mesadas de drywall)"]} />
      </Section>
      <Section title="Incluido en cada cabaña completa">
        <p>Cada cabaña completa que construimos incluye mesada de cocina y mesada de baño.</p>
      </Section>
      <Section title="Pedí tu presupuesto">
        <p>Mandanos por WhatsApp las medidas y qué mueble necesitás.</p>
        <WhatsAppButton label="Pedir presupuesto por WhatsApp" />
      </Section>
    </ServicePage>
  );
}
