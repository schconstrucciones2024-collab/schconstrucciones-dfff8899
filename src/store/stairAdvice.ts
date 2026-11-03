import { FIXTURE_SIZES, stairGeometry, type Stair } from "@/config/geometry";
import { FLOOR_STEP, findStairSpot, stairConflict, type HouseConfig } from "@/store/useConfigurator";

const r2 = (v: number) => Math.round(v * 100) / 100;
const pts = (p: { x: number; z: number }[]) => p.map((q) => [r2(q.x), r2(q.z)]);

/** Compact metric snapshot of the design for the AI reviewer, including validator conflicts. */
export function stairDesignSummary(c: HouseConfig) {
  return JSON.stringify({
    floors: c.floors,
    contour: pts(c.contour),
    walls: c.walls.map((ws, floor) => ws.map((w) => ({ floor, a: [r2(w.a.x), r2(w.a.z)], b: [r2(w.b.x), r2(w.b.z)] }))).flat(),
    furniture: [
      ...c.fixtures.map((f) => ({ floor: f.floor, kind: f.kind, x: r2(f.x), z: r2(f.z), w: FIXTURE_SIZES[f.kind].width, d: FIXTURE_SIZES[f.kind].depth })),
      ...c.counters.map((f) => ({ floor: f.floor, kind: `mesada-${f.kind}`, x: r2(f.x), z: r2(f.z), w: f.length, d: f.depth })),
    ],
    stairs: c.stairs.map((s) => {
      const g = stairGeometry(s, FLOOR_STEP);
      return {
        id: s.id, floor: s.floor, exterior: !!s.exterior, type: s.type, width: s.width,
        x: r2(s.x), z: r2(s.z), rotationDeg: Math.round((s.rotation * 180) / Math.PI),
        footprint: s.exterior ? undefined : pts(g.footprint), upperHole: s.exterior ? undefined : pts(g.hole),
        conflict: s.exterior ? null : stairConflict(c, s),
      };
    }),
  });
}

export type StairProposal = { stairId: string; x: number; z: number; rotationDeg: number; type: Stair["type"]; reason: string };

/**
 * Turns an AI proposal into a stair the validator accepts: the proposal itself when it is free,
 * otherwise the nearest viable spot searched from it. Returns null when nothing fits.
 */
export function resolveProposal(c: HouseConfig, p: StairProposal): { stair: Stair; adjusted: boolean } | null {
  const s = c.stairs.find((v) => v.id === p.stairId && !v.exterior);
  if (!s || ![p.x, p.z, p.rotationDeg].every(Number.isFinite)) return null;
  const candidate: Stair = {
    ...s, x: r2(p.x), z: r2(p.z), type: p.type,
    width: p.type === "caracol" ? Math.min(s.width, 0.75) : Math.max(s.width, 0.9),
    rotation: ((((p.rotationDeg * Math.PI) / 180) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
  };
  if (!stairConflict(c, candidate)) return { stair: candidate, adjusted: false };
  const spot = findStairSpot(c, s.floor, candidate, s.id);
  return spot ? { stair: { ...s, ...spot, id: s.id }, adjusted: true } : null;
}
