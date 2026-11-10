/**
 * Servicios de SCH Construcciones: once servicios en tres grupos, cada uno con el problema que resuelve,
 * el valor que aporta y un mensaje de WhatsApp propio. Los textos describen el alcance real del servicio;
 * no hay plazos, cifras ni garantías inventadas.
 */
export type ServiceItem = {
  id: string;
  title: string;
  /** Qué problema del cliente resuelve. */
  problem: string;
  /** Qué valor aporta SCH. */
  value: string;
  /** Mensaje inicial de WhatsApp. */
  message: string;
  /** Página con el detalle del servicio, cuando existe. */
  to?: "/woodframe" | "/construccion-tradicional";
};

export type ServiceGroup = {
  id: string;
  /** Pregunta que se hace el cliente. */
  question: string;
  title: string;
  /** Botón principal del grupo. */
  cta: string;
  message: string;
  services: ServiceItem[];
};

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    id: "obra-nueva",
    question: "¿Tenés un terreno y querés construir?",
    title: "Obra nueva",
    cta: "Quiero construir en mi terreno",
    message: "Hola SCH, quiero consultar por la construcción de una vivienda.",
    services: [
      {
        id: "construccion-de-viviendas",
        title: "Construcción de viviendas",
        problem: "Pasar de un terreno vacío a una casa lista para vivir sin coordinar cada rubro por tu cuenta.",
        value: "Planificamos, ejecutamos y entregamos la vivienda completa con un solo equipo, por etapas acordadas.",
        message: "Hola SCH, quiero consultar por la construcción de una vivienda.",
      },
      {
        id: "wood-frame",
        title: "Wood Frame",
        problem: "Querer una estructura de madera sin saber cómo se arma una pared por dentro.",
        value: "Paredes armadas por capas (estructura, placa OSB, membrana hidrófuga, aislación y revestimiento) que podés explorar en Sistemas constructivos.",
        message: "Hola SCH, quisiera recibir información sobre Wood Frame.",
        to: "/woodframe",
      },
      {
        id: "construccion-tradicional",
        title: "Construcción tradicional",
        problem: "Preferir una casa de mampostería y hormigón con terminaciones clásicas.",
        value: "Muros de ladrillo, encadenados de hormigón armado y revoques ejecutados por el equipo de SCH.",
        message: "Hola SCH, quisiera recibir información sobre construcción tradicional.",
        to: "/construccion-tradicional",
      },
      {
        id: "obra-nueva",
        title: "Obra nueva",
        problem: "No saber cuánto, cuándo ni cómo se paga una obra que empieza desde cero.",
        value: "Materiales y pagos organizados según las etapas de ejecución acordadas: se paga lo ejecutado.",
        message: "Hola SCH, tengo un terreno y quiero hacer una obra nueva.",
      },
    ],
  },
  {
    id: "ampliaciones",
    question: "¿Querés ampliar tu vivienda?",
    title: "Ampliaciones y reformas",
    cta: "Quiero ampliar mi vivienda",
    message: "Hola SCH, estoy interesado en una ampliación.",
    services: [
      {
        id: "ampliaciones",
        title: "Ampliaciones",
        problem: "La casa te quedó chica: falta un dormitorio, un baño, otra planta o un deck.",
        value: "Sumamos espacio integrándolo con lo que ya existe, como la ampliación con planta alta, dormitorio, baño y balcón que figura en Proyectos.",
        message: "Hola SCH, estoy interesado en una ampliación.",
      },
      {
        id: "remodelaciones",
        title: "Remodelaciones",
        problem: "Un ambiente que ya no funciona como necesitás: la cocina, el baño o el living.",
        value: "Renovamos ambientes puntuales con obra prolija y terminaciones a tu gusto.",
        message: "Hola SCH, necesito una remodelación.",
      },
      {
        id: "reformas-integrales",
        title: "Reformas integrales",
        problem: "Una propiedad completa que necesita volver a ponerse en valor.",
        value: "Intervenimos estructura, instalaciones y terminaciones, como en la transformación de contenedor que figura en Proyectos.",
        message: "Hola SCH, quiero consultar por una reforma integral.",
      },
    ],
  },
  {
    id: "renovar",
    question: "¿Necesitás renovar tu propiedad?",
    title: "Terminaciones e instalaciones",
    cta: "Quiero renovar mi propiedad",
    message: "Hola SCH, necesito renovar mi propiedad.",
    services: [
      {
        id: "drywall-y-yeso",
        title: "Drywall y yeso",
        problem: "Dividir o terminar ambientes con superficies parejas y sin demoras innecesarias.",
        value: "Tabiques, cielorrasos y revestimientos de placa de yeso listos para pintar.",
        message: "Hola SCH, quiero consultar por trabajos de drywall y yeso.",
      },
      {
        id: "pintura",
        title: "Pintura",
        problem: "Paredes y aberturas que se ven gastadas o quedaron sin protección.",
        value: "Pintura interior y exterior que renueva y protege las superficies.",
        message: "Hola SCH, quiero consultar por trabajos de pintura.",
      },
      {
        id: "instalaciones-electricas",
        title: "Instalaciones eléctricas completas",
        problem: "Una instalación vieja, incompleta o que no acompaña lo que necesitás hoy.",
        value: "Instalación eléctrica completa, desde cero o dentro de una reforma.",
        message: "Hola SCH, quiero consultar por una instalación eléctrica completa.",
      },
      {
        id: "instalaciones-sanitarias",
        title: "Instalaciones sanitarias completas",
        problem: "Baños y cocinas sin agua y desagües resueltos de punta a punta.",
        value: "Instalación sanitaria completa, incluso exterior, ejecutada junto con la obra.",
        message: "Hola SCH, quiero consultar por una instalación sanitaria completa.",
      },
    ],
  },
];

export const ALL_SERVICES: ServiceItem[] = SERVICE_GROUPS.flatMap((group) => group.services);
