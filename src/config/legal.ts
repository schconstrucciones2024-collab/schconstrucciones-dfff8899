/**
 * Derechos de autor, aviso legal y política de privacidad: una sola fuente para el pie, las dos páginas legales,
 * los metadatos (`copyright`) y los datos estructurados de cada obra. Sin imports: la raíz del sitio la usa en el `<head>`.
 *
 * Los textos describen lo que el sitio hace de verdad (por ejemplo, que el formulario no envía datos a ningún servidor:
 * arma el mensaje y abre WhatsApp). Si el sitio cambia (se activa Google Analytics, se alojan las tipografías en la propia
 * web, se suma un formulario con servidor), hay que actualizar este archivo y `LEGAL_UPDATED`.
 */
export const COPYRIGHT_HOLDER = "SCH Construcciones";
/** Fecha de la última revisión de los textos legales. */
export const LEGAL_UPDATED = "14 de noviembre de 2026";

export const copyrightYear = (): number => new Date().getFullYear();
export const copyrightNotice = (year: number = copyrightYear()): string => `© ${year} ${COPYRIGHT_HOLDER}. Todos los derechos reservados.`;

export type LegalContact = { address: string; email: string; whatsappLabel: string };
export type LegalBlock = { title: string; paragraphs?: string[]; items?: string[] };

export const LEGAL_PAGES = {
  privacidad: {
    path: "/privacidad",
    eyebrow: "Privacidad",
    title: "Política de privacidad",
    metaTitle: "Política de privacidad | SCH Construcciones",
    description: "Qué datos recibe SCH Construcciones a través de este sitio, para qué los usa y cómo ejercer tus derechos.",
    intro: "Te contamos de forma simple qué datos recibimos cuando usás este sitio, para qué los usamos y qué podés pedirnos.",
  },
  avisoLegal: {
    path: "/aviso-legal",
    eyebrow: "Aviso legal",
    title: "Aviso legal y derechos de autor",
    metaTitle: "Aviso legal y derechos de autor | SCH Construcciones",
    description: "Titular del sitio, derechos de autor y condiciones de uso de los contenidos de SCH Construcciones.",
    intro: "Todo lo que ves en este sitio fue creado para SCH Construcciones. Acá están las reglas para usarlo y cómo pedirnos autorización.",
  },
} as const;

export function privacySections(c: LegalContact): LegalBlock[] {
  return [
    {
      title: "Quién es responsable",
      paragraphs: [`${COPYRIGHT_HOLDER} es responsable del tratamiento de los datos que nos dejás a través de este sitio. Domicilio: ${c.address}. Contacto: ${c.email} · WhatsApp ${c.whatsappLabel}.`],
    },
    {
      title: "Qué datos recibimos y cómo",
      items: [
        "Formulario de contacto: nombre, teléfono, tipo de proyecto, ubicación de la obra y, si querés, una descripción. El formulario no envía esos datos a ningún servidor: arma un mensaje y abre WhatsApp. Recién lo recibimos cuando lo enviás desde WhatsApp.",
        "WhatsApp y correo: lo que nos escribas y tu número o tu dirección de correo. Al escribirnos por WhatsApp, esa conversación también se rige por las condiciones de WhatsApp.",
        "Diseñador 3D y cotizador: los cálculos se hacen en tu dispositivo. El diseñador guarda tu plano en el almacenamiento local de tu navegador para que no lo pierdas, y recuerda si cerraste su introducción. Eso no se sube a nuestros servidores y lo podés borrar desde los ajustes de tu navegador.",
        "Enlaces para compartir un diseño: llevan el diseño dentro del propio enlace. Quien tenga el enlace puede verlo; compartilo solo con quien quieras.",
        "Asistente de escaleras: si lo usás, el diseño (medidas, muros, muebles y escaleras) y el pedido que escribas se envían a un servicio de inteligencia artificial para generar la sugerencia. No enviamos tus datos de contacto; evitá escribir datos personales en el pedido.",
        "Estadísticas: podemos usar Google Analytics, con la dirección IP anonimizada, para medir de forma agregada qué secciones se visitan y cuántos toques recibe cada botón de contacto. No se envían nombres, teléfonos ni el contenido de tus mensajes. Cuando esté activo, Google puede usar cookies para esa medición.",
        "Tipografías y alojamiento: las tipografías se cargan desde Google Fonts y el sitio está alojado en la plataforma Lovable. Como en cualquier sitio, esos servicios pueden registrar datos técnicos (dirección IP, navegador, fecha y hora) para que funcione y por seguridad.",
      ],
    },
    {
      title: "Para qué los usamos",
      paragraphs: ["Para responder tu consulta, armar tu presupuesto y coordinar la obra si decidís avanzar. No vendemos tus datos ni los usamos para publicidad de terceros."],
    },
    {
      title: "Cuánto tiempo los conservamos",
      paragraphs: ["El tiempo necesario para atender tu consulta y, si hay obra, mientras dure la relación con SCH y lo que pidan las obligaciones legales. Si querés que borremos tus datos, pedinoslo."],
    },
    {
      title: "Cookies y almacenamiento en tu navegador",
      paragraphs: ["Este sitio no usa cookies de publicidad ni de seguimiento propias. Usa el almacenamiento local de tu navegador solo para las preferencias del diseñador que se explican arriba."],
    },
    {
      title: "Tus derechos",
      paragraphs: [
        `Según la Ley N.º 18.331 de Protección de Datos Personales de Uruguay, podés pedirnos acceso a tus datos, y que los rectifiquemos, actualicemos o eliminemos. Escribinos a ${c.email} y te respondemos.`,
        "También podés presentar un reclamo ante la Unidad Reguladora y de Control de Datos Personales (URCDP).",
      ],
    },
    { title: "Cambios", paragraphs: [`Si cambiamos esta política, publicamos la nueva versión en esta página. Última actualización: ${LEGAL_UPDATED}.`] },
  ];
}

