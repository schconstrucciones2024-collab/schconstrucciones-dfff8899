/**
 * Apartado "Sistemas constructivos": definición de las dos paredes (Wood Frame y construcción tradicional).
 * Acá viven los textos, las opciones (tags) y los materiales. La geometría está en src/lib/wallModel.ts.
 *
 * Criterio de contenido: las fichas explican qué es cada capa y para qué sirve, en términos generales.
 * No llevan espesores, resistencias, prestaciones térmicas ni normas: eso lo define SCH en cada proyecto.
 * Las proporciones del modelo 3D son ilustrativas.
 */

export type SystemId = "woodframe" | "tradicional";

/** Materiales con mapas PBR propios (public/textures/<material>/). `acero` no tiene textura: es metal liso. */
export type WallMaterialKind =
  | "drywall" | "chaponPino" | "chaponEucalipto" | "machimbre"
  | "maderaEstructural" | "lanaVidrio" | "osb" | "membrana"
  | "sidingModerno" | "sidingAllwood" | "chapa"
  | "ladrilloHueco" | "ladrilloComun" | "revoque" | "revoqueFino" | "hormigon"
  | "acero";

export const TEXTURED_WALL_MATERIALS: WallMaterialKind[] = [
  "drywall", "chaponPino", "chaponEucalipto", "machimbre", "maderaEstructural", "lanaVidrio", "osb", "membrana",
  "sidingModerno", "sidingAllwood", "chapa", "ladrilloHueco", "ladrilloComun", "revoque", "revoqueFino", "hormigon",
];

/** Color base (sRGB) para la vista previa y como material provisorio mientras se descargan las texturas. */
export const WALL_MATERIAL_BASE: Record<WallMaterialKind, [number, number, number]> = {
  drywall: [236, 233, 226], chaponPino: [208, 168, 106], chaponEucalipto: [150, 100, 70], machimbre: [214, 170, 112],
  maderaEstructural: [206, 168, 108], lanaVidrio: [240, 200, 84], osb: [191, 149, 84], membrana: [210, 224, 240],
  sidingModerno: [206, 209, 212], sidingAllwood: [196, 146, 84], chapa: [86, 90, 94],
  ladrilloHueco: [200, 112, 78], ladrilloComun: [176, 80, 52], revoque: [178, 170, 154], revoqueFino: [232, 227, 214], hormigon: [150, 150, 146],
  acero: [88, 92, 98],
};

export function wallTextureUrl(kind: WallMaterialKind, map: "albedo" | "normal" | "orm", low = false): string {
  return `/textures/${kind}/${map}${low ? "-512" : ""}.webp`;
}

export type OptionValue = { value: string; label: string; hint?: string };
export type OptionDef = {
  key: string;
  /** Título del grupo de tags. */
  label: string;
  /** Capa que cambia al elegir (para destacarla). */
  layer: string;
  values: OptionValue[];
  /** Valor inicial. */
  initial: string;
};

export type LayerInfo = {
  id: string;
  /** Orden de lectura en la lista (de adentro hacia afuera). */
  name: string;
  short: string;
  description: string;
  role: string;
  material: string;
  texture: string;
  /** Si es opcional, la frase que lo aclara. */
  optional?: string;
};

export type SystemDef = {
  id: SystemId;
  label: string;
  tagline: string;
  options: OptionDef[];
  /** Capas en orden de adentro hacia afuera. Los textos pueden depender de las opciones elegidas. */
  layers: (options: Record<string, string>) => LayerInfo[];
  /** Opción que se usa para el modo "Comparar" y los valores alternativos. */
  compareKey: string;
};

