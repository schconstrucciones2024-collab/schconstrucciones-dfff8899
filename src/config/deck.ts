/**
 * Deck y techado (opcional): líneas, precios, límites, textos y medidas de dibujo.
 *
 * Es un extra que NO está incluido en el presupuesto de la vivienda. Todo lo que se pueda querer editar (precios,
 * límites, textos) vive en este archivo; los componentes solo lo leen. Los precios están en dólares.
 *
 * Hay dos líneas, con la misma estructura y distinta calidad:
 *  - Esencial (accesible): madera curada CCA, estructura firme, entregado instalado y lijado, listo para pintar.
 *  - Premium: madera de primera con cantos trabajados, tirantería sobredimensionada, herrajes para ambiente marino
 *    y 2 a 3 manos de protector costero.
 */

export type DeckLine = "esencial" | "premium";
export const DECK_LINES: readonly DeckLine[] = ["esencial", "premium"];
export const DEFAULT_DECK_LINE: DeckLine = "esencial";

/** Un renglón de la ficha técnica: «Estructura y piso» + su texto. */
export type DeckSpec = { label: string; text: string };
/** Una de las tres fichas de cada línea: deck solo, deck techado y barandas. */
export type DeckSpecGroup = { titulo: string; items: readonly DeckSpec[] };

export type DeckLineInfo = {
  id: DeckLine;
  nombre: string;
  /** Cómo se la presenta en una palabra. */
  apodo: string;
  resumen: string;
  /** USD por m² (deck solo y deck techado) y por metro lineal (baranda). */
  precios: { deck: number; techado: number; baranda: number };
  specs: { deck: DeckSpecGroup; techado: DeckSpecGroup; baranda: DeckSpecGroup };
};

export const DECK_LINEAS: Record<DeckLine, DeckLineInfo> = {
  esencial: {
    id: "esencial",
    nombre: "Esencial",
    apodo: "Accesible",
    resumen:
      "La opción accesible: madera curada CCA, estructura firme y entrega instalada y lijada, lista para pintar.",
    precios: { deck: 105, techado: 195, baranda: 40 },
    specs: {
      deck: {
        titulo: "Deck solo (sin techo)",
        items: [
          {
            label: "Estructura y piso",
            text: "Madera en Pino / Eucalipto 100% curada y tratada en autoclave (CCA) para máxima resistencia a la humedad de suelo.",
          },
          {
            label: "Subestructura",
            text: "Tirantes colocados sobre dados/pilotines de hormigón con separación optimizada para garantizar rigidez estructural.",
          },
          {
            label: "Fijaciones",
            text: "Tornillería autoperforante con tratamiento anti-corrosión para intemperie.",
          },
          {
            label: "Acabado",
            text: "Entregado instalado y lijado, listo para pintar (aplicación de protector a cargo del cliente).",
          },
        ],
      },
      techado: {
        titulo: "Deck techado (pérgola con cubierta)",
        items: [
          {
            label: "Estructura",
            text: "Pérgola en madera tratada CCA (columnas y tirantería vista).",
          },
          {
            label: "Cubierta",
            text: "Techo de chapa aluminizada autoportante o sombreado de listones / pergolado abierto (sin machimbrado).",
          },
          {
            label: "Fijaciones",
            text: "Anclajes y herrajes reforzados para resistencia a los vientos de la costa.",
          },
          { label: "Acabado", text: "Madera al natural, entregada instalada y lijada." },
        ],
      },
      baranda: {
        titulo: "Barandas de seguridad",
        items: [
          {
            label: "Diseño",
            text: "Pasamanos funcional y minimalista con 2 o 3 travesaños horizontales en madera tratada CCA.",
          },
          { label: "Fijaciones", text: "Bulonería estándar protegida contra la intemperie." },
          { label: "Acabado", text: "Lijado, listo para aplicar protector." },
        ],
      },
    },
  },
  premium: {
    id: "premium",
    nombre: "Premium",
    apodo: "Alta gama",
    resumen:
      "Madera de primera con cantos trabajados, estructura sobredimensionada, herrajes para ambiente marino y 2 a 3 manos de protector costero.",
    precios: { deck: 130, techado: 225, baranda: 50 },
    specs: {
      deck: {
        titulo: "Deck solo (sin techo)",
        items: [
          {
            label: "Estructura y piso",
            text: "Madera en Pino / Eucalipto de primera calidad, 100% curada y tratada en autoclave (CCA), con cantos trabajados.",
          },
          {
            label: "Subestructura",
            text: "Tirantería sobredimensionada para pisada totalmente firme, sin flexión.",
          },
          {
            label: "Fijaciones",
            text: "Tornillería zincada / galvanizada de alta resistencia al ambiente marino.",
          },
          {
            label: "Acabado",
            text: "Entregado con 2 a 3 manos de protector/lasur costero especial para rayos UV y humedad salina.",
          },
        ],
      },
      techado: {
        titulo: "Deck techado (pérgola con cubierta)",
        items: [
          {
            label: "Estructura",
            text: "Pérgola reforzada en madera tratada CCA con columnas de mayor escuadría y tirantería vista de cuidada estética.",
          },
          {
            label: "Cubierta",
            text: "Techo de chapa acanalada prepintada o policarbonato alveolar apoyado directamente sobre la tirantería vista (sin machimbrado), con impermeabilización, babetas de ajuste e instalación de canaletas de desagüe pluvial.",
          },
          {
            label: "Fijaciones",
            text: "Herrajes galvanizados pesados y fijaciones de alta durabilidad para entorno marino.",
          },
          {
            label: "Acabado",
            text: "Aplicación completa de 2 a 3 manos de protector/lasur costero en toda la estructura de madera y tirantería vista.",
          },
        ],
      },
      baranda: {
        titulo: "Barandas de seguridad",
        items: [
          {
            label: "Diseño",
            text: "Estructura robusta de pasamanos cepillado con bordes biselados y listonado horizontal o vertical de mayor densidad.",
          },
          { label: "Fijaciones", text: "Tornillería oculta o de acero inoxidable." },
          {
            label: "Acabado",
            text: "Incluye 2 a 3 manos de protector/lasur costero aplicado en taller y obra.",
          },
        ],
      },
    },
  },
};

