import type { LayoutProposal } from "./layoutProposals";
import { bigWin, frontDoor, kitchenWin, lContour, pt, room, wall, win } from "./planKit";

/**
 * Distribuciones de construcción tradicional (mampostería con losa o techo de chapa). Los muros portantes alinean entre
 * plantas, las luces son moderadas y los ambientes de servicio (cocina, lavadero, baño) se cierran y agrupan sobre
 * una misma pared húmeda.
 */
export const TRADICIONAL_PLANS: LayoutProposal[] = [
  {
    id: "tr-compacta",
    version: 2,
    system: "tradicional",
    floors: 1,
    footprint: "rectangular",
    recommended: true,
    name: "Compacta con cocina independiente",
    width: 6,
    depth: 8,
    bedrooms: 1,
    bathrooms: 1,
    description:
      "48 m² · Dormitorio y baño al fondo, cocina cerrada al frente y living-comedor en el centro de la casa.",
    notes: [
      "La cocina cerrada ventila al exterior y aísla el olor y el vapor del living.",
      "El baño abre al living, no a la cocina ni al dormitorio.",
    ],
    rooms: [
      room("Dormitorio", "bed", 0, 0, 3.6, 3.3, [2.8, 3.3]),
      room("Baño", "bath", 3.6, 0, 2.4, 3.3, [5, 3.3]),
      room("Cocina", "kitchen", 3.6, 5.4, 2.4, 2.6, [4.5, 5.4]),
    ],
    entrance: { x: 2.3, type: "entrada" },
    openings: [win(0.9, 8), bigWin(0, 5.6), kitchenWin(4.5, 8), kitchenWin(6, 6.9)],
    counters: [
      { x: 5.58, z: 6.9, length: 2, rotation: Math.PI / 2 },
      { x: 4.5, z: 7.58, length: 1.5 },
    ],
    open: "Living-comedor",
  },
  {
    id: "tr-dos-dormitorios",
    version: 2,
    system: "tradicional",
    floors: 1,
    footprint: "rectangular",
    name: "Dos dormitorios con cocina cerrada",
    width: 8,
    depth: 8,
    bedrooms: 2,
    bathrooms: 1,
    description:
      "64 m² · Dormitorios y baño en el fondo, cocina cerrada con salida al living y un solo estar-comedor que distribuye todo.",
    notes: [
      "Todos los ambientes cerrados abren a un único estar-comedor: no hay pasillos que restan superficie.",
      "La cocina cerrada, en la esquina del frente, ventila directo al exterior.",
    ],
    rooms: [
      room("Dormitorio 1", "bed", 0, 0, 3.3, 3.4, [2.4, 3.4]),
      room("Baño", "bath", 3.3, 0, 2, 3.4, [4.4, 3.4]),
      room("Dormitorio 2", "bed", 5.3, 0, 2.7, 3.4, [6.1, 3.4]),
      room("Cocina", "kitchen", 5.3, 5.2, 2.7, 2.8, [6.3, 5.2]),
    ],
    entrance: { x: 2, type: "entrada" },
    openings: [bigWin(4.2, 8), win(6.6, 8), bigWin(0, 5.8), win(8, 4.3), kitchenWin(8, 6.7)],
    counters: [{ x: 7.58, z: 6.7, length: 2.2, rotation: Math.PI / 2 }],
    open: "Living-comedor",
  },
  {
    id: "tr-tres-dormitorios",
    version: 2,
    system: "tradicional",
    floors: 1,
    footprint: "rectangular",
    name: "Tres dormitorios con lavadero",
    width: 9,
    depth: 9,
    bedrooms: 3,
    bathrooms: 1,
    description:
      "81 m² · Tres dormitorios en fila al fondo, baño y lavadero juntos sobre el lado oeste y cocina cerrada al frente.",
    notes: [
      "Baño y lavadero comparten la pared húmeda y la salida de desagües.",
      "Un pasillo corto abre a los tres dormitorios y desemboca en el living-comedor.",
    ],
    rooms: [
      room("Dormitorio 1", "bed", 0, 0, 3.2, 3.5, [2.4, 3.5]),
      room("Dormitorio 2", "bed", 3.2, 0, 2.9, 3.5, [4.1, 3.5]),
      room("Dormitorio 3", "bed", 6.1, 0, 2.9, 3.5, [7, 3.5]),
      room("Baño", "bath", 0, 4.6, 2.2, 2.6, [2.2, 6.4]),
      room("Lavadero", "service", 0, 7.2, 2.2, 1.8, [2.2, 8.1]),
      room("Cocina", "kitchen", 6.1, 5.8, 2.9, 3.2, [7, 5.8]),
    ],
    entrance: { x: 3.4, type: "entrada" },
    openings: [bigWin(5, 9), win(7.7, 9), win(9, 4.2), kitchenWin(9, 7.4)],
    counters: [{ x: 8.58, z: 7.4, length: 2.4, rotation: Math.PI / 2 }],
    open: "Living-comedor",
  },
  {
    id: "tr-duplex",
    version: 2,
    system: "tradicional",
    floors: 2,
    footprint: "rectangular",
    recommended: true,
    name: "Dúplex con cocina y baño alineados",
    width: 8,
    depth: 7.1,
    bedrooms: 3,
    bathrooms: 2,
    description:
      "114 m² en dos plantas · Cocina, baño y escalera al fondo de planta baja; arriba, tres dormitorios y baño sobre el mismo eje.",
    notes: [
      "El baño de planta alta queda justo sobre el de planta baja: una sola columna de desagües.",
      "La escalera sube pegada al muro este y deja libre el living-comedor.",
    ],
    rooms: [
      room("Cocina", "kitchen", 0, 0, 3.9, 3, [2.9, 3]),
      room("Baño", "bath", 3.9, 0, 2.3, 3, [5.3, 3]),
    ],
    stairs: [{ floor: 0, type: "U", at: pt(6.2, 0), open: "S" }],
    entrance: { x: 2, type: "entrada" },
    openings: [
      bigWin(4.8, 7.1),
      win(7, 7.1),
      bigWin(0, 5.1),
      bigWin(8, 5.2),
      win(8, 1.4),
      win(7.1, 0),
      kitchenWin(1.9, 0),
    ],
    counters: [{ x: 1.95, z: 0.42, length: 3.2 }],
    open: "Living-comedor",
    upper: [
      {
        rooms: [
          room("Dormitorio principal", "bed", 0, 0, 3.9, 3, [2.9, 3]),
          room("Baño", "bath", 3.9, 0, 2.3, 3, [5.3, 3]),
          room("Dormitorio 2", "bed", 0, 4.2, 4, 2.9, [3, 4.2], { flip: true }),
          room("Dormitorio 3", "bed", 4, 4.2, 4, 2.9, [5, 4.2], { flip: true }),
        ],
        openings: [win(8, 3.6), win(7.1, 0)],
        open: "Distribuidor",
      },
    ],
  },
  {
    id: "tr-tres-niveles",
    version: 2,
    system: "tradicional",
    floors: 3,
    footprint: "rectangular",
    recommended: true,
    name: "Casa en tres niveles",
    width: 6.6,
    depth: 8,
    bedrooms: 4,
    bathrooms: 3,
    description:
      "158 m² en tres plantas · Terreno angosto: social con cocina cerrada abajo, dos dormitorios en el primer piso y suite en el segundo.",
    notes: [
      "Las escaleras de cada tramo arrancan en extremos opuestos: el vacío de un nivel nunca cae sobre el del siguiente.",
      "Cada planta tiene su propio baño y un distribuidor: no se atraviesan dormitorios.",
    ],
    rooms: [
      room("Baño", "bath", 1.95, 0, 2.45, 3, [3.4, 3]),
      room("Cocina", "kitchen", 4, 5.2, 2.6, 2.8, [5, 5.2]),
    ],
    stairs: [
      { floor: 0, type: "U", at: pt(0, 0), open: "S" },
      { floor: 1, type: "U", at: pt(4.8, 0), open: "S" },
    ],
    entrance: { x: 2.4, type: "entrada" },
    openings: [win(0.8, 8), win(5.3, 8), bigWin(0, 5.5), kitchenWin(6.6, 6.7), win(6.6, 1.5)],
    counters: [{ x: 6.18, z: 6.7, length: 2.4, rotation: Math.PI / 2 }],
    open: "Living-comedor",
    upper: [
      {
        rooms: [
          room("Baño", "bath", 1.95, 0, 2.45, 3, [3.4, 3]),
          room("Dormitorio 1", "bed", 0, 4.2, 3.3, 3.8, [2.4, 4.2], { flip: true }),
          room("Dormitorio 2", "bed", 3.3, 4.2, 3.3, 3.8, [4.2, 4.2], { flip: true }),
        ],
        openings: [win(6.6, 3.6)],
        open: "Distribuidor",
      },
      {
        rooms: [
          room("Dormitorio principal", "bed", 0, 0, 4.4, 3, [3.6, 3]),
          room("Baño suite", "bath", 0, 4.2, 2.4, 3.8, [1.6, 4.2], { flip: true }),
          room("Dormitorio 4", "bed", 2.4, 4.2, 4.2, 3.8, [3.4, 4.2], { flip: true }),
        ],
        openings: [win(6.6, 3.6)],
        open: "Distribuidor",
      },
    ],
  },
  {
    id: "tr-l-patio",
    version: 2,
    system: "tradicional",
    floors: 1,
    footprint: "L",
    recommended: true,
    name: "Casa en L con patio de servicio",
    width: 10.5,
    depth: 8.4,
    bedrooms: 2,
    bathrooms: 1,
    contour: lContour(10.5, 8.4, 2.5, 3.6, "NW"),
    description:
      "79 m² · Ala de dormitorios al fondo y cocina y lavadero sobre un patio de servicio en el rincón noroeste.",
    notes: [
      "Cocina y lavadero dan al patio: se ventilan y se separan de la zona de dormir.",
      "El living-comedor ocupa todo el frente y abre a la entrada.",
    ],
    rooms: [
      room("Dormitorio 1", "bed", 2.5, 0, 3.2, 3.6, [4.3, 3.6]),
      room("Baño", "bath", 5.7, 0, 2, 3.6, [7, 3.6]),
      room("Dormitorio 2", "bed", 7.7, 0, 2.8, 3.6, [8.6, 3.6]),
      room("Cocina", "kitchen", 0, 3.6, 3, 3, [3, 5.4]),
      room("Lavadero", "service", 0, 6.6, 3, 1.8, [3, 7.5]),
    ],
    entrance: { x: 5.5, type: "entrada" },
    openings: [
      bigWin(3.9, 8.4),
      bigWin(7.8, 8.4),
      bigWin(10.5, 6),
      kitchenWin(0, 5.1),
      kitchenWin(1.25, 3.6),
    ],
    counters: [
      { x: 0.42, z: 5.1, length: 2.4, rotation: Math.PI / 2 },
      { x: 1.65, z: 4.02, length: 1.8 },
    ],
    open: "Living-comedor",
  },
  {
    id: "tr-l-dos-plantas",
    version: 2,
    system: "tradicional",
    floors: 2,
    footprint: "L",
    recommended: true,
    name: "Casa en L de dos plantas",
    width: 9,
    depth: 7.5,
    bedrooms: 3,
    bathrooms: 2,
    contour: lContour(9, 7.5, 3.5, 3, "NW"),
    description:
      "114 m² en dos plantas · Cocina y baño al fondo de planta baja; arriba, suite, dos dormitorios y distribuidor.",
    notes: [
      "La escalera queda en el extremo oeste de la L, lejos del acceso, y libera el living.",
      "Cocina y baño se agrupan sobre el mismo muro; el baño de arriba queda sobre el de abajo.",
    ],
    rooms: [
      room("Baño", "bath", 3.5, 0, 2.3, 3, [5, 3]),
      room("Cocina", "kitchen", 5.8, 0, 3.2, 3, [6.9, 3]),
    ],
    stairs: [{ floor: 0, type: "U", at: pt(0, 3), open: "S" }],
    entrance: { x: 4.2, type: "entrada" },
    openings: [
      bigWin(2.2, 7.5),
      bigWin(6.4, 7.5),
      bigWin(9, 5.5),
      win(0, 4.5),
      kitchenWin(9, 1.5),
      kitchenWin(7.1, 0),
    ],
    counters: [
      { x: 8.58, z: 1.5, length: 2.4, rotation: Math.PI / 2 },
      { x: 7.1, z: 0.42, length: 2 },
    ],
    open: "Living-comedor",
    upper: [
      {
        rooms: [
          room("Dormitorio principal", "bed", 3.5, 0, 3.3, 3, [4.4, 3]),
          room("Baño", "bath", 6.8, 0, 2.2, 3, [8, 3]),
          room("Dormitorio 2", "bed", 2, 4.2, 3.4, 3.3, [3, 4.2], { flip: true }),
          room("Dormitorio 3", "bed", 5.4, 4.2, 3.6, 3.3, [6.4, 4.2], { flip: true }),
        ],
        openings: [win(9, 3.6), win(0, 4.5), win(0, 6.8)],
        open: "Distribuidor",
      },
    ],
  },
  {
    id: "tr-l-tres-plantas",
    version: 2,
    system: "tradicional",
    floors: 3,
    footprint: "L",
    recommended: true,
    name: "Casa en L de tres plantas",
    width: 8,
    depth: 7.5,
    bedrooms: 5,
    bathrooms: 3,
    contour: lContour(8, 7.5, 3, 3, "NW"),
    description:
      "153 m² en tres plantas · Social con cocina cerrada abajo, dos dormitorios en el primer piso y tres en el segundo.",
    notes: [
      "Las escaleras están en los dos extremos de la L: ningún vacío cae sobre otro.",
      "Los baños quedan en la misma vertical en las tres plantas.",
    ],
    rooms: [
      room("Cocina", "kitchen", 3, 0, 3, 3, [4, 3]),
      room("Baño", "bath", 6, 0, 2, 3, [7.2, 3]),
    ],
    stairs: [
      { floor: 0, type: "U", at: pt(6.2, 3), open: "S" },
      { floor: 1, type: "U", at: pt(0, 3), open: "S" },
    ],
    entrance: { x: 3.5, type: "entrada" },
    openings: [
      win(1, 7.5),
      bigWin(5, 7.5),
      bigWin(0, 5.5),
      win(8, 6.8),
      kitchenWin(4.5, 0),
      kitchenWin(3, 1.8),
    ],
    counters: [
      { x: 4.5, z: 0.42, length: 2 },
      { x: 3.42, z: 1.8, length: 2, rotation: Math.PI / 2 },
    ],
    open: "Living-comedor",
    upper: [
      {
        rooms: [
          room("Dormitorio 1", "bed", 3, 0, 3, 3, [3.9, 3]),
          room("Baño", "bath", 6, 0, 2, 3, [7.2, 3]),
          room("Dormitorio 2", "bed", 2, 4.2, 3.2, 3.3, [2.8, 4.2], { flip: true }),
        ],
        openings: [win(8, 6.8), win(8, 4.5), bigWin(6.9, 7.5)],
        open: "Estar",
      },
      {
        rooms: [
          room("Dormitorio principal", "bed", 3, 0, 3, 3, [3.9, 3]),
          room("Baño", "bath", 6, 0, 2, 3, [7.2, 3]),
          room("Dormitorio 3", "bed", 2, 4.2, 3.2, 3.3, [2.8, 4.2], { flip: true }),
          room("Dormitorio 4", "bed", 5.2, 4.2, 2.8, 3.3, [6, 4.2], { flip: true }),
        ],
        openings: [win(0, 4.5)],
        open: "Distribuidor",
      },
    ],
  },
];
void wall;
void frontDoor;
