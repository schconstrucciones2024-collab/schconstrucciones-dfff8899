/**
 * Datos de cada obra, tomados de las fichas "Datos del proyecto" y de las historias que SCH publicó en el sitio.
 * No se agrega ninguna cifra que no figure en esas fichas. Si una obra no tiene un dato (por ejemplo la
 * ubicación), simplemente no se muestra.
 */
export type ProjectFacts = {
  /** Frase corta bajo el título. */
  subtitle: string;
  /** Descripción de la intervención (también va al SEO). */
  description: string;
  location?: string;
  /** Superficie principal, tal como figura en la ficha. */
  area?: string;
  /** Filas de la ficha: superficies y elementos. */
  data: [label: string, value: string][];
  /** Ambientes o trabajos realizados. */
  spaces: string[];
  /** Aclaración documentada (estado de la obra, alcance de SCH). */
  note?: string;
};

const PD = "Punta del Diablo, Rocha";

export const PROJECT_FACTS: Record<string, ProjectFacts> = {
  barbacoa: {
    subtitle: "Un espacio para compartir",
    description: "Barbacoa de 28 m² en Punta del Diablo con cocina y living integrados, dormitorio, baño completo y parrillero exterior. Un deck de madera techado de 21 m² conecta el interior con el exterior todo el año.",
    location: PD,
    area: "28 m² (barbacoa)",
    data: [["Superficie", "28 m² (barbacoa)"], ["Deck techado frontal", "21 m²"], ["Parrillero", "Independiente"]],
    spaces: ["Cocina y living integrados", "Dormitorio privado", "Baño completo", "Parrillero exterior", "Deck de madera techado"],
  },
  laslu: {
    subtitle: "Una vivienda de dos plantas con identidad propia",
    description: "Vivienda de 96 m² en dos plantas en Punta del Diablo. Planta baja con cocina integrada, living conectado al exterior, baño completo y parrillero techado; planta alta con dos dormitorios y balcón compartido.",
    location: PD,
    area: "96 m² (vivienda)",
    data: [["Superficie", "96 m² (vivienda)"], ["Deck frontal", "13,2 m²"], ["Parrillero", "Independiente"]],
    spaces: ["Planta baja: cocina funcional integrada", "Planta baja: living luminoso conectado al exterior", "Planta baja: baño completo", "Parrillero techado", "Planta alta: 2 dormitorios amplios", "Planta alta: balcón compartido"],
  },
  "ampliacion-en-proceso": {
    subtitle: "Crecer hacia arriba desde lo existente",
    description: "Ampliación de un monoambiente de 18 m² con nueva planta alta, dormitorio de 10,89 m², baño de 3,65 m², balcón en altura de 7,6 m² y deck frontal de 7 m². La obra se documentó en su última etapa.",
    location: PD,
    area: "18 m² iniciales + ampliación",
    data: [["Monoambiente inicial", "18 m²"], ["Nuevo dormitorio", "10,89 m²"], ["Nuevo baño", "3,65 m²"], ["Balcón en planta alta", "7,6 m²"], ["Deck frontal", "7 m²"]],
    spaces: ["Nueva planta alta con dormitorio", "Baño incorporado en la ampliación", "Balcón en altura", "Integración total de los espacios", "Deck exterior que amplía el espacio de vida"],
    note: "Última etapa en proceso: cerámicas, grifería, pintura, terminaciones eléctricas, puerta corrediza y detalles finales.",
  },
  "mi-sueno": {
    subtitle: "Un hogar, una historia",
    description: "Vivienda de 64 m² en Punta del Diablo con cocina completa y living comedor integrado, dos dormitorios, baño completo, parrillero y un deck frontal techado de 20 m², más grande que el frente de la casa.",
    location: PD,
    area: "64 m² (vivienda)",
    data: [["Superficie", "64 m² (vivienda)"], ["Deck frontal", "20 m²"], ["Parrillero", "Independiente"]],
    spaces: ["Cocina completa y living comedor integrado", "2 dormitorios", "Baño completo", "Deck techado, más grande que el frente", "Parrillero"],
  },
  "lo-de-cata": {
    subtitle: "La casa celeste junto a la piscina",
    description: "Vivienda de 60 m² en Punta del Diablo con deck techado trasero de 45 m², deck frontal techado de 15,5 m², parrillero independiente, baño exterior y piscina climatizada exterior.",
    location: PD,
    area: "60 m² (vivienda)",
    data: [["Superficie", "60 m² (vivienda)"], ["Deck techado trasero", "45 m²"], ["Deck techado frontal", "15,5 m²"], ["Parrillero", "Independiente"], ["Exterior", "Baño exterior y piscina climatizada"]],
    spaces: ["Cocina integrada y sala de estar", "2 dormitorios", "Baño interior completo y baño exterior", "Parrillero clásico", "Deck trasero amplio", "Deck delantero tipo recibidor"],
  },
  "proyecto-2021": {
    subtitle: "Habitar entre los árboles",
    description: "Cabaña de 45 m² en Punta del Diablo, rodeada de pinos, con cocina y living integrados, dos dormitorios, baño completo, parrillero exterior y un deck techado de 19,8 m².",
    location: PD,
    area: "45 m²",
    data: [["Superficie", "45 m²"], ["Deck techado", "19,8 m²"], ["Parrillero", "Independiente"]],
    spaces: ["Cocina y living comedor integrados", "2 dormitorios", "Baño completo", "Parrillero exterior", "Deck techado"],
  },
  ampliacion: {
    subtitle: "Más posibilidades para una vivienda",
    description: "Ampliación de 28,05 m² en Punta del Diablo, realizada entre 2020 y 2021: cocina y living comedor integrados, un dormitorio completo, baño nuevo, deck de madera, parrillero exterior e instalaciones sanitaria y eléctrica completas.",
    location: PD,
    area: "28,05 m² (ampliación total)",
    data: [["Ampliación total", "28,05 m²"], ["Deck frontal actual", "3 m²"], ["Parrillero", "Independiente"]],
    spaces: ["Cocina y living comedor integrados", "1 dormitorio completo", "Baño 100 % nuevo", "Deck de madera", "Parrillero exterior nuevo", "Instalación sanitaria y eléctrica completas", "Pintura interior en su totalidad"],
    note: "Pintura exterior: SCH realizó una pintura inicial; la terminación actual no fue hecha por SCH.",
  },
  "transformacion-contenedor": {
    subtitle: "Una nueva vida para un espacio",
    description: "Transformación de un contenedor en Punta del Diablo: techado a dos aguas de 66 m², revestimiento exterior en siding, aislamiento integral, sanitaria exterior, decks conectados y un parrillero con isla central.",
    location: PD,
    area: "66 m² (techo a dos aguas)",
    data: [["Techo a dos aguas", "66 m²"], ["Revestimiento siding", "30 m²"], ["Deck techado frontal", "27 m²"], ["Pérgola (isla)", "16,5 m²"], ["Conexión deck-isla", "15 m²"], ["Parrillero", "Independiente"]],
    spaces: ["Techado a dos aguas: sombra y protección", "Aislamiento integral", "Revestimiento exterior en siding", "Sanitaria exterior", "Decks conectados", "Parrillero con isla central", "Conexión total interior-exterior"],
  },
  "la-diosa": {
    subtitle: "La Clave del Diablo",
    description: "Viviendas de 63 m² por unidad en Punta del Diablo (2019-2020), con cocina integrada, living comedor, dos dormitorios, baño completo, deck frontal techado de 18 m² y dos parrilleros independientes.",
    location: PD,
    area: "63 m² (unidad)",
    data: [["Superficie", "63 m² (unidad)"], ["Deck frontal", "18 m²"], ["Parrilleros", "2, independientes"]],
    spaces: ["Cocina funcional integrada", "Living y comedor amplio", "2 dormitorios", "Baño completo", "Deck techado frontal", "Parrillero"],
  },
  "pequenas-diablitas": {
    subtitle: "El proyecto fundacional de 2015",
    description: "Proyecto fundacional de 2015 en Punta del Diablo: una estructura de 40 m² dividida en dos monoambientes iguales de 20 m² con cocina y living integrados, baño privado, espacio de descanso, deck frontal y dos parrilleros independientes.",
    location: PD,
    area: "40 m² (estructura total)",
    data: [["Estructura total", "40 m²"], ["Cada unidad", "20 m²"], ["Deck frontal", "14,4 m² (dividido)"], ["Parrilleros", "2, independientes"]],
    spaces: ["2 monoambientes completos", "Cocina y living integrados", "Baño privado", "Espacio de descanso", "Independencia total en cada unidad"],
  },
  "le-sirenuse": {
    subtitle: "Parte de nuestra trayectoria",
    description: "Edificio exclusivo de 27 apartamentos de 50 a 100 m² a metros del mar, en la parada 16 de Playa Mansa, Punta del Este. Uno de los últimos grandes proyectos masivos que dirigió la familia Sánchez, antes de que existiera SCH Construcciones.",
    location: "Playa Mansa, parada 16, Punta del Este",
    area: "27 apartamentos de 50 a 100 m²",
    data: [["Programa", "27 apartamentos de 50 a 100 m²"], ["Ubicación", "Parada 16, Playa Mansa"]],
    spaces: ["Terrazas y parrilleros propios", "Piscina exterior climatizada", "Solárium con jardín", "Sala de juegos", "Gimnasio"],
    note: "Obra anterior a SCH Construcciones, dirigida por la familia Sánchez.",
  },
  "complejo-alvear": {
    subtitle: "Obras que forman nuestra historia",
    description: "Complejo de 5 cabañas rústicas con piscina en Piriápolis, realizado justo antes de Le Sirenuse. La familia Sánchez dirigió la obra y participó en cada etapa.",
    location: "Piriápolis, Uruguay",
    area: "5 cabañas rústicas",
    data: [["Programa", "5 cabañas rústicas con piscina"], ["Ubicación", "Piriápolis"]],
    spaces: ["Cabañas rústicas", "Piscina", "Espacios para desconectar y compartir"],
    note: "Obra anterior a SCH Construcciones. Hoy sigue recibiendo visitantes en Piriápolis.",
  },
};
