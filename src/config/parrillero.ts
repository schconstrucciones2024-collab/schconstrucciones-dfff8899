/**
 * Parrilleros SCH (opcional): parrillero de mampostería con hogar refractario, chimenea y mesada auxiliar con bacha.
 *
 * Es un extra que NO está incluido en el presupuesto de la vivienda. Todo lo que se pueda querer editar (precios, medidas,
 * textos) vive en este archivo; los componentes solo lo leen. El 3D, el cotizador de la página y el paso «Extras» del
 * diseñador usan estos mismos datos, y el diseño guarda UNA sola configuración (`ParrilleroConfig`).
 *
 * Los precios son fijos y en pesos uruguayos, con el dólar de referencia ya calculado: no se consulta ningún tipo de cambio.
 * Las medidas son parámetros iniciales de diseño, no medidas certificadas: la obra se confirma con la visita.
 */

export type ParrilleroFinish = "ladrillo" | "revoque";
export const PARRILLERO_FINISHES: readonly ParrilleroFinish[] = ["ladrillo", "revoque"];
export const DEFAULT_PARRILLERO_FINISH: ParrilleroFinish = "ladrillo";

/** Lateral de la casa, mirando la fachada de la entrada desde afuera (no depende de la cámara). */
export type ParrilleroSide = "izquierdo" | "derecho";
export const PARRILLERO_SIDES: readonly ParrilleroSide[] = ["izquierdo", "derecho"];
export const DEFAULT_PARRILLERO_SIDE: ParrilleroSide = "izquierdo";

/** Lo único que guarda el diseño: el resto (precio, medidas, huella, relación con el deck y el techo) se calcula de acá. */
export type ParrilleroConfig = {
  /** «Agregar parrillero». */
  enabled: boolean;
  finish: ParrilleroFinish;
  side: ParrilleroSide;
  /** Bacha y grifería sobre la mesada integrada. Va incluida en el precio: no cambia el valor. */
  sink: boolean;
  /**
   * Cuánto se movió del lugar donde nace (pegado a la casa, con el fondo sobre la línea del borde del frente): `dx` hacia la
   * derecha de quien mira la fachada y `dz` hacia afuera de la casa, en metros. Moverlo o girarlo no cambia el precio.
   */
  dx: number;
  dz: number;
  /** Giro (grados, 0–359) alrededor del centro de su huella. 0 = con el fondo sobre la línea del borde de la casa. */
  rot: number;
};

export const DEFAULT_PARRILLERO: ParrilleroConfig = {
  enabled: false,
  finish: DEFAULT_PARRILLERO_FINISH,
  side: DEFAULT_PARRILLERO_SIDE,
  sink: true,
  dx: 0,
  dz: 0,
  rot: 0,
};

/** Cuánto puede alejarse (m) del lugar donde nace; más que eso sale del terreno de todos modos. */
export const PARRILLERO_MOVER_MAX = 30;
/** El 3D encaja el movimiento a esta grilla (m) y el giro a estos grados; el panel mueve de a `PARRILLERO_PASO_PANEL`. */
export const PARRILLERO_PASO_MOVER = 0.05;
export const PARRILLERO_PASO_GIRO = 5;
export const PARRILLERO_PASO_PANEL = 0.1;

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const metros = (v: unknown) => Math.round(Math.max(-PARRILLERO_MOVER_MAX, Math.min(PARRILLERO_MOVER_MAX, num(v))) * 100) / 100;
/** Giro válido: entero entre 0 y 359 (se acepta cualquier número, también negativo). */
export const normalizeRot = (v: unknown) => ((Math.round(num(v)) % 360) + 360) % 360;

/** Deja cualquier entrada (un diseño viejo, un link compartido) como una configuración válida. */
export function normalizeParrillero(input?: Partial<ParrilleroConfig> | null): ParrilleroConfig {
  const p = input ?? {};
  return {
    enabled: p.enabled === true,
    finish: p.finish === "revoque" ? "revoque" : DEFAULT_PARRILLERO_FINISH,
    side: p.side === "derecho" ? "derecho" : DEFAULT_PARRILLERO_SIDE,
    sink: p.sink !== false,
    dx: metros(p.dx) + 0,
    dz: metros(p.dz) + 0,
    rot: normalizeRot(p.rot),
  };
}

/** ¿Está en el lugar donde nace (sin moverlo ni girarlo)? */
export const parrilleroEnSuLugar = (p: Pick<ParrilleroConfig, "dx" | "dz" | "rot">) => p.dx === 0 && p.dz === 0 && p.rot === 0;

/** ¿Está agregado al presupuesto? */
export const parrilleroIsActive = (p: Pick<ParrilleroConfig, "enabled">) => p.enabled === true;

/**
 * Precios fijos (sin tipo de cambio en vivo): pesos uruguayos y su referencia en dólares. Los totales del cotizador están en
 * dólares, así que al sumar se usa la referencia; en pantalla se muestra primero el precio en pesos.
 */
export const PARRILLERO_PRECIOS: Record<ParrilleroFinish, { uyu: number; usd: number }> = {
  ladrillo: { uyu: 108000, usd: 2665 },
  revoque: { uyu: 122000, usd: 3010 },
};

/**
 * ¿Se aplica el costo logístico de la zona (como al deck y a la pintura)? Con la obra en Punta del Diablo no suma nada. Si no
 * querés recargar el parrillero fuera de la zona, poné `false`: el precio queda fijo en cualquier zona.
 */
export const PARRILLERO_LLEVA_LOGISTICA = true;

/**
 * Si un deck rodea al parrillero, ¿la mesada se mantiene a `alturaMesada` sobre el deck (la base de ladrillo sube desde el
 * terreno) o sobre el terreno? Con `true` (lo normal: se cocina parado sobre el deck) la mesada queda a 0,90 m del deck; con
 * `false` queda a 0,90 m del terreno, y en una casa sobre pilotes eso es casi a ras del deck (~0,79 m de alto).
 */
export const PARRILLERO_MESADA_SOBRE_DECK = true;

export const PARRILLERO_NOMBRES: Record<ParrilleroFinish, string> = {
  ladrillo: "Ladrillo visto",
  revoque: "Revoque fino",
};
export const PARRILLERO_LADOS: Record<ParrilleroSide, string> = {
  izquierdo: "Lateral izquierdo",
  derecho: "Lateral derecho",
};

/** «$U 108.000». */
export const formatUYU = (value: number) => "$U " + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** «USD 2.665» (con punto de miles: `toLocaleString` en español no agrupa los números de cuatro cifras). */
export const formatUSDRef = (value: number) => "USD " + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export type ParrilleroPrice = {
  active: boolean;
  finish: ParrilleroFinish;
  /** Precio fijo en pesos y su referencia en dólares (sin logística). */
  uyu: number;
  usd: number;
};

export function parrilleroPrice(p: ParrilleroConfig): ParrilleroPrice {
  const { uyu, usd } = PARRILLERO_PRECIOS[p.finish];
  return { active: parrilleroIsActive(p), finish: p.finish, uyu, usd };
}

/**
 * Medidas de diseño (m), todas en un solo lugar. Son parámetros iniciales, no medidas certificadas.
 *
 * Marco del parrillero: `u` a lo largo de los 3,00 m (u = 0 en el extremo de la mesada, el que queda del lado de la casa) y
 * `v` a lo largo de la profundidad (v = 0 en el fondo, v = profundidad en la boca). Reparto de `u`:
 * pilar de punta · mesada · muro divisorio · hogar · muro del extremo.
 */
export const PARRILLERO_DIMS = {
  /** Largo total, a lo largo del lateral de la casa, y profundidad (de la boca al fondo). */
  anchoTotal: 3.0,
  profundidad: 0.9,
  /** Altura de la losa (cara superior de la mesada y piso del hogar). */
  alturaMesada: 0.9,
  espesorLosa: 0.08,
  /** Hogar: ancho útil entre las caras refractarias, profundo útil y alto de la boca. */
  hogarAncho: 1.2,
  hogarProfundo: 0.65,
  bocaAlto: 0.7,
  /** Mesada lateral (a la izquierda o a la derecha del hogar), con la bacha. */
  mesadaLargo: 1.35,
  /** Chimenea: altura medida desde la mesada, y sección. */
  chimeneaAltura: 2.6,
  chimeneaSeccion: 0.6,
  /** Espesor de los muros (pilar de punta, divisorio y extremo) y del refractario que los reviste. */
  muro: 0.15,
  refractario: 0.04,
  /** Piso refractario del hogar, sobre la losa. */
  pisoHogar: 0.03,
  /** Dintel sobre la boca. */
  dintel: 0.12,
  /** La campana arranca en el dintel y baja en diagonal desde la chimenea hasta el borde de la mesada. */
  campanaAltoChimenea: 2.55,
  campanaAltoBorde: 1.85,
  /** Remate (tapa maciza) de la chimenea. */
  tapaEspesor: 0.07,
  tapaVuelo: 0.04,
  /**
   * Respiraderos: la salida del humo es por aberturas en las cuatro caras del cuerpo, justo debajo de la tapa (como en una
   * chimenea de casa real), no por un agujero arriba. Alto de las aberturas (dos hiladas) y lado de los pilarcitos de las esquinas.
   */
  respiraderoAlto: 0.15,
  respiraderoPilar: 0.15,
  /** Piso de hormigón bajo la mesada y el hogar cuando hay deck (lugar de la leña): espesor, con la cara superior a ras del deck. */
  pisoNichoEspesor: 0.1,
  /** Bacha: ancho (a lo largo de u), fondo (v) y profundidad. */
  bachaAncho: 0.5,
  bachaFondo: 0.36,
  bachaProfundo: 0.16,
  /** Cuánto se entierra la base bajo el nivel del terreno, para que no quede flotando sobre un suelo irregular. */
  enterrado: 0.05,
} as const;

/**
 * Ubicación respecto de la casa: el parrillero nace PEGADO a la casa, en el extremo izquierdo o derecho de la fachada de la
 * entrada (mirándola de frente): el extremo de la mesada apoya contra el muro de la fachada y la línea de atrás del parrillero
 * sigue la línea del borde de la casa (el mismo plano que el muro lateral). La boca mira hacia el centro del frente. Desde ahí
 * se puede mover y girar. Son distancias iniciales de diseño: las confirma el maestro en la visita.
 */
export const PARRILLERO_UBICACION = {
  /** Separación (m) entre la línea del borde de la casa y el fondo del parrillero: 0 = fondo sobre esa línea. */
  separacionCasa: 0,
  /** Retranqueo (m) del extremo de la mesada respecto del plano de la fachada: 0 = apoyado contra el muro. */
  retranqueo: 0,
  /** Libre mínimo (m) alrededor de la huella para dar aviso de una puerta o ventana que quedaría tapada. */
  libreMinimo: 0.05,
} as const;