/** Precios de una línea: USD/m² del deck solo y del deck techado, y USD por metro lineal de baranda. */
export const deckRates = (line: DeckLine) => DECK_LINEAS[line].precios;
export const deckLineName = (line: DeckLine) => DECK_LINEAS[line].nombre;

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
  /** Línea del deck: Esencial (accesible) o Premium. Define los precios, la ficha técnica y cómo se ve en 3D. */
  line: DeckLine;
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
  line: DEFAULT_DECK_LINE,
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
    // Los diseños y links guardados antes de las dos líneas no la traen: quedan en Esencial, la que se venía mostrando.
    line: d.line === "premium" ? "premium" : DEFAULT_DECK_LINE,
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
  line: DeckLine;
  area: number;
  railMl: number;
  /** false si se pasa de 8 × 3 m: el precio es «A cotizar». */
  quotable: boolean;
  /** USD/m² aplicado: el del deck solo o el del deck techado, según la línea. */
  rate: number;
  /** USD por metro lineal de baranda, según la línea. */
  railRate: number;
  deck: number | null;
  rails: number | null;
  /** Total del extra sin costo logístico; null si es «A cotizar». */
  subtotal: number | null;
};

/** Precio del extra: m² × tarifa (deck solo o techado) + ml de barandas × tarifa, las tres según la línea. Los escalones no suman. */
export function deckPrice(deck: DeckConfig): DeckPrice {
  const area = deckArea(deck),
    railMl = deckRailMl(deck),
    line = deck.line,
    rates = deckRates(line),
    rate = deck.roofed ? rates.techado : rates.deck,
    railRate = rates.baranda,
    quotable = deckWithinLimits(deck);
  const head = { line, area, railMl, quotable, rate, railRate };
  if (!deck.enabled) return { active: false, ...head, deck: null, rails: null, subtotal: null };
  if (!quotable) return { active: true, ...head, deck: null, rails: null, subtotal: null };
  const base = Math.round(area * rate),
    rails = Math.round(railMl * railRate);
  return { active: true, ...head, deck: base, rails, subtotal: base + rails };
}

