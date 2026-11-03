export type OpeningType = "entrada" | "interior" | "ventana" | "ventanaGrande" | "ventanal" | "ventanaCocina";

export type OpeningSpec = {
  name: string;
  /** Width and height in meters; sill = height from the floor. */
  width: number;
  height: number;
  sill: number;
  door: boolean;
  /** Where it can be placed. */
  walls: "exterior" | "interior" | "any";
};

export const OPENINGS_CATALOG: Record<OpeningType, OpeningSpec> = {
  entrada: { name: "Puerta de entrada", width: 1.0, height: 2.1, sill: 0, door: true, walls: "exterior" },
  interior: { name: "Puerta interior", width: 0.8, height: 2.05, sill: 0, door: true, walls: "interior" },
  ventana: { name: "Ventana simple", width: 0.8, height: 1.0, sill: 1.1, door: false, walls: "any" },
  ventanaGrande: { name: "Ventana grande", width: 1.6, height: 1.2, sill: 0.9, door: false, walls: "exterior" },
  ventanal: { name: "Ventanal corredizo", width: 2.4, height: 2.1, sill: 0, door: true, walls: "exterior" },
  ventanaCocina: { name: "Ventana de cocina", width: 1.2, height: 0.4, sill: 1.1, door: false, walls: "exterior" },
};

export const OPENING_TYPES = Object.keys(OPENINGS_CATALOG) as OpeningType[];
