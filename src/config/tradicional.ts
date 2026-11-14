/**
 * Construcción tradicional: descuento por superficie y textos de «qué incluye este precio».
 *
 * Es el ÚNICO lugar donde viven los tramos de metraje y los textos de valor de la construcción tradicional: el cotizador,
 * el diseñador 3D (que calcula con `configPrice`), las páginas y las preguntas frecuentes leen de acá. Las tarifas base
 * por m² (Esencial / Clásica) están en `SYSTEMS.tradicional` de `lib/cotizador.ts`.
 *
 * Es liviano a propósito (sin importar nada): lo carga el cotizador de la página.
 */

export type TradicionalId = "esencial" | "clasica";

/** Techo Liviano = Esencial; Losa de hormigón armado = Clásica. */
export const TRADICIONAL_OPCION: Record<TradicionalId, string> = { esencial: "Techo Liviano", clasica: "Losa" };

export type VolumeTier = { /** m² desde los que rige el tramo (inclusive). */ from: number; /** % de descuento sobre el precio por m². */ discount: number };

/**
 * Descuento automático por superficie, de mayor a menor:
 *  · de 35 a 64 m² → tarifa base (0%)
 *  · de 65 a 89 m² → 5% sobre el precio por m²
 *  · de 90 m² en adelante → 8% sobre el precio por m²
 * Con menos de 35 m² también rige la tarifa base (sin descuento).
 */
export const VOLUME_TIERS: readonly VolumeTier[] = [
  { from: 90, discount: 8 },
  { from: 65, discount: 5 },
];

/** Desde cuántos m² se muestra la tarifa base como un tramo propio (35 a 64 m²). Solo informativo: debajo también es tarifa base. */
export const TARIFA_BASE_DESDE = 35;

/** % de descuento por superficie que corresponde a esa cantidad de m² (0 si no llega al primer tramo). */
export const volumeDiscount = (area: number): number => VOLUME_TIERS.find((t) => area >= t.from)?.discount ?? 0;

/** Precio por m² con el descuento aplicado, en USD enteros: 1.200 → 1.140 (5%) → 1.104 (8%). */
export const discountedRate = (price: number, area: number): number => Math.round((price * (100 - volumeDiscount(area))) / 100);

/** El próximo tramo que se alcanza al sumar metros (o null si ya está en el último). */
export const nextVolumeTier = (area: number): VolumeTier | null => {
  const ahead = VOLUME_TIERS.filter((t) => t.from > area);
  return ahead.length === 0 ? null : (ahead[ahead.length - 1] ?? null);
};

/** Los tramos tal como se explican: «35 a 64 m²: tarifa base», «65 a 89 m²: −5%», «90 m² o más: −8%». */
export function volumeTierRows(): { desde: number; hasta: number | null; descuento: number; etiqueta: string }[] {
  const ascending = [...VOLUME_TIERS].sort((a, b) => a.from - b.from);
  // Cada tramo llega hasta un m² antes de que empiece el siguiente; el último no tiene tope.
  const starts = [{ from: TARIFA_BASE_DESDE, discount: 0 }, ...ascending];
  const rows = starts.map((t, i) => {
    const next = starts[i + 1];
    return { desde: t.from, hasta: next ? next.from - 1 : null, descuento: t.discount };
  });
  return rows.map((r) => ({
    ...r,
    etiqueta: `${r.hasta === null ? `${r.desde} m² o más` : `${r.desde} a ${r.hasta} m²`}: ${r.descuento === 0 ? "tarifa base" : `-${r.descuento}%`}`,
  }));
}

export type IncluyeItem = {
  id: string;
  titulo: string;
  texto: string;
  /** Detalle que cambia según la opción (Techo Liviano / Losa). */
  porOpcion?: Record<TradicionalId, string>;
};

