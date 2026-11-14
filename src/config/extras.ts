/**
 * Sección «Extras y opcionales»: la lista de extras que se pueden sumar a la vivienda, con sus textos.
 *
 * Hoy son dos: «Deck y techado» y «Pintura». Para agregar otro más adelante:
 *  1. sumar su id a `ExtraId` y su tarjeta a `EXTRA_CARDS` (acá);
 *  2. escribir su panel y mostrarlo en `components/cotizador/ExtrasSection.tsx` (un `TabsContent` más);
 *  3. sumarlo al total en `withExtras` (`lib/cotizador.ts`).
 * Es liviano a propósito: lo importa el cotizador de la página.
 */
import { DECK_LINEAS, DECK_LINES } from "./deck";
import { PAINT_DESDE_USD, formatRate } from "./paint";

export type ExtraId = "deck" | "pintura";

export type ExtraCard = {
  id: ExtraId;
  titulo: string;
  /** Una frase para la tarjeta. */
  resumen: string;
  /** «Desde USD 6,75/m²». */
  desde: string;
};

const deckDesde = Math.min(...DECK_LINES.map((l) => DECK_LINEAS[l].precios.deck));

export const EXTRA_CARDS: readonly ExtraCard[] = [
  {
    id: "deck",
    titulo: "Deck y techado",
    resumen: "Deck de pino curado sobre pilotes, solo o techado, con barandas. En línea Esencial o Premium.",
    desde: `Desde USD ${deckDesde}/m²`,
  },
  {
    id: "pintura",
    titulo: "Pintura",
    resumen: "Tu casa pintada y lista para habitar: elegís las manos y el color de cada superficie.",
    desde: `Desde ${formatRate(PAINT_DESDE_USD)}/m²`,
  },
];

export const EXTRAS_TEXTOS = {
  eyebrow: "Personalizá tu proyecto",
  titulo: "Extras y opcionales",
  subtitulo:
    "Sumá a tu vivienda lo que necesites. Ningún extra está incluido en el precio base: cada uno se cotiza aparte y lo ves sumado en el total con extras.",
  listaEtiqueta: "Extras disponibles",
  agregado: "Agregado",
  opcional: "Opcional",
  nota: "Los decks y la pintura figuran como «no incluidos» en el precio base: acá los podés sumar.",
} as const;