const INTERIOR_LABELS: Record<string, { name: string; material: string; texture: string; description: string }> = {
  yeso: {
    name: "Placa de yeso (Durlock)",
    material: "Placa de yeso con terminación para pintar.",
    texture: "Superficie lisa, blanca y mate, con las juntas entre placas a la vista en el modelo.",
    description: "Placa de yeso que cierra la pared por el lado de adentro. Es la terminación más neutra: se masilla, se pinta y queda lista para cualquier decoración.",
  },
  chaponPino: {
    name: "Chapones de pino cepillado",
    material: "Tableros de madera de pino cepillada de primera calidad.",
    texture: "Veta suave de pino, tono claro y cálido, con juntas entre tableros.",
    description: "Tableros de pino cepillado que dejan la madera a la vista en el interior. Aportan calidez y una terminación natural.",
  },
  chaponEucalipto: {
    name: "Chapones de eucalipto cepillado",
    material: "Tableros de madera de eucalipto cepillada de primera calidad.",
    texture: "Veta marcada de eucalipto, tono más oscuro y rojizo que el pino.",
    description: "Tableros de eucalipto cepillado para un interior de madera de carácter más rústico y de tono más profundo.",
  },
  machimbre: {
    name: "Madera machimbrada de pino",
    material: "Tablas de pino machimbradas (con unión de ranura y lengüeta) de primera calidad.",
    texture: "Tablas verticales de pino con la junta machimbrada marcada.",
    description: "Tablas de pino que encastran unas con otras y dejan un interior de madera continuo y prolijo.",
  },
};

const EXTERIOR_LABELS: Record<string, { name: string; material: string; texture: string; description: string }> = {
  siding: {
    name: "Siding de fibrocemento gris claro",
    material: "Placas de fibrocemento tipo siding, gris claro.",
    texture: "Tablas superpuestas con el relieve del solape y terminación mate.",
    description: "Revestimiento exterior de tablas de fibrocemento superpuestas, de gris claro. Es la terminación predeterminada de SCH: pareja, resistente y de mantenimiento sencillo.",
  },
  tablas: {
    name: "Revestimiento exterior de tablas de madera",
    material: "Tablas de madera.",
    texture: "Tablas superpuestas con veta y nudos a la vista.",
    description: "Tablas de madera que le dan a la fachada un aspecto cálido y natural. Piden un mantenimiento periódico de protección.",
  },
  chapa: {
    name: "Chapa acanalada",
    material: "Chapa metálica acanalada.",
    texture: "Ondas verticales de metal con brillo satinado.",
    description: "Chapa acanalada colocada en vertical. Es una terminación liviana, de estética moderna e industrial.",
  },
};

export const WOOD_FRAME: SystemDef = {
  id: "woodframe",
  label: "Wood Frame",
  tagline: "Estructura liviana de madera, armada por capas.",
  compareKey: "exterior",
  options: [
    {
      key: "interior", label: "Revestimiento interior", layer: "interior", initial: "yeso",
      values: [
        { value: "yeso", label: "Placa de yeso (Durlock)" },
        { value: "chaponPino", label: "Chapones de pino cepillado" },
        { value: "chaponEucalipto", label: "Chapones de eucalipto cepillado" },
        { value: "machimbre", label: "Machimbre de pino" },
      ],
    },
    {
      key: "battens", label: "Clavaderas", layer: "clavaderas", initial: "con",
      values: [
        { value: "con", label: "Con clavaderas" },
        { value: "sin", label: "Sin clavaderas" },
      ],
    },
    {
      key: "exterior", label: "Revestimiento exterior", layer: "exterior", initial: "siding",
      values: [
        { value: "siding", label: "Siding de fibrocemento gris claro", hint: "Predeterminado" },
        { value: "tablas", label: "Tablas de madera" },
        { value: "chapa", label: "Chapa acanalada" },
      ],
    },
  ],
  layers: (o) => {
    const inter = INTERIOR_LABELS[o["interior"] ?? "yeso"] ?? INTERIOR_LABELS["yeso"]!;
    const exter = EXTERIOR_LABELS[o["exterior"] ?? "siding"] ?? EXTERIOR_LABELS["siding"]!;
    const layers: LayerInfo[] = [
      {
        id: "interior", name: "Revestimiento interior", short: inter.name,
        description: inter.description,
        role: "Es la cara que se ve desde adentro de la casa y protege y cierra el bastidor.",
        material: inter.material, texture: inter.texture,
      },
      {
        id: "aislacion", name: "Lana de vidrio", short: "Aislación dentro del bastidor",
        description: "Colchoneta de lana de vidrio que rellena los huecos entre los montantes.",
        role: "Aporta aislación térmica y acústica a la pared.",
        material: "Lana de vidrio.", texture: "Fibras finas entrelazadas, de color amarillo y aspecto esponjoso.",
      },
      {
        id: "estructura", name: "Estructura de madera", short: "Montantes y soleras",
        description: "Bastidor de madera formado por montantes verticales y soleras (piezas horizontales arriba y abajo).",
        role: "Es el esqueleto que sostiene la pared y recibe las demás capas.",
        material: "Madera de pino tratada.", texture: "Veta longitudinal de pino, con nudos y variaciones de tono.",
      },
      {
        id: "osb", name: "Placa estructural OSB", short: "Cierre rígido del bastidor",
        description: "Placa hecha con virutas de madera orientadas y prensadas con resina, que se fija sobre el bastidor por el lado de afuera.",
        role: "Rigidiza el conjunto y da base firme para las capas exteriores.",
        material: "Virutas de madera orientadas, prensadas.", texture: "Virutas de distintos tonos, con borde y relieve visibles.",
      },
      {
        id: "membrana", name: "Aislante hidrófugo", short: "Membrana contra el agua y el viento",
        description: "Membrana que se coloca sobre la placa estructural, antes del revestimiento exterior.",
        role: "Protege la estructura del agua y del viento que pudiera filtrarse detrás del revestimiento.",
        material: "Membrana hidrófuga. El tipo se define en cada proyecto.", texture: "Lámina liviana de aspecto satinado, con pequeñas arrugas.",
      },
      {
        id: "clavaderas", name: "Clavaderas de madera", short: "Listones sobre la membrana",
        description: "Listones verticales de madera que se fijan sobre la membrana y separan el revestimiento de la pared.",
        role: "Dejan una cámara de aire detrás del revestimiento y le dan dónde fijarse.",
        material: "Madera de pino.", texture: "Veta longitudinal de pino.",
        optional: "Opcional: se puede construir con o sin clavaderas. Se define en cada proyecto.",
      },
      {
        id: "exterior", name: "Revestimiento exterior", short: exter.name,
        description: exter.description,
        role: "Es la cara que se ve desde afuera: protege la pared de la lluvia y el sol y define la estética de la fachada.",
        material: exter.material, texture: exter.texture,
      },
    ];
    return layers;
  },
};