/** Texto para donde iría un precio que no se puede calcular. */
export const DECK_A_COTIZAR = "A cotizar";

/** Altura (m) de la cara superior del deck por debajo del umbral de la puerta de entrada, para entrar bajando un escalón. */
export const DECK_DESNIVEL_UMBRAL = 0.06;

export const DECK_TEXTOS = {
  titulo: "Deck y techado (opcional)",
  subtitulo:
    "Ampliá tu casa hacia afuera con un deck de madera curada, con o sin techo. Elegí entre dos líneas: Esencial (accesible) o Premium.",
  aviso: "Opcional. No incluido en el presupuesto de la vivienda. Se suma como extra.",
  letraChica: "Precio estimado en dólares, sujeto a visita y medidas finales.",
  lineaTitulo: "Elegí la línea",
  lineaAyuda: "Misma estructura y medidas: cambian la calidad de la madera, las fijaciones y la terminación.",
  lineaDeckSolo: "Deck solo",
  lineaDeckTechado: "Deck techado",
  lineaBaranda: "Baranda",
  deckTitulo: "Agregar deck",
  deckDescripcion: {
    esencial:
      "Deck de madera curada CCA sobre dados de hormigón, con tornillería anti-corrosión. Entregado instalado y lijado, listo para pintar.",
    premium:
      "Deck de madera de primera, curada CCA, con cantos trabajados y tirantería sobredimensionada. Entregado con 2 a 3 manos de protector costero.",
  } satisfies Record<DeckLine, string>,
  techoTitulo: "Agregar techo al deck",
  techoDescripcion: {
    esencial:
      "El mismo deck con pérgola de madera curada y techo de chapa aluminizada, sin machimbrado. Madera al natural.",
    premium:
      "El mismo deck con pérgola reforzada, techo de chapa acanalada prepintada, babetas, canaletas de desagüe y lasur costero completo.",
  } satisfies Record<DeckLine, string>,
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
  compararTitulo: "Comparar las dos líneas",
  noIncluyeTitulo: "Qué no incluye",
  faqPregunta: "¿El deck viene incluido en el precio de la casa?",
  faqRespuesta:
    "No. El deck y el techado son un extra opcional que se presupuesta aparte, en dos líneas: Esencial (accesible) y Premium, con mejor madera, fijaciones y terminación. Si lo querés, elegís la línea en el cotizador y ves el costo total.",
} as const;

/** Nota que acompaña a la ficha del deck techado, en las dos líneas. */
export const DECK_NOTA_TECHO = "El techo cubre el deck; un alero mayor se mide y se cotiza aparte.";

const NO_INCLUYE_BASE = [
  "Barandas y escalones (se cotizan aparte).",
  "Cielorraso y aislación del techo del deck.",
  "Instalación eléctrica e iluminación del deck.",
  "Parrillero, mobiliario y decoración.",
] as const;

/**
 * Lo que no incluye cada línea. La Esencial entrega la madera lista para pintar (el protector queda a cargo del cliente) y
 * no lleva canaletas; la Premium incluye el protector costero y las canaletas de desagüe pluvial.
 */
export function deckNoIncluye(line: DeckLine): readonly string[] {
  return line === "premium"
    ? NO_INCLUYE_BASE
    : [
        ...NO_INCLUYE_BASE,
        "Aplicación de protector o pintura (queda a cargo del cliente).",
        "Canaletas y bajadas de agua.",
      ];
}

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
  /** Escalones: ancho, huella y alzada máxima. */
  escalonAncho: 1.2,
  escalonHuella: 0.28,
  escalonAlzada: 0.18,
} as const;

/** Perfil de la chapa del techo: trapezoidal (paso 10 cm, nervio 3 cm) o acanalada (onda de 7,6 cm y 1,8 cm de altura). */
export type DeckSheet = {
  perfil: "trapezoidal" | "acanalada";
  paso: number;
  nervio: number;
  color: string;
  metal: number;
  rugosidad: number;
};

