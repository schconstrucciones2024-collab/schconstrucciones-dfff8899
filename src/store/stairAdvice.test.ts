import { describe, expect, it } from "vitest";
import { initialConfig, resizeConfig, stairConflict } from "@/store/useConfigurator";
import { resolveProposal } from "@/store/stairAdvice";

const twoFloors = () => resizeConfig(initialConfig(), { floors: 2 });

describe("AI stair proposals", () => {
  it("a proposal outside the house is moved to a conflict-free spot", () => {
    const c = twoFloors(), s = c.stairs.find((v) => !v.exterior)!;
    const r = resolveProposal(c, { stairId: s.id, x: 500, z: 500, rotationDeg: 0, type: "recta", reason: "" });
    expect(r?.adjusted).toBe(true);
    expect(stairConflict(c, r!.stair)).toBeNull();
  });
  it("the current valid position is accepted as is", () => {
    const c = twoFloors(), s = c.stairs.find((v) => !v.exterior)!;
    const r = resolveProposal(c, { stairId: s.id, x: s.x, z: s.z, rotationDeg: (s.rotation * 180) / Math.PI, type: s.type, reason: "" });
    expect(r?.adjusted).toBe(false);
  });
  it("never moves the exterior stair", () => {
    const c = twoFloors();
    expect(resolveProposal(c, { stairId: "stair-entrada", x: 0, z: 0, rotationDeg: 0, type: "recta", reason: "" })).toBeNull();
  });
});
