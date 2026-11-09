/**
 * Deck y techado (opcional): precios, límites, textos y medidas de dibujo.
 *
 * Es un extra que NO está incluido en el presupuesto de la vivienda. Todo lo que se pueda querer editar (precios,
 * límites, textos) vive en este archivo; los componentes solo lo leen. Los precios están en dólares.
 */

/** Deck de pino curado sobre pilotes, por m². */
export const DECK_PRECIO_M2 = 130;
/** Deck con techo de chapa, por m². Ya incluye el deck: nunca se suman los dos precios. */
export const DECK_TECHADO_PRECIO_M2 = 250;
/** Baranda de madera, por metro lineal. */
export const BARANDA_PRECIO_ML = 50;

export const DECK_LIMITES = {
  /**
   * Medidas con las que arranca el deck: el frente es el de la casa (ver `DeckConfig.fullFront`); `frenteInicial` solo vale
   * donde no hay un diseño (el cotizador de la página).
   */
  frenteInicial: 4,
  profundidadInicial: 3,
  /**
   * Máximo que se cotiza online; por encima, el precio sería «A cotizar». Sin límite desde el pedido del 9/11: el cliente
   * agranda o achica el deck a gusto y el precio siempre se calcula. Para volver a exigir presupuesto a medida, poné un
   * número acá (por ejemplo 8 y 3).
   */
  frenteMax: Infinity,
  profundidadMax: Infinity,
  /** Mínimos, y topes técnicos que solo protegen al visor de un número absurdo (no son un límite comercial). */
  frenteMin: 1,
  profundidadMin: 1,
  frenteTope: 100,
  profundidadTope: 50,
  /** Resolución de las medidas (m). */
  paso: 0.1,
} as const;

export type DeckConfig = {
  /** «Agregar deck». */
  enabled: boolean;
  /** «Agregar techo al deck»: solo vale con el deck activo. */
  roofed: boolean;
  /**
   * Por defecto el deck cubre todo el frente de la casa (la pared de la puerta de entrada) y lo sigue si cambia la forma
   * de la casa. Al escribir un frente propio pasa a false. Donde se conoce el frente, `resolveDeck` lo traduce a `width`.
   */
  fullFront: boolean;
  /** Frente (m), a lo largo de la fachada. */
  width: number;
  /** Profundidad (m), hacia afuera de la casa. */
  depth: number;
  /** Baranda al frente y en cada lateral. El lado pegado a la casa nunca lleva. */
  railFront: boolean;
  railLeft: boolean;
  railRight: boolean;
  /** Escalones: se muestran en el 3D pero se cotizan aparte. */
  steps: boolean;
};

export const DEFAULT_DECK: DeckConfig = {
  enabled: false,
  roofed: false,
  fullFront: true,
  width: DECK_LIMITES.frenteInicial,
  depth: DECK_LIMITES.profundidadInicial,
  railFront: false,
  railLeft: false,
  railRight: false,
  steps: false,
};

const round = (n: number, digits: number) => {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
};
const finiteOr = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export const clampFrente = (v: number, digits = 1) =>
  round(Math.min(DECK_LIMITES.frenteTope, Math.max(DECK_LIMITES.frenteMin, v)), digits);
export const clampProfundidad = (v: number) =>
  round(Math.min(DECK_LIMITES.profundidadTope, Math.max(DECK_LIMITES.profundidadMin, v)), 1);

/** Deja cualquier entrada (un diseño viejo, un link compartido, un campo a medio escribir) como un deck válido. */
export function normalizeDeck(input?: Partial<DeckConfig> | null): DeckConfig {
  const d = input ?? {};
  const enabled = d.enabled === true;
  return {
    enabled,
    roofed: enabled && d.roofed === true,
    fullFront: d.fullFront !== false,
    width: clampFrente(finiteOr(d.width, DEFAULT_DECK.width)),
    depth: clampProfundidad(finiteOr(d.depth, DEFAULT_DECK.depth)),
    railFront: d.railFront === true,
    railLeft: d.railLeft === true,
    railRight: d.railRight === true,
    steps: d.steps === true,
  };
}

/** m² del deck (frente × profundidad). */
export const deckArea = (d: Pick<DeckConfig, "width" | "depth">) => round(d.width * d.depth, 2);