/**
 * Cómo se ve cada línea en el visor 3D. La estructura es la misma (mismos tirantes, vigas, pilotes, postes y chapa); lo que
 * cambia es la calidad que se nota: el color y el brillo de la madera (al natural / lasur costero), los cantos biselados, el
 * zócalo perimetral, los tirantes más densos, las barandas con listonado y pasamanos biselado, las columnas de la pérgola, los
 * herrajes, la chapa (aluminizada trapezoidal / prepintada acanalada) y las canaletas.
 */
export const DECK_LOOK = {
  esencial: {
    madera: { color: "#f3e7c9", rugosidad: 1 },
    /** Tirante: ancho (m) y separación entre ejes (m). */
    tirante: { ancho: 0.05, separacion: 0.4 },
    /** Bisel de los cantos de las tablas (m); 0 = canto recto. */
    canto: 0,
    /** Tornillos autoperforantes a la vista sobre cada tirante. */
    tornillos: true,
    /** Zócalo de madera que tapa los cantos del deck. */
    zocalo: false,
    baranda: {
      poste: 0.08,
      /** Pasamanos: alto, ancho y bisel (m). */
      pasamanos: { alto: 0.04, ancho: 0.1, bisel: 0 },
      /** Alturas de los travesaños sobre el deck; con `listones` se reemplazan por el listonado denso. */
      travesaños: [0.35, 0.68] as readonly number[],
      listones: false,
    },
    techo: {
      /** Viga a lo ancho: alto y espesor (m). */
      viga: { alto: 0.15, ancho: 0.05 },
      /** Tirante secundario: ancho, alto y separación entre ejes (m). */
      tirante: { ancho: 0.05, alto: 0.1, separacion: 0.6 },
      alero: 0.12,
      /** Poste doble (dos 6x2 pegados) o columna única, con su sección (m) y bisel. */
      poste: { doble: true, seccion: [0.105, 0.15] as readonly [number, number], bisel: 0 },
      herrajes: false,
      canaletas: false,
    },
    chapa: {
      perfil: "trapezoidal",
      paso: 0.1,
      nervio: 0.03,
      color: "#b9bfc5",
      metal: 0.6,
      rugosidad: 0.45,
    } satisfies DeckSheet,
  },
  premium: {
    madera: { color: "#dba66a", rugosidad: 0.55 },
    tirante: { ancho: 0.06, separacion: 0.3 },
    canto: 0.004,
    tornillos: false,
    zocalo: true,
    baranda: {
      poste: 0.1,
      pasamanos: { alto: 0.05, ancho: 0.13, bisel: 0.008 },
      travesaños: [] as readonly number[],
      listones: true,
    },
    techo: {
      viga: { alto: 0.18, ancho: 0.07 },
      tirante: { ancho: 0.06, alto: 0.12, separacion: 0.5 },
      alero: 0.25,
      poste: { doble: false, seccion: [0.16, 0.16] as readonly [number, number], bisel: 0.006 },
      herrajes: true,
      canaletas: true,
    },
    chapa: {
      perfil: "acanalada",
      paso: 0.076,
      nervio: 0.018,
      color: "#3f454c",
      metal: 0.25,
      rugosidad: 0.5,
    } satisfies DeckSheet,
  },
} as const;

/** Colores del 3D que no dependen de la línea. */
export const DECK_3D_COLORES = {
  /** Dados / pilotines de hormigón sobre los que apoyan los tirantes. */
  hormigon: "#a6a6a0",
  /** Tornillos a la vista de la línea Esencial. */
  tornillo: "#5d4b36",
  /** Herrajes galvanizados de la pérgola Premium. */
  herraje: "#8b9299",
} as const;

/** Lo que se ve de una opción del deck, para el resumen copiable y el mensaje de WhatsApp. */
export function deckLabel(deck: DeckConfig): string {
  const lados = [
    deck.railFront && "frente",
    deck.railLeft && "lateral izquierdo",
    deck.railRight && "lateral derecho",
  ].filter(Boolean);
  return `${deck.roofed ? "Deck techado" : "Deck"} línea ${deckLineName(deck.line)} de ${String(deck.width).replace(".", ",")} × ${String(deck.depth).replace(".", ",")} m (${String(deckArea(deck)).replace(".", ",")} m²)${
    lados.length ? ` con baranda en ${lados.join(", ")}` : ""
  }${deck.steps ? " y escalones" : ""}`;
}
