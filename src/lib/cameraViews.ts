import type { Point } from "@/config/geometry";
import { footprintWorld, signedDistance, toWorld, type HouseFrame, type Tree, treeInfo } from "./vegetation";

/**
 * Vistas de cámara del visor "Diseñá tu casa" y reglas para que la cámara no atraviese el suelo ni la casa.
 * Todo son funciones puras (sin Three), así que se prueban sin WebGL.
 */
export type Vec3 = [number, number, number];
export type CameraPose = { position: Vec3; target: Vec3 };
export type PresetId = "frontal" | "lateral" | "aerea" | "fachada" | "auto";

export const PRESETS: { id: PresetId; name: string; hint: string }[] = [
  { id: "frontal", name: "Frontal", hint: "La casa completa, de frente" },
  { id: "lateral", name: "Lateral", hint: "La casa de costado" },
  { id: "aerea", name: "Aérea", hint: "Vista desde arriba" },
  { id: "fachada", name: "Fachada", hint: "A la altura de los ojos, frente a la fachada" },
  { id: "auto", name: "Encuadre automático", hint: "Encuadra la casa y la vegetación" },
];

export type HouseVolume = HouseFrame & { height: number };
export const FOV = 45;
/** Altura mínima de la cámara sobre el suelo en vistas exteriores. */
export const MIN_CAMERA_Y = 0.35;
/** Separación mínima entre la cámara y las paredes en vistas exteriores. */
export const WALL_MARGIN = 0.4;

const tan = (fov: number) => Math.tan((fov * Math.PI) / 360);
/** Distancia para que un recuadro de `w` × `h` m entre en pantalla. */
export function fitDistance(w: number, h: number, aspect: number, fov = FOV): number {
  const t = tan(fov), a = Math.max(aspect, 0.2);
  return Math.max(h / (2 * t), w / (2 * t * a));
}

function contourBox(contour: Point[]) {
  const xs = contour.map((p) => p.x), zs = contour.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
}
/** Gira un vector horizontal del plano de la casa al mundo. */
const turn = (v: Point, rotation: number): Point => ({ x: v.x * Math.cos(rotation) - v.z * Math.sin(rotation), z: v.x * Math.sin(rotation) + v.z * Math.cos(rotation) });

function pose(center: Point, dir: Point, dist: number, elevation: number, targetY: number): CameraPose {
  const flat = Math.cos(elevation) * dist;
  return {
    position: [center.x + dir.x * flat, targetY + Math.sin(elevation) * dist, center.z + dir.z * flat],
    target: [center.x, targetY, center.z],
  };
}

/**
 * Vista predefinida de la casa. "Frente" es el lado +z del plano (el mismo del visor), "lateral" el lado +x.
 * `trees` solo se usa en el encuadre automático.
 */
export function presetPose(id: PresetId, house: HouseVolume, aspect: number, trees: Tree[] = []): CameraPose {
  const box = contourBox(house.contour);
  const center = toWorld({ x: box.cx, z: box.cz }, house);
  const h = house.height, deg = Math.PI / 180;
  let result: CameraPose;
  if (id === "frontal") {
    const d = fitDistance(box.width * 1.3, h * 1.5, aspect) + box.depth / 2;
    result = pose(center, turn({ x: 0, z: 1 }, house.rotation), d, 10 * deg, h * 0.42);
  } else if (id === "lateral") {
    const d = fitDistance(box.depth * 1.3, h * 1.5, aspect) + box.width / 2;
    result = pose(center, turn({ x: 1, z: 0 }, house.rotation), d, 10 * deg, h * 0.42);
  } else if (id === "aerea") {
    const ext = Math.hypot(box.width, box.depth) * 1.25 + 2;
    const d = fitDistance(ext, ext, aspect) * 1.05;
    result = pose(center, turn({ x: 0.55, z: 0.84 }, house.rotation), d, 55 * deg, 0.3);
  } else if (id === "fachada") {
    const eye = Math.min(1.6, h * 0.5);
    const d = Math.max(4, fitDistance(box.width * 1.15, 0, aspect) + box.depth / 2);
    result = pose(center, turn({ x: 0, z: 1 }, house.rotation), d, 0, eye);
    result.position[1] = eye;
  } else {
    result = frameAll(house, trees, aspect);
  }
  const c = constrainCamera(result.position, house, "exterior");
  return { position: c.position, target: result.target };
}

/** Encuadra la casa y toda la vegetación, mirando de tres cuartos. */
export function frameAll(house: HouseVolume, trees: Tree[], aspect: number): CameraPose {
  const pts: { p: Point; r: number }[] = footprintWorld(house).map((p) => ({ p, r: 0 }));
  for (const t of trees) pts.push({ p: { x: t.x, z: t.z }, r: treeInfo(t.kind).radius * t.scale });
  const minX = Math.min(...pts.map((v) => v.p.x - v.r)), maxX = Math.max(...pts.map((v) => v.p.x + v.r));
  const minZ = Math.min(...pts.map((v) => v.p.z - v.r)), maxZ = Math.max(...pts.map((v) => v.p.z + v.r));
  const tall = Math.max(house.height, ...trees.map((t) => treeInfo(t.kind).height * t.scale), 0);
  const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  const radius = Math.hypot(maxX - minX, maxZ - minZ, tall) / 2 + 1;
  const half = Math.atan(tan(FOV) * Math.min(1, Math.max(aspect, 0.2)));
  const dist = (radius / Math.sin(half)) * 1.05;
  const dir = turn({ x: 0.58, z: 0.81 }, house.rotation);
  return pose(center, dir, dist, 24 * (Math.PI / 180), tall * 0.3);
}

export type CameraMode = "exterior" | "interior" | "under";

/**
 * Corrige la posición de la cámara:
 *  - nunca por debajo del suelo (o del piso activo en el interior);
 *  - en exterior, nunca dentro del volumen de la casa: si queda adentro o a menos de WALL_MARGIN, la saca hacia afuera.
 * Devuelve la misma posición si no hay nada que corregir.
 */
export function constrainCamera(position: Vec3, house: HouseVolume, mode: CameraMode, floorY = 0): { position: Vec3; changed: boolean } {
  let [x, y, z] = position;
  let changed = false;
  const minY = mode === "interior" ? floorY + 0.25 : mode === "under" ? 0.05 : MIN_CAMERA_Y;
  if (y < minY) { y = minY; changed = true; }
  if (mode === "exterior" && house.contour.length >= 3 && y < house.height + 0.3) {
    const ring = footprintWorld(house);
    const { d, nearest } = signedDistance({ x, z }, ring);
    if (d < WALL_MARGIN) {
      let dx = x - nearest.x, dz = z - nearest.z;
      if (d < 0) { dx = -dx; dz = -dz; }
      let len = Math.hypot(dx, dz);
      if (len < 1e-6) {
        const c = ring.reduce((a, p) => ({ x: a.x + p.x / ring.length, z: a.z + p.z / ring.length }), { x: 0, z: 0 });
        dx = nearest.x - c.x; dz = nearest.z - c.z; len = Math.hypot(dx, dz) || 1;
      }
      x = nearest.x + (dx / len) * (WALL_MARGIN + 0.02);
      z = nearest.z + (dz / len) * (WALL_MARGIN + 0.02);
      changed = true;
    }
  }
  return { position: changed ? [x, y, z] : position, changed };
}
