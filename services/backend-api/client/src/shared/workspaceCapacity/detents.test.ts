import { describe, it, expect } from "vitest";
import { WORKSPACE_DETENTS } from "./detents";

describe("WORKSPACE_DETENTS", () => {
  it("exposes the decided detent anchors in ascending order", () => {
    expect(WORKSPACE_DETENTS).toEqual([70, 100, 140, 200, 300, 500]);
  });

  // The slider domain is the index into this array, so the anchors must be
  // strictly increasing for ArrowRight/ArrowLeft to mean "more/fewer feeds".
  it("is strictly increasing so each index step changes capacity in one direction", () => {
    for (let i = 1; i < WORKSPACE_DETENTS.length; i += 1) {
      expect(WORKSPACE_DETENTS[i]).toBeGreaterThan(WORKSPACE_DETENTS[i - 1]);
    }
  });

  it("starts at the base workspace tier's feed limit (70)", () => {
    expect(WORKSPACE_DETENTS[0]).toBe(70);
  });
});
