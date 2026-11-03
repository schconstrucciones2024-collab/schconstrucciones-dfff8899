import { describe, expect, it } from 'vitest';
import { LAYOUT_PROPOSALS } from './layoutProposals';
import { buildLayoutProposal, decodeDesign, encodeDesign, initialConfig, placedRooms, validateOpening } from '@/store/useConfigurator';
import { detectRooms, inside, segmentInside, validateContour, wallOverlap } from './geometry';

describe('architectural proposals', () => {
  for (const proposal of LAYOUT_PROPOSALS) it(`${proposal.name}: full program, accessible rooms and saved geometry`, () => {
    const c = buildLayoutProposal(initialConfig(), proposal);
    expect(c.m2).toBe(proposal.width * proposal.depth);
    expect(placedRooms(c)).toEqual({ bedrooms: proposal.bedrooms, bathrooms: proposal.bathrooms });
    expect(c.fixtures.filter(f => f.kind === 'ducha')).toHaveLength(proposal.bathrooms);
    expect(c.counters.filter(v => v.kind === 'bano' && v.material === 'pino')).toHaveLength(proposal.bathrooms);
    expect(validateContour(c.contour, 1)).toBeNull();
    for (const w of c.walls[0] ?? []) { expect(segmentInside(w.a, w.b, c.contour)).toBe(true); expect(wallOverlap(w, c.walls[0] ?? [])).toBe(false); }
    expect(c.openings.filter(o => o.type === 'interior')).toHaveLength(proposal.rooms.length + (proposal.id === 'longitudinal' ? 1 : 0));
    for (const o of c.openings) expect(validateOpening(c, o)).toBeNull();
    expect(c.openings.filter(o => o.type === 'ventanal')).toHaveLength(1);
    const rooms = detectRooms(c.contour, c.walls[0] ?? []);
    expect(rooms).toHaveLength(proposal.rooms.length + (proposal.id === 'longitudinal' ? 2 : 1));
    for (const box of proposal.rooms) {
      const center = { x: box.x + box.w / 2 - proposal.width / 2, z: box.z + box.d / 2 - proposal.depth / 2 };
      const room = rooms.find(r => inside(center, r.polygon));
      expect(room).toBeDefined();
      expect(room?.area).toBeCloseTo(box.w * box.d);
      const fixtures = c.fixtures.filter(f => room && inside(f, room.polygon));
      expect(fixtures.map(f => f.kind).sort()).toEqual(box.kind === 'bed' ? ['cama'] : ['ducha', 'wc']);
    }
    expect(decodeDesign(encodeDesign(c))).toEqual(c);
  });
});