/** «¿Qué justifica este valor en Punta del Diablo?»: lo que incluye el precio por m², tal como lo pasó SCH. */
export const PRECIO_INCLUYE: readonly IncluyeItem[] = [
  {
    id: "cimentacion",
    titulo: "Cimentación incluida",
    texto: "Platea de hormigón armado ejecutada in situ.",
  },
  {
    id: "estructura",
    titulo: "Estructura y cubierta adaptada al clima marino",
    texto: "Mampostería tradicional con materiales aptos para salinidad y viento costero.",
    porOpcion: {
      esencial: "estructura de madera 100% curada, aislación térmica/hidrófuga reforzada y cubierta de chapa con zinguería completa.",
      clasica:
        "estructura portante reforzada, losa llena de hormigón armado ejecutada en obra, aislación térmica e impermeabilización de azotea (planta baja).",
    },
  },
  {
    id: "instalaciones",
    titulo: "Instalaciones completas",
    texto: "Instalación eléctrica interior completa (tablero y puestas) con firma de UTE e instalación sanitaria completa hasta la primera cámara sanitaria.",
  },
  {
    id: "terminaciones",
    titulo: "Terminaciones clave incluidas",
    texto: "Aberturas completas y mesadas principales de cocina y baño.",
  },
  {
    id: "operativa",
    titulo: "Operativa local resuelta",
    texto: "Materiales y ejecución integrados en Punta del Diablo, sin sorpresas por fletes externos ni alquiler de maquinaria pesada.",
  },
];

/** El texto de un punto. Con una opción: el detalle de esa opción («Techo Liviano: …»); sin opción, el de las dos. */
export function incluyeTexto(item: IncluyeItem, option?: TradicionalId): string {
  if (!item.porOpcion) return item.texto;
  if (option) return `${item.texto} ${TRADICIONAL_OPCION[option]}: ${item.porOpcion[option]}`;
  return `${item.texto} En opción ${TRADICIONAL_OPCION.esencial}: ${item.porOpcion.esencial} En opción ${TRADICIONAL_OPCION.clasica}: ${item.porOpcion.clasica}`;
}

/** Lo que se muestra en cada opción: título + texto, ya armado. */
export const incluyeFor = (option?: TradicionalId) => PRECIO_INCLUYE.map((item) => ({ id: item.id, titulo: item.titulo, texto: incluyeTexto(item, option) }));

/** Lo que el presupuesto de construcción tradicional NO incluye (lista corta, para las tarjetas y las páginas). */
export const TRADICIONAL_EXCLUIDO = [
  "Grifería.",
  "Artefactos sanitarios.",
  "Muebles de cocina y placares.",
  "Calefón.",
  "Pintura.",
  "Obras exteriores: parrilleros, decks, pérgolas y balcones.",
] as const;

export const TRADICIONAL_TEXTOS = {
  /** Título del bloque con los puntos que justifican el valor. */
  incluyeTitulo: "¿Qué justifica este valor en Punta del Diablo?",
  /** Botón del acordeón. */
  verIncluye: "Ver qué incluye este precio",
  ocultarIncluye: "Ocultar lo que incluye",
  /** Mensaje que aparece debajo del total al llegar al 5% o al 8%. */
  bonificacion: (pct: number) => `¡Bonificación por superficie aplicada! (-${pct}% por optimización de escala de obra)`,
  precioEfectivo: "Precio por m² efectivo",
  tarifaBase: "tarifa base",
  ahorro: "Ahorro por escala",
  /** Pista cuando todavía no se llegó al descuento. */
  pista: (next: VolumeTier) => `Desde ${next.from} m² el precio por m² baja ${next.discount}% por optimización de escala de obra.`,
  tramosTitulo: "Descuento por superficie",
  tramosIntro:
    "A más metros, menos por m²: se optimizan los costos fijos de platea, cocina y baño y se gana escala de obra. El descuento se aplica solo y se ve en el precio.",
  exclusiones:
    "El presupuesto cubre hasta la primera cámara sanitaria; no incluye grifería, artefactos sanitarios, muebles de cocina/placares, calefón ni obras exteriores (parrilleros, decks, pérgolas o balcones). Valores calculados para terreno firme y nivelado; la opción losa corresponde a planta baja no transitable.",
  /** Para las tarjetas angostas del diseñador. */
  exclusionesTitulo: "Qué no incluye",
} as const;