export const PARRILLERO_TEXTOS = {
  nombre: "PARRILLEROS SCH",
  titulo: "Parrilleros SCH",
  eslogan: "Un espacio pensado para disfrutar.",
  descripcion:
    "Un espacio pensado para disfrutar. Parrilleros de mampostería construidos con ladrillo, hogar refractario, chimenea y mesada auxiliar integrada.",
  resumenTarjeta: "Parrillero de mampostería con hogar refractario, chimenea y mesada con bacha. En ladrillo visto o revoque fino.",
  aviso: "Opcional. No incluido en el presupuesto de la vivienda. Se suma como extra.",
  letraChica:
    "Precio fijo en pesos uruguayos con su referencia en dólares. Medidas de diseño, sujetas a visita y medidas finales.",
  agregar: "Agregar parrillero",
  quitar: "Quitar parrillero",
  terminacion: "Terminación",
  terminacionAyuda: "Solo cambia el acabado exterior: la forma, las medidas, el hogar refractario, la chimenea y la mesada son las mismas.",
  ubicacion: "Ubicación",
  ubicacionAyuda: "Mirando la casa de frente, desde afuera.",
  mesada: "Mesada con bacha integrada",
  mesadaAyuda: "Mesada auxiliar de hormigón, continuación de la losa, con bacha de acero inoxidable y grifería. Incluida en el precio.",
  incluye: [
    "Base de mampostería sobre el terreno y losa de hormigón armado.",
    "Hogar con revestimiento de ladrillo refractario (fondo, laterales y piso).",
    "Campana de ladrillo en diagonal y chimenea de ladrillo con remate.",
    "Mesada auxiliar integrada, con bacha de acero inoxidable y grifería.",
  ],
  noIncluye: [
    "Parrilla, accesorios y utensilios.",
    "Conexiones de agua y desagüe de la bacha (se definen en la visita).",
    "Cambios de tamaño o de forma: se cotizan a medida.",
  ],
  precioTitulo: "Precio",
  referencia: "Referencia",
  logistica: "Costo logístico del extra",
  totalExtra: "Total del extra",
  sinEspacio: "No hay lugar libre de este lado.",
  deckNoLlega: "El deck no llega hasta el parrillero.",
  deckLoRodea: "El deck se recorta y rodea al parrillero.",
  techoAdaptado: "El techo del deck solo se abre en el hueco de la chimenea; el resto queda techado.",
  techoBajo: "El techo del deck queda más bajo que la campana: se abre también para la campana.",
  giroLibre:
    "Con un giro que no es recto, el deck se recorta con el rectángulo que contiene al parrillero: queda un poco de hueco en las puntas.",
  mover: "Mover y girar",
  moverAyuda:
    "Tocá el parrillero en el 3D para seleccionarlo y arrastralo para moverlo; con el botón de giro lo rotás. También podés usar estos botones (mueven de a 10 cm). Moverlo o girarlo no cambia el precio.",
  izquierda: "Izquierda",
  derecha: "Derecha",
  haciaCasa: "Hacia la casa",
  haciaAfuera: "Hacia afuera",
  girarIzquierda: "Girar 90° a la izquierda",
  girarDerecha: "Girar 90° a la derecha",
  volverLugar: "Volver a su lugar",
  /** `cm`: cuánto sube la base desde el terreno para que la mesada quede a 0,90 m sobre el deck. */
  baseElevada: (cm: number) =>
    `La base del parrillero sube ${cm} cm desde el terreno: la mesada queda a 0,90 m sobre el deck, donde se cocina parado.`,
  mesadaAlDeck: "El deck queda casi a la altura de la mesada del parrillero: no se puede usar parado sobre el deck.",
  ampliarDeck: "Ampliar el deck hasta el parrillero",
  ampliarDeckAyuda: "Agranda el ancho del deck lo justo para rodearlo (se actualiza el precio del deck).",
} as const;

/** Lo que se ve de la opción elegida, para el resumen copiable y el mensaje de WhatsApp. */
export function parrilleroLabel(p: ParrilleroConfig): string {
  return `${PARRILLERO_TEXTOS.nombre} · Terminación: ${PARRILLERO_NOMBRES[p.finish]} · Ubicación: ${PARRILLERO_LADOS[p.side]}${p.sink ? " · Mesada con bacha" : ""}`;
}

/** Lo mismo, una línea por dato: «PARRILLERO SCH / Terminación: … / Ubicación: … / precio». */
export function parrilleroSummaryLines(p: ParrilleroConfig): string[] {
  const { uyu, usd } = parrilleroPrice(p);
  return [
    "PARRILLERO SCH",
    `Terminación: ${PARRILLERO_NOMBRES[p.finish]}`,
    `Ubicación: ${PARRILLERO_LADOS[p.side]}`,
    ...(p.sink ? ["Mesada con bacha integrada"] : []),
    `Precio: ${formatUYU(uyu)} (ref. ${formatUSDRef(usd)})`,
  ];
}
