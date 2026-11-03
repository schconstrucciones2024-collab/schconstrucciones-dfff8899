import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, localBusinessJsonLd } from "@/data/servicios";
import { FAQSection } from "@/components/faq/FAQSection";
import { faqJsonLd } from "@/data/faqs";
import { Cotizador } from "@/components/cotizador/Cotizador";
import { ConfiguratorEntry } from "@/components/configurator/ConfiguratorEntry";
import { About, CoastBand } from "@/components/home/About";
import { Contact } from "@/components/home/Contact";
import { FloatingWhatsApp } from "@/components/home/FloatingWhatsApp";
import { Hero } from "@/components/home/Hero";
import { Pillars } from "@/components/home/Pillars";
import { Portfolio } from "@/components/home/Portfolio";
import { Process } from "@/components/home/Process";
import { Services } from "@/components/home/Services";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteHeader } from "@/components/home/SiteHeader";
import { Social } from "@/components/home/Social";
import { Sistemas } from "@/components/sistemas/Sistemas";

const TITLE = "SCH Construcciones | Construcción en Rocha";
const DESCRIPTION = "Más de 40 años construyendo hogares, reformas y proyectos integrales en Punta del Diablo y Rocha.";
const SOCIAL_IMAGE = `${SITE_URL}/images/hero-obra-1280.webp`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: "Construimos con vos hogares seguros, duraderos y de terminación premium." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:width", content: "1280" },
      { property: "og:image:height", content: "720" },
      { property: "og:image:alt", content: "Casa celeste con piscina, obra Lo de Cata de SCH Construcciones en Punta del Diablo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SOCIAL_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(faqJsonLd) },
      { type: "application/ld+json", children: JSON.stringify(localBusinessJsonLd) },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="overflow-x-clip bg-background text-foreground">
        <Hero />
        <About />
        <CoastBand />
        <Services />
        <Pillars />
        <Portfolio />
        <Process />
        <Sistemas />
        <ConfiguratorEntry />
        <Cotizador />
        <Social />
        <FAQSection />
        <Contact />
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
