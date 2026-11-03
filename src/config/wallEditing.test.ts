import { describe, expect, it } from 'vitest';
import { distance, polygonArea, validateContour } from './geometry';
import { endpointAtLength, followContour, moveCorner, pencilPoint, resizeExterior } from './wallEditing';
import { initialConfig, resizeConfig, useConfigurator } from '@/store/useConfigurator';

const rectangle = [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 4 }, { x: 0, z: 4 }];
describe('edición visual en metros', () => {
  it('a wall set to 3.25 m has an exact 3.25 m length, including diagonals', () => {
    const a = { x: 1, z: 2 }, b = { x: 4, z: 6 };
    expect(distance(a, endpointAtLength(a, b, 3.25))).toBeCloseTo(3.25, 10);
  });
  it('sets exterior wall to 8 m without breaking rectangular corners or metric area', () => {
    const next = resizeExterior(rectangle, 0, 8, true);
    const a = next[0], b = next[1];
    if (!a || !b) throw new Error('Faltan extremos');
    expect(distance(a, b)).toBe(8);
    expect(next[2]).toEqual({ x: 8, z: 4 });
    expect(polygonArea(next)).toBe(32);
    expect(validateContour(next, 1)).toBeNull();
    expect(followContour({ x: 6, z: 2 }, rectangle, next)).toEqual({ x: 8, z: 2 });
  });
  it('draws snapped horizontal and vertical strokes in meters', () => {
    expect(pencilPoint({ x: 5.23, z: 0.8 }, { x: 0, z: 0 })).toEqual({ x: 5.2, z: 0 });
    expect(pencilPoint({ x: 0.4, z: 3.27 }, { x: 0, z: 0 })).toEqual({ x: 0, z: 3.3 });
  });
  it('moves a corner and its supporting lines while retaining a closed footprint', () => {
    expect(moveCorner(rectangle, 2, { x: 8, z: 5 }, true)).toEqual([{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 5 }, { x: 0, z: 5 }]);
  });
  it('retains interior wall additions, exact lengths, removal and undo', () => {
    const c = resizeConfig(initialConfig(), { contour: rectangle, walls: [[]], stairs: [], openings: [] });
    useConfigurator.setState({ config: c, past: [], future: [], activeFloor: 0, error: null });
    const s = useConfigurator.getState();
    s.addWall({ x: 1, z: 1 }, { x: 4, z: 1 });
    const w = useConfigurator.getState().config.walls[0]?.[0];
    if (!w) throw new Error('Pared no creada');
    s.editWall(w.id, { b: endpointAtLength(w.a, w.b, 3.25) });
    const edited = useConfigurator.getState().config.walls[0]?.[0];
    if (!edited) throw new Error('Pared no editada');
    expect(distance(edited.a, edited.b)).toBeCloseTo(3.25);
    s.deleteObject(w.id);
    expect(useConfigurator.getState().config.walls[0]).toHaveLength(0);
    s.undo();
    expect(useConfigurator.getState().config.walls[0]).toHaveLength(1);
  });
});