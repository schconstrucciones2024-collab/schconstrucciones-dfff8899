import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/home/LegalPage";
import { LEGAL_PAGES, privacySections } from "@/config/legal";
import { CONTACT } from "@/data/projects";
import { publicPageHead } from "@/data/servicios";

const page = LEGAL_PAGES.privacidad;

export const Route = createFileRoute("/privacidad")({
  staticData: { sitemap: false },
  head: () => publicPageHead(page.path, page.metaTitle, page.description),
  component: PrivacidadPage,
});

function PrivacidadPage() {
  return <LegalPage eyebrow={page.eyebrow} title={page.title} intro={page.intro} sections={privacySections({ address: CONTACT.address, email: CONTACT.email, whatsappLabel: CONTACT.whatsappLabel })} />;
}
