import { DECK_TEXTOS } from "@/config/deck";

export const FAQ_CATEGORIES = ["Todas", "Plazos y pagos", "Alcance", "Técnica"] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];
export type FaqBlock =
  | { type: "paragraph" | "note" | "highlight"; text: string; title?: string }
  | { type: "list"; items: string[]; checked: boolean }
  | { type: "steps"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][]; caption: string };
export type Faq = {
  id: string;
  category: Exclude<FaqCategory, "Todas">;
  question: string;
  icon: "clock" | "payment" | "included" | "excluded" | "foundation";
  label?: string;
  image?: { src: string; alt: string; width: number; height: number };
  blocks: FaqBlock[];
};

export const FAQ_WHATSAPP = "https://wa.me/59895564068?text=Hola%20SCH%20Construcciones%2C%20vi%20las%20preguntas%20frecuentes%20en%20la%20web%20y%20quiero%20consultar%20por%20una%20caba%C3%B1a.";

export const faqs: Faq[] = [
  {
    id: "faq-plazos", category: "Plazos y pagos", icon: "clock",
    question: "¿Cuánto demora construir mi casa?",
    blocks: [
      { type: "table", caption: "Plazos orientativos", headers: ["Superficie", "Wood frame", "Tradicional"], rows: [
        ["48–60 m² · llave en mano", "3 a 5 meses", "4,5 a 10 meses"],
        ["80–100 m²", "4 a 8 meses", "6 a 16 meses"],
      ] },
      { type: "highlight", text: "En general, Wood Frame puede reducir entre 30% y 50% el tiempo de obra." },
      { type: "note", text: "Plazos orientativos. El proyecto, el clima, la fundación, las conexiones, las terminaciones, el mobiliario, los exteriores y la entrega de materiales pueden modificarlos." },
    ],
  },
  {
    id: "faq-pago", category: "Plazos y pagos", icon: "payment",
    question: "¿Cómo se paga?",
    blocks: [
      { type: "paragraph", text: "Por avance de obra. No cobramos por adelantado: cobramos por lo que ya fue ejecutado." },
      { type: "steps", items: ["Ejecutamos", "Mostramos el avance", "Cobramos lo ejecutado", "Continuamos"] },
      { type: "highlight", text: "Construís. Ves. Pagás. Y seguimos." },
      { type: "note", text: "Un sistema pensado para que el avance de la obra sea visible antes del próximo pago." },
    ],
  },
  {
    id: "faq-incluye", category: "Alcance", icon: "included",
    question: "¿Qué incluye una cabaña completa?",
    blocks: [
      { type: "list", checked: true, items: ["Sanitaria completa hasta la primera cámara", "Eléctrica interior completa con firma de UTE", "Madera 100% curada y tratada", "Mobiliario principal: mesada de cocina y mesada de baño"] },
      { type: "paragraph", text: "Construcción pensada para entregar una solución completa, no solamente cuatro paredes." },
    ],
  },
  {
    id: "faq-no-incluye", category: "Alcance", icon: "excluded",
    question: "¿Qué no incluye?",
    blocks: [
      { type: "list", checked: false, items: ["Grifería", "Artefactos sanitarios", "Pintura", "Decks", "Pérgolas", "Parrilleros"] },
      { type: "paragraph", text: "Lo importante es saberlo antes de empezar. Si querés sumar alguno a tu proyecto, consultanos." },
    ],
  },
  {
    id: "faq-deck", category: "Alcance", icon: "excluded",
    question: DECK_TEXTOS.faqPregunta,
    blocks: [
      { type: "paragraph", text: DECK_TEXTOS.faqRespuesta },
      { type: "note", text: `${DECK_TEXTOS.aviso} ${DECK_TEXTOS.letraChica}` },
    ],
  },
  {
    id: "faq-fundacion", category: "Técnica", icon: "foundation", label: "Criterio técnico",
    question: "¿Pilotes o platea? ¿Qué fundación conviene en terreno arenoso?",
    blocks: [
      { type: "paragraph", text: "La fundación transmite al terreno todas las cargas de la vivienda. En suelo arenoso, típico de la zona costera, elegir mal el tipo de fundación es una de las principales causas de fisuras, desniveles y deterioro de instalaciones." },
      { type: "paragraph", title: "Qué pasa en suelo arenoso", text: "La arena tiene baja cohesión: su capacidad de soporte depende de la compactación, de la humedad y de que el material no se mueva. Con lluvias intensas, escorrentía, napa freática alta o temporales, el agua circula y arrastra material fino (socavación y erosión interna). Así, el terreno bajo la fundación pierde apoyo de forma gradual y despareja." },
      { type: "paragraph", title: "Platea", text: "Es una losa de hormigón apoyada en superficie. Reparte las cargas en un área grande y funciona muy bien cuando el suelo es firme, homogéneo y bien drenado. En arena suelta o erosionable depende por completo de la capa superficial: si el agua lava el suelo bajo la losa o su borde, aparecen asentamientos diferenciales (una zona baja más que otra) que se traducen en fisuras, desniveles y roturas." },
      { type: "paragraph", title: "Pilotes", text: "Son elementos verticales de hormigón o de madera curada y tratada que atraviesan la capa superficial y llevan las cargas a estratos más profundos y estables, por fricción lateral y/o apoyo en punta. La vivienda queda elevada e independiente de lo que pase con la arena superficial. Además se ventila la parte inferior, se protege la estructura de la humedad del suelo y se altera menos el terreno natural. Se complementa muy bien con el wood frame: al ser una estructura liviana, las cargas son moderadas y se concentran de forma eficiente en los puntos de apoyo." },
      { type: "table", caption: "Pilotes y platea", headers: ["Criterio", "Pilotes", "Platea"], rows: [
        ["Apoyo en suelo arenoso", "Estratos profundos y estables", "Capa superficial"],
        ["Frente al agua y la erosión", "No depende del suelo superficial", "Puede perder apoyo por socavación"],
        ["Asentamientos diferenciales", "Menor riesgo", "Mayor riesgo en suelo suelto"],
        ["Humedad y ventilación", "Vivienda elevada y ventilada", "Contacto más cercano con el suelo"],
        ["Cuándo se recomienda", "Suelo arenoso o costero", "Suelo firme, si el proyecto técnico lo indica"],
      ] },
      { type: "highlight", text: "Nuestro criterio, respaldado por los ingenieros con los que trabajamos: en suelo arenoso recomendamos pilotes de hormigón o de madera curada. La platea la hacemos sin inconvenientes cuando el suelo es firme y el proyecto técnico lo indica." },
      { type: "note", text: "Explicación general. La definición final depende de las condiciones reales del terreno (tipo de suelo, nivel de napa, cota y drenaje) y del proyecto técnico." },
    ],
  },
];

export function faqPlainText(faq: Faq): string {
  return [faq.label, ...faq.blocks.map((block) => {
    if (block.type === "table") return [block.caption, block.headers.join(" | "), ...block.rows.map((row) => row.map((cell, index) => `${block.headers[index]}: ${cell}`).join("; "))].join(". ");
    if (block.type === "steps") return block.items.map((item, index) => `${index + 1} ${item}`).join(". ");
    if (block.type === "list") return block.items.join(". ");
    return [block.title, block.text].filter(Boolean).join(": ");
  })].filter(Boolean).join("\n");
}

export const faqJsonLd = {
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faqPlainText(faq) } })),
};