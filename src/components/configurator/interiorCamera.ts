import { bounds, type Point } from '@/config/geometry';

/** Fit the full footprint from above with a slight tilt for depth. */
export function interiorCamera(contour: Point[], floorY: number, aspect: number, fov = 45) {
  const b = bounds(contour), x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
  const height = Math.max(b.depth, b.width / Math.max(aspect, 0.2)) / (2 * Math.tan(fov * Math.PI / 360)) * 1.35;
  return { position: [x, floorY + height, z + height * 0.3] as [number, number, number], target: [x, floorY, z] as [number, number, number] };
}