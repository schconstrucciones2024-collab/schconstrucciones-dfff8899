import type { LayoutProposal } from "./layoutProposals";
import { bigWin, doorAt, kitchenWin, lContour, pt, room, wall, win } from "./planKit";

/**
 * Distribuciones de woodframe. Los paneles de madera permiten luces generosas y plantas abiertas: el estar, la cocina y el
 * comedor forman un solo ambiente y los muros de planta alta no necesitan repetir los de planta baja.
 */
export const WOODFRAME_PLANS: LayoutProposal[] = [
  {
    id: "wf-dos-dormitorios",
    version: 2,
    system: "woodframe",
    floors: 1,
    footprint: "rectangular",
    name: "Dos dormitorios con baño central",
    width: 8,
    depth: 7,
    bedrooms: 2,
    bathrooms: 1,
    description:
      "56 m² · Sector privado en una sola franja y estar-cocina de 8 × 3,6 m abierto al frente.",
    notes: [
      "El baño separa los dos dormitorios: no se oyen entre sí y comparten una sola pared húmeda.",
      "Estar, comedor y cocina en un solo ambiente abierto, con acceso por el ventanal.",
    ],
    rooms: [
      room("Dormitorio 1", "bed", 0, 0, 3.2, 3.4, [2.4, 3.4]),
      room("Baño", "bath", 3.2, 0, 2, 3.4, [4.5, 3.4]),
      room("Dormitorio 2", "bed", 5.2, 0, 2.8, 3.4, [6, 3.4]),
    ],
    entrance: { x: 3.4, type: "ventanal" },
    openings: [bigWin(5.9, 7), bigWin(0, 5.2), kitchenWin(8, 5.2)],
    counters: [{ x: 7.58, z: 5.2, length: 2.4, rotation: Math.PI / 2 }],
  },
  {
    id: "wf-refugio",
    version: 2,
    system: "woodframe",
    floors: 1,
    footprint: "rectangular",
    name: "Refugio de un dormitorio",
    width: 6,
    depth: 6,
    bedrooms: 1,
    bathrooms: 1,
    description:
      "36 m² · Cabaña de 6 × 6 m con dormitorio y baño al fondo y estar-cocina de una sola pieza al frente.",
    notes: [
      "Dormitorio y baño comparten el muro húmedo del fondo.",
      "El ventanal al frente aporta luz natural a todo el estar y la cocina.",
    ],
    rooms: [
      room("Dormitorio", "bed", 0, 0, 3.6, 3, [2.8, 3]),
      room("Baño", "bath", 3.6, 0, 2.4, 3, [5, 3]),
    ],
    entrance: { x: 3.6, type: "ventanal" },
    openings: [win(1.1, 6), bigWin(6, 4.5), kitchenWin(0, 4.6)],
    counters: [{ x: 0.42, z: 4.6, length: 2.4, rotation: Math.PI / 2 }],
  },
  {
    id: "wf-duplex-4d",
    version: 2,
    system: "woodframe",
    floors: 2,
    footprint: "rectangular",
    recommended: true,
    name: "Dúplex de cuatro dormitorios",
    width: 7,
    depth: 7,
    bedrooms: 4,
    bathrooms: 2,
    description:
      "98 m² en dos plantas · Planta baja social con dormitorio de visitas; arriba, tres dormitorios y baño alrededor de un distribuidor.",
    notes: [
      "La escalera en U sube pegada al muro este y deja libre el estar.",
      "Los dos baños quedan en la misma vertical: una sola columna de cañerías.",
      "Arriba, un distribuidor central da a los tres dormitorios.",
    ],
    rooms: [
      room("Dormitorio de visitas", "bed", 0, 0, 3, 2.9, [2.3, 2.9]),
      room("Baño", "bath", 3, 0, 2.2, 2.9, [4.4, 2.9]),
    ],
    stairs: [{ floor: 0, type: "U", at: pt(5.2, 0), open: "S" }],
    entrance: { x: 3.4, type: "ventanal" },
    openings: [bigWin(5.9, 7), bigWin(7, 5.2), win(7, 1.4), win(6.1, 0), kitchenWin(0, 5.4)],
    counters: [{ x: 0.42, z: 5.4, length: 2.4, rotation: Math.PI / 2 }],
    upper: [
      {
        rooms: [
          room("Dormitorio principal", "bed", 0, 0, 3, 2.9, [2.3, 2.9]),
          room("Baño", "bath", 3, 0, 2.2, 2.9, [4.4, 2.9]),
          room("Dormitorio 2", "bed", 0, 4.1, 3.5, 2.9, [2.5, 4.1], { flip: true }),
          room("Dormitorio 3", "bed", 3.5, 4.1, 3.5, 2.9, [4.4, 4.1], { flip: true }),
        ],
        openings: [win(7, 3.5), win(6.1, 0)],
        open: "Distribuidor",
      },
    ],
  },
  {
    id: "wf-torre-3p",
    version: 2,
    system: "woodframe",
    floors: 3,
    footprint: "rectangular",
    recommended: true,
    name: "Casa vertical de tres plantas",
    width: 6,
    depth: 7.5,
    bedrooms: 4,
    bathrooms: 3,
    description:
      "135 m² en tres plantas · Terreno angosto: social abajo, dos dormitorios en el primer piso y suite y dormitorio en el segundo.",
    notes: [
      "Cada tramo de escalera arranca en un lado distinto: el vacío de una planta nunca cae sobre el de la otra.",
      "Cada planta tiene su distribuidor y su baño, sin atravesar dormitorios.",
    ],
    rooms: [room("Baño social", "bath", 1.95, 0, 2.25, 3, [3.4, 3])],
    stairs: [
      { floor: 0, type: "U", at: pt(0, 0), open: "S" },
      { floor: 1, type: "U", at: pt(4.2, 0), open: "S" },
    ],
    entrance: { x: 3, type: "ventanal" },
    openings: [win(0.85, 7.5), win(5.1, 7.5), bigWin(0, 5.5), kitchenWin(6, 5), win(6, 1.5)],
    counters: [{ x: 5.58, z: 5, length: 2.4, rotation: Math.PI / 2 }],
    upper: [
      {
        rooms: [
          room("Baño", "bath", 1.95, 0, 2.25, 3, [3.4, 3]),
          room("Dormitorio 1", "bed", 0, 4.2, 3, 3.3, [2.2, 4.2], { flip: true }),
          room("Dormitorio 2", "bed", 3, 4.2, 3, 3.3, [3.8, 4.2], { flip: true }),
        ],
        openings: [win(6, 3.6)],
        open: "Distribuidor",
      },
      {
        rooms: [
          room("Dormitorio principal", "bed", 0, 0, 4.2, 3, [3.4, 3]),
          room("Baño suite", "bath", 0, 4.2, 2.4, 3.3, [1.6, 4.2], { flip: true }),
          room("Dormitorio 4", "bed", 2.4, 4.2, 3.6, 3.3, [3.2, 4.2], { flip: true }),
        ],
        openings: [win(6, 3.6)],
        open: "Distribuidor",
      },
    ],
  },
  {
    id: "wf-l-patio",
    version: 2,
    system: "woodframe",
    floors: 1,
    footprint: "L",
    recommended: true,
    name: "Casa en L con patio",
    width: 11,
    depth: 8,
    bedrooms: 2,
    bathrooms: 1,
    contour: lContour(11, 8, 3, 3.4, "NE"),
    description:
      "78 m² · Ala privada al fondo y estar-cocina al frente, abrazando un patio de acceso al rincón noreste.",
    notes: [
      "El ala de dormitorios queda alejada de la calle y se separa del estar por el distribuidor.",
      "El rincón de la L forma un patio con vista desde el living y la cocina.",
    ],
    rooms: [
      room("Dormitorio 1", "bed", 0, 0, 3.2, 3.4, [2.4, 3.4]),
      room("Baño", "bath", 3.2, 0, 2, 3.4, [4.4, 3.4]),
      room("Dormitorio 2", "bed", 5.2, 0, 2.8, 3.4, [6, 3.4]),
    ],
    entrance: { x: 3.5, type: "ventanal" },
    openings: [
      bigWin(7.2, 8),
      bigWin(9.8, 8),
      bigWin(9.5, 3.4),
      bigWin(0, 5.8),
      kitchenWin(11, 5.9),
    ],
    counters: [{ x: 10.58, z: 5.9, length: 2.6, rotation: Math.PI / 2 }],
  },
  {
    id: "wf-l-dos-plantas",
    version: 2,
    system: "woodframe",
    floors: 2,
    footprint: "L",
    recommended: true,
    name: "Casa en L de dos plantas",
    width: 9,
    depth: 8,
    bedrooms: 4,
    bathrooms: 2,
    contour: lContour(9, 8, 3.5, 3, "NE"),
    description:
      "123 m² en dos plantas · Dormitorio y baño al fondo de planta baja; arriba, suite, dos dormitorios y estar sobre el living.",
    notes: [
      "La escalera en U queda en el ángulo interior de la L, junto al estar: un solo lugar para subir y bajar.",
      "El estar de planta alta aprovecha el techo del living y se abre al frente.",
    ],
    rooms: [
      room("Dormitorio", "bed", 0, 0, 3.2, 3, [2.4, 3]),
      room("Baño", "bath", 3.2, 0, 2.3, 3, [4.5, 3]),
    ],
    stairs: [{ floor: 0, type: "U", at: pt(5.95, 3), open: "W" }],
    entrance: { x: 3, type: "ventanal" },
    openings: [bigWin(6.2, 8), win(8.2, 8), bigWin(0, 5.5), kitchenWin(9, 6.5), win(9, 3.9)],
    counters: [{ x: 8.58, z: 6.5, length: 2.4, rotation: Math.PI / 2 }],
    upper: [
      {
        rooms: [
          room("Dormitorio principal", "bed", 0, 0, 3.2, 3, [2.4, 3]),
          room("Baño", "bath", 3.2, 0, 2.3, 3, [4.5, 3]),
          room("Dormitorio 2", "bed", 0, 4.2, 2.9, 3.8, [2, 4.2], { flip: true }),
          room("Dormitorio 3", "bed", 2.9, 4.2, 3, 3.8, [3.8, 4.2], { flip: true }),
        ],
        openings: [bigWin(9, 6.3), bigWin(7.4, 8), win(0, 3.6), win(9, 3.9)],
        open: "Estar y distribuidor",
      },
    ],
  },
  {
    id: "wf-l-tres-plantas",
    version: 2,
    system: "woodframe",
    floors: 3,
    footprint: "L",
    recommended: true,
    name: "Casa en L de tres plantas",
    width: 8,
    depth: 7.5,
    bedrooms: 4,
    bathrooms: 3,
    contour: lContour(8, 7.5, 3, 3, "NE"),
    description:
      "153 m² en tres plantas · Escritorio y social abajo, dos dormitorios en el primer piso y dos más en el segundo, con baño en cada nivel.",
    notes: [
      "Las dos escaleras están en extremos opuestos de la L: cada vacío cae en un lugar distinto.",
      "El rincón de la L queda libre en todas las plantas para ventilar e iluminar los baños del fondo.",
    ],
    rooms: [
      room("Escritorio", "study", 0, 0, 2.7, 3, [1.9, 3]),
      room("Baño", "bath", 2.7, 0, 2.3, 3, [3.9, 3]),
    ],
    stairs: [
      { floor: 0, type: "U", at: pt(6.2, 3), open: "S" },
      { floor: 1, type: "U", at: pt(0, 0), open: "S" },
    ],
    entrance: { x: 3, type: "ventanal" },
    openings: [win(0.9, 7.5), win(5.2, 7.5), kitchenWin(0, 5.2), win(8, 6.8)],
    counters: [{ x: 0.42, z: 5.2, length: 2.4, rotation: Math.PI / 2 }],
    upper: [
      {
        rooms: [
          room("Dormitorio 1", "bed", 1.95, 0, 3.05, 3, [3, 3]),
          room("Baño", "bath", 0, 4.2, 2.4, 3.3, [1.6, 4.2], { flip: true }),
          room("Dormitorio 2", "bed", 2.4, 4.2, 3, 3.3, [3.2, 4.2], { flip: true }),
        ],
        openings: [win(8, 6.5), bigWin(6.8, 7.5)],
        open: "Estar",
      },
      {
        rooms: [
          room("Dormitorio principal", "bed", 1.95, 0, 3.05, 3, [3, 3]),
          room("Baño", "bath", 0, 4.2, 2.4, 3.3, [1.6, 4.2], { flip: true }),
          room("Dormitorio 4", "bed", 2.4, 4.2, 3, 3.3, [3.2, 4.2], { flip: true }),
        ],
        openings: [win(8, 6.5), bigWin(6.8, 7.5)],
        open: "Estar",
      },
    ],
  },
];
void wall;
void doorAt;