/** Metros lineales de baranda: frente = ancho; cada lateral = profundidad. */
export const deckRailMl = (d: DeckConfig) =>
  round((d.railFront ? d.width : 0) + (d.railLeft ? d.depth : 0) + (d.railRight ? d.depth : 0), 2);

const EPS = 1e-9;
/** ¿Entra en lo que se cotiza online? (hasta 8 m de frente y 3 m de profundidad). */
export const deckWithinLimits = (d: Pick<DeckConfig, "width" | "depth">) =>
  d.width <= DECK_LIMITES.frenteMax + EPS && d.depth <= DECK_LIMITES.profundidadMax + EPS;

export type DeckPrice = {
  active: boolean;
  area: number;
  railMl: number;
  /** false si se pasa de 8 × 3 m: el precio es «A cotizar». */
  quotable: boolean;
  /** USD/m² aplicado (130 con deck solo, 250 con techo). */
  rate: number;
  deck: number | null;
  rails: number | null;
  /** Total del extra sin costo logístico; null si es «A cotizar». */
  subtotal: number | null;
};

/** Precio del extra: m² × tarifa (130 o 250) + ml de barandas × 50. Los escalones no suman. */
export function deckPrice(deck: DeckConfig): DeckPrice {
  const area = deckArea(deck),
    railMl = deckRailMl(deck),
    rate = deck.roofed ? DECK_TECHADO_PRECIO_M2 : DECK_PRECIO_M2,
    quotable = deckWithinLimits(deck);
  if (!deck.enabled)
    return { active: false, area, railMl, quotable, rate, deck: null, rails: null, subtotal: null };
  if (!quotable)
    return { active: true, area, railMl, quotable, rate, deck: null, rails: null, subtotal: null };
  const base = Math.round(area * rate),
    rails = Math.round(railMl * BARANDA_PRECIO_ML);
  return { active: true, area, railMl, quotable, rate, deck: base, rails, subtotal: base + rails };
}

/** Texto para donde iría un precio que no se puede calcular. */
export const DECK_A_COTIZAR = "A cotizar";

/** Altura (m) de la cara superior del deck por debajo del umbral de la puerta de entrada, para entrar bajando un escalón. */
export const DECK_DESNIVEL_UMBRAL = 0.06;

export const DECK_TEXTOS = {
  titulo: "Deck y techado (opcional)",
  subtitulo:
    "Ampliá tu casa hacia afuera con un deck de pino curado sobre pilotes, con o sin techo.",
  aviso: "Opcional. No incluido en el presupuesto de la vivienda. Se suma como extra.",
  letraChica: "Precio estimado en dólares, sujeto a visita y medidas finales.",
  deckTitulo: "Agregar deck",
  deck: "Deck de pino curado sobre pilotes, pegado al frente de la casa y continuando hacia el exterior. Estructura de tirantes de 6x2 y tabla de deck con tinte protector.",
  techoTitulo: "Agregar techo al deck",
  techo:
    "El mismo deck con techo de chapa galvanizada trapezoidal, postes dobles de 6x2 y estructura de pino curado. Para disfrutar del exterior con sol o con lluvia.",
  techoNecesitaDeck: "Primero activá el deck.",
  medidas: "Medidas del deck",
  frente: "Frente (m)",
  profundidad: "Profundidad (m)",
  barandas: "Barandas",
  barandaFrente: "Frente",
  barandaIzquierda: "Lateral izquierdo",
  barandaDerecha: "Lateral derecho",
  barandaNota: "El lado pegado a la casa no lleva baranda.",
  escalones: "Escalones",
  escalonesPrecio: "A cotizar",
  fueraDeLimite: "Con estas medidas el deck se cotiza a medida: el precio es «A cotizar».",
  ajustable:
    "Agrandalo o achicalo a tu gusto: no hay límite de medidas y el precio se actualiza solo.",
  frenteCompleto: "Cubrir todo el frente de la casa",
  frenteCompletoAyuda: "El deck ocupa el frente completo, donde está la puerta de entrada.",
  masChico: "Achicar",
  masGrande: "Agrandar",
  vivienda: "Vivienda",
  extras: "Extras opcionales",
  totalConExtras: "Total con extras",
  logistica: "Costo logístico del extra",
  incluyeTitulo: "Qué incluye",
  noIncluyeTitulo: "Qué no incluye",
  faqPregunta: "¿El deck viene incluido en el precio de la casa?",
  faqRespuesta:
    "No. El deck y el techado son un extra opcional que se presupuesta aparte. Si lo querés, lo sumás en el cotizador y ves el costo total.",
} as const;

export const DECK_INCLUYE = {
  deckTitulo: "Deck, todo en pino curado CCA, con materiales y mano de obra:",
  deck: [
    "Pilotes que apoyan el deck sobre el terreno.",
    "Vigas principales: tirantes 6x2 de primera, de 3,30 m, abajo sobre los pilotes.",
    "Tirantes secundarios: 6x2 de primera, de 3,30 m, arriba de las vigas.",
    'Tabla de deck 1"x6" de 3,30 m.',
    "Tornillos galvanizados o inoxidables y tinte protector para exterior.",
  ],
  techoTitulo: "Techo del deck (solo en «Deck techado»):",
  techo: [
    "Postes dobles de 6x2.",
    "Vigas principales 6x2: una contra la casa, otra en el lado opuesto y una en cada lateral del ancho del deck.",
    "Tirantes secundarios 4x2, clavadores y chapa galvanizada trapezoidal.",
    "Herrajes y fijaciones galvanizados, y tinte protector.",
  ],
  nota: "El techo cubre el deck; un alero mayor se mide y se cotiza aparte.",
} as const;

export const DECK_NO_INCLUYE = [
  "Barandas y escalones (se cotizan aparte).",
  "Cielorraso y aislación del techo del deck.",
  "Instalación eléctrica e iluminación del deck.",
  "Canaletas y bajadas de agua.",
  "Parrillero, mobiliario y decoración.",
] as const;

/** Medidas de dibujo del visor 3D (m). */
export const DECK_3D = {
  /** Tabla 1"x6": 2,5 cm de espesor y 14 cm de ancho, con una junta de 8 mm. */
  tablaEspesor: 0.025,
  tablaAncho: 0.14,
  tablaJunta: 0.008,
  /** Largo de las maderas del comercio: las tablas y los tirantes se empalman cada 3,30 m. */
  largoMadera: 3.3,
  /** Tirante 6x2 apoyado de canto. */
  tiranteAlto: 0.15,
  tiranteAncho: 0.05,
  tiranteSeparacion: 0.4,
  /** Separación máxima entre pilotes de una misma viga, y escuadría del pilote. */
  pilotesCada: 1.65,
  pilote: 0.14,
  /** Techo: altura libre sobre el deck en el borde exterior y caída hacia afuera. */
  techoAlturaExterior: 2.3,
  techoPendiente: 0.08,
  techoAlturaMax: 2.58,
  posteSeccion: [0.105, 0.15] as const,
  /** Baranda. */
  barandaAltura: 1.0,
  barandaPoste: 0.08,
  barandaCada: 1.2,
  barandaTravesaño: [0.05, 0.04] as const,
  /**
   * Colores. La madera es pino curado de primera, color natural: el tinte es apenas un tono cálido sobre la veta de la
   * textura (no la pinta). La chapa es galvanizada, gris.
   */
  maderaColor: "#f3e7c9",
  chapaColor: "#a9aeb4",
  /** Escalones: ancho, huella y alzada máxima. */
  escalonAncho: 1.2,
  escalonHuella: 0.28,
  escalonAlzada: 0.18,
} as const;

/** Lo que se ve de una opción del deck, para el resumen copiable y el mensaje de WhatsApp. */
export function deckLabel(deck: DeckConfig): string {
  const lados = [
    deck.railFront && "frente",
    deck.railLeft && "lateral izquierdo",
    deck.railRight && "lateral derecho",
  ].filter(Boolean);
  return `${deck.roofed ? "Deck techado" : "Deck"} de ${String(deck.width).replace(".", ",")} × ${String(deck.depth).replace(".", ",")} m (${String(deckArea(deck)).replace(".", ",")} m²)${
    lados.length ? ` con baranda en ${lados.join(", ")}` : ""
  }${deck.steps ? " y escalones" : ""}`;
}
