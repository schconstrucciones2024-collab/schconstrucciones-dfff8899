import { LOGISTICS_ZONES, SYSTEMS, EXCLUDED, formatUSD } from "@/lib/cotizador";

export const SITE_URL = "https://schconstrucciones.lovable.app";
export const SERVICE_WHATSAPP = "https://wa.me/59895564068";
export const SERVICE_LINKS = [
  { to: "/woodframe", label: "Woodframe" },
  { to: "/construccion-tradicional", label: "Construcción tradicional" },
  { to: "/mobiliario", label: "Mobiliario" },
] as const;

export type ServiceFaq = { question: string; answer: string };

export const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "GeneralContractor",
  name: "SCH Construcciones",
  url: SITE_URL,
  telephone: "+598 95 564 068",
  email: "sch.construcciones2024@gmail.com",
  address: { "@type": "PostalAddress", streetAddress: "Av. Central", addressLocality: "Punta del Diablo", addressRegion: "Rocha", addressCountry: "UY" },
  areaServed: ["Punta del Diablo", "Rocha", "Uruguay"],
  slogan: "Construir confianza. Edificar futuro.",
  image: `${SITE_URL}/images/hero-obra-1280.webp`,
  sameAs: [
    "https://www.instagram.com/sch_construcciones_/",
    "https://www.facebook.com/share/1EjmoTC5N4/",
    "https://www.tiktok.com/@sch_construcciones_",
    "https://pin.it/JdGW6Fisb",
  ],
  description: "Más de 40 años de trayectoria construyendo en todo Uruguay; instalados en Punta del Diablo desde 2015.",
};

export const faqPageJsonLd = (faqs: ServiceFaq[]) => ({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
});

/**
 * Imagen que se ve al compartir cada página de servicio (WhatsApp, Facebook, X…): 1200 × 630 px.
 * Mobiliario no tiene todavía: cuando haya fotos, se suma acá una fila con su ruta.
 */
export const SHARE_IMAGES: Record<string, { file: string; alt: string }> = {
  "/woodframe": {
    file: "/images/compartir-woodframe.jpg",
    alt: "Cuatro cabañas woodframe de SCH Construcciones: Lo de Cata, Cabaña en el bosque, Laslu y Mi Sueño",
  },
  "/construccion-tradicional": {
    file: "/images/compartir-tradicional.jpg",
    alt: "Obras de construcción tradicional de SCH Construcciones: Complejo Alvear en Piriápolis y Le Sirenuse en Punta del Este",
  },
};
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export function publicPageHead(path: string, title: string, description: string) {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const share = SHARE_IMAGES[path];
  return {
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(share
        ? [
            { property: "og:image", content: `${SITE_URL}${share.file}` },
            { property: "og:image:width", content: String(SHARE_IMAGE_SIZE.width) },
            { property: "og:image:height", content: String(SHARE_IMAGE_SIZE.height) },
            { property: "og:image:alt", content: share.alt },
            { name: "twitter:image", content: `${SITE_URL}${share.file}` },
            { name: "twitter:image:alt", content: share.alt },
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function serviceHead(path: string, title: string, description: string, faqs: ServiceFaq[]) {
  return {
    ...publicPageHead(path, title, description),
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(localBusinessJsonLd) },
      { type: "application/ld+json", children: JSON.stringify(faqPageJsonLd(faqs)) },
    ],
  };
}

/** Logistics zones outside Punta del Diablo, up to 300 km, from the single source of truth. */
export const LOGISTICS_ROWS = LOGISTICS_ZONES.filter((z) => z.id === "near" || z.id === "medium" || z.id === "long");
export const SERVICE_EXCLUDED = [...EXCLUDED.map((e) => e.replace(/\.$/, "")), "Gestión de trámites"];
export const woodframeCategories = SYSTEMS.woodframe.categories;
export const tradicionalCategories = SYSTEMS.tradicional.categories;
export const priceRange = (ids: { price: number }[]) => ids.map((c) => `${formatUSD(c.price)}/m²`);
