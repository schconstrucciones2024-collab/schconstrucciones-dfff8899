import { describe, expect, it } from 'vitest';
import { interiorCamera } from './interiorCamera';
const contour = [{ x: -4, z: -3 }, { x: 4, z: -3 }, { x: 4, z: 3 }, { x: -4, z: 3 }];
describe('interior overhead view', () => {
  it('starts above center with a near-vertical viewing angle', () => {
    const v = interiorCamera(contour, 1, 1);
    expect(v.target).toEqual([0, 1, 0]);
    expect(v.position[1]).toBeGreaterThan(10);
    expect(Math.atan2(v.position[2], v.position[1] - 1) * 180 / Math.PI).toBeLessThan(20);
  });
  it('fits full width on narrow mobile screens', () => {
    expect(interiorCamera(contour, 1, 0.5).position[1]).toBeGreaterThan(interiorCamera(contour, 1, 1.5).position[1]);
  });
  it('targets the active floor and off-center footprint', () => {
    expect(interiorCamera(contour.map(p => ({ x: p.x + 10, z: p.z - 5 })), 3.85, 1).target).toEqual([10, 3.85, -5]);
  });
});