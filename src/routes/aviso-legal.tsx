import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/home/LegalPage";
import { LEGAL_PAGES, legalSections } from "@/config/legal";
import { CONTACT } from "@/data/projects";
import { publicPageHead } from "@/data/servicios";

const page = LEGAL_PAGES.avisoLegal;

export const Route = createFileRoute("/aviso-legal")({
  staticData: { sitemap: false },
  head: () => publicPageHead(page.path, page.metaTitle, page.description),
  component: AvisoLegalPage,
});

function AvisoLegalPage() {
  return <LegalPage eyebrow={page.eyebrow} title={page.title} intro={page.intro} sections={legalSections({ address: CONTACT.address, email: CONTACT.email, whatsappLabel: CONTACT.whatsappLabel })} />;
}