export function legalSections(c: LegalContact, year: number = copyrightYear()): LegalBlock[] {
  return [
    {
      title: "Titular del sitio",
      paragraphs: [`Este sitio es de ${COPYRIGHT_HOLDER}, con domicilio en ${c.address}. Contacto: ${c.email} · WhatsApp ${c.whatsappLabel}.`],
    },
    {
      title: "Derechos de autor",
      paragraphs: [
        copyrightNotice(year),
        "Los textos, las fotografías de las obras, los planos, las ilustraciones, los logotipos y la marca «SCH Construcciones», el diseño gráfico del sitio, su estructura y su código, las texturas y los modelos 3D, el diseñador de viviendas y el cotizador pertenecen a SCH Construcciones o se usan con autorización de sus titulares. Están protegidos por la legislación uruguaya de derechos de autor (Ley N.º 9.739 y sus modificaciones) y por los tratados internacionales.",
      ],
    },
    {
      title: "Qué podés hacer",
      items: [
        "Navegar el sitio y usar el cotizador y el diseñador 3D para tu proyecto.",
        "Compartir los enlaces del sitio y de cada obra, por ejemplo con los botones de compartir.",
        "Citar fragmentos breves con mención de SCH Construcciones y un enlace a esta web.",
      ],
    },
    {
      title: "Qué no se puede hacer sin autorización escrita",
      items: [
        "Copiar, reproducir, descargar de forma masiva, distribuir, comunicar públicamente o modificar los textos, las fotos, los planos, los logotipos o el diseño del sitio.",
        "Usar las fotos de nuestras obras, nuestro nombre o nuestro logo en otros sitios, redes, avisos, folletos o presupuestos, ni presentar esas obras como propias.",
        "Copiar o clonar el sitio, su código, el diseñador 3D o el cotizador, ni hacer ingeniería inversa.",
        "Extraer contenido con programas automáticos (scraping, rastreo masivo o minería de datos), salvo los buscadores y asistentes de IA que este sitio permite en su archivo robots.txt para encontrarlo y citarlo.",
        "Usar el contenido para entrenar, ajustar o alimentar sistemas de inteligencia artificial, salvo lo que este sitio permite expresamente en su archivo robots.txt.",
      ],
    },
    {
      title: "Cómo pedir autorización",
      paragraphs: [`Si querés usar algún contenido, escribinos a ${c.email} o por WhatsApp al ${c.whatsappLabel} y contanos qué querés usar y para qué.`],
    },
    {
      title: "Uso no autorizado",
      paragraphs: ["Ante un uso no autorizado, SCH Construcciones puede pedir que se retire el contenido y reclamar por las vías legales que correspondan."],
    },
    {
      title: "Información orientativa",
      paragraphs: ["Los precios por m², los plazos, las superficies y las simulaciones del cotizador y del diseñador 3D son orientativos. El presupuesto definitivo se confirma por escrito con SCH Construcciones según el proyecto, el terreno y las condiciones de la obra."],
    },
    {
      title: "Enlaces a otros sitios",
      paragraphs: ["Este sitio enlaza a redes sociales y a WhatsApp, que son de terceros y tienen sus propias condiciones y políticas de privacidad."],
    },
    { title: "Cambios", paragraphs: [`Podemos actualizar este aviso. Última actualización: ${LEGAL_UPDATED}.`] },
  ];
}