export const TRADICIONAL: SystemDef = {
  id: "tradicional",
  label: "Construcción tradicional",
  tagline: "Mampostería, hormigón armado y revoques.",
  compareKey: "masonry",
  options: [
    {
      key: "masonry", label: "Mampostería", layer: "mamposteria", initial: "ticholo",
      values: [
        { value: "ticholo", label: "Ladrillo hueco (ticholo)" },
        { value: "comun", label: "Ladrillo común" },
      ],
    },
    {
      key: "revoqueExt", label: "Terminación exterior", layer: "revoqueExt", initial: "con",
      values: [
        { value: "con", label: "Con revoque exterior" },
        { value: "sin", label: "Sin revoque exterior" },
      ],
    },
    {
      key: "hormigon", label: "Hormigón armado", layer: "encadenadoH", initial: "translucido",
      values: [
        { value: "translucido", label: "Ver armaduras", hint: "Hormigón translúcido" },
        { value: "solido", label: "Hormigón sólido" },
      ],
    },
  ],
  layers: (o) => {
    const hueco = (o["masonry"] ?? "ticholo") === "ticholo";
    return [
      {
        id: "revoqueInt", name: "Revoque interior", short: "Terminación de adentro",
        description: "Capa de mortero fino que se aplica sobre la mampostería por el lado de adentro y se alisa a llana.",
        role: "Empareja la pared y deja la superficie lista para pintar.",
        material: "Mortero de cemento y arena fina.", texture: "Superficie lisa, mate, con leves marcas de llana.",
      },
      {
        id: "mortero", name: "Mortero de asiento", short: "Juntas entre ladrillos",
        description: "Mortero que se coloca entre las piezas, tanto en las juntas horizontales como en las verticales.",
        role: "Une los ladrillos entre sí y reparte las cargas de forma pareja.",
        material: "Mortero de cemento y arena.", texture: "Superficie granulosa de color gris claro.",
      },
      {
        id: "mamposteria", name: hueco ? "Mampostería: ladrillo hueco (ticholo)" : "Mampostería: ladrillo común", short: hueco ? "Ladrillo hueco (ticholo)" : "Ladrillo común",
        description: hueco
          ? "Pared levantada con ladrillos huecos (ticholo): piezas cerámicas con celdas interiores, colocadas trabadas hilada sobre hilada."
          : "Pared levantada con ladrillos comunes macizos, colocados trabados hilada sobre hilada.",
        role: "Cierra y da cuerpo a la pared. Los elementos de hormigón armado la rodean y la refuerzan.",
        material: hueco ? "Cerámica cocida, con huecos interiores." : "Arcilla cocida, maciza.",
        texture: hueco ? "Cara anaranjada con finas estrías de extrusión; los huecos se ven en los cortes." : "Cara rojiza de arcilla cocida, con variaciones de tono entre piezas.",
      },
      {
        id: "encadenadoH", name: "Encadenado horizontal", short: "Viga de hormigón armado arriba",
        description: "Viga de hormigón armado que recorre la parte superior de la pared. Se muestra con su armadura de hierros longitudinales y estribos.",
        role: "Ata la pared en todo su largo y reparte lo que se apoya arriba.",
        material: "Hormigón armado.", texture: "Hormigón gris con poros; hierros de acero lisos.",
      },
      {
        id: "encadenadoV", name: "Encadenado vertical", short: "Columnas de hormigón armado",
        description: "Columnas de hormigón armado en los extremos de la pared, con hierros verticales y estribos.",
        role: "Atan la pared de abajo hacia arriba y la vinculan con el resto de la estructura.",
        material: "Hormigón armado.", texture: "Hormigón gris con poros; hierros de acero lisos.",
      },
      {
        id: "dintel", name: "Dintel", short: "Refuerzo sobre la abertura",
        description: "Pieza de hormigón armado que cubre la abertura y apoya a ambos lados.",
        role: "Sostiene la mampostería que queda sobre la ventana.",
        material: "Hormigón armado.", texture: "Hormigón gris con poros; hierros de acero lisos.",
      },
      {
        id: "revoqueExt", name: "Revoque exterior", short: "Terminación de afuera",
        description: "Revoque que cubre la mampostería y los elementos de hormigón por el lado de afuera.",
        role: "Protege la pared de la lluvia y da la terminación de la fachada.",
        material: "Mortero de cemento y arena.", texture: "Superficie rugosa de grano fino, color arena grisácea.",
        optional: "Se puede ver la pared con y sin terminación exterior para entender cómo está armada.",
      },
    ];
  },
};

export const SYSTEMS: Record<SystemId, SystemDef> = { woodframe: WOOD_FRAME, tradicional: TRADICIONAL };

export const SECTION_COPY = {
  eyebrow: "Sistemas constructivos SCH",
  title: "Dos sistemas constructivos. Una misma exigencia de calidad.",
  subtitle:
    "En SCH Construcciones trabajamos con sistemas constructivos Wood Frame y construcción tradicional. Analizamos cada proyecto para desarrollar soluciones adaptadas al terreno, las necesidades y las expectativas de cada cliente.",
  quote: "No se trata solamente de cómo construimos. Se trata de cómo pensamos cada detalle para construir mejor.",
  disclaimer:
    "Modelo ilustrativo: las proporciones y los espesores del 3D no son especificaciones técnicas. Los materiales, las capas y los detalles de cada obra se definen en el proyecto.",
};

/** Valores iniciales de las opciones de un sistema. */
export function defaultOptions(system: SystemId): Record<string, string> {
  return Object.fromEntries(SYSTEMS[system].options.map((o) => [o.key, o.initial]));
}
