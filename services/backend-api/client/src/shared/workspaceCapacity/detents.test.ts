import { describe, it, expect } from "vitest";
import {
  WORKSPACE_CAPACITY_QUICK_PICKS,
  WORKSPACE_MAX_FEEDS,
  WORKSPACE_MIN_FEEDS,
  formatWorkspaceFeedCount,
} from "./detents";

describe("workspace capacity", () => {
  it("supports the complete exact-capacity range and prescribed quick picks", () => {
    expect(WORKSPACE_MIN_FEEDS).toBe(70);
    expect(WORKSPACE_MAX_FEEDS).toBe(1100);
    expect(WORKSPACE_CAPACITY_QUICK_PICKS).toEqual([70, 140, 300, 500, 1100]);
  });

  it("formats large capacities for people rather than exposing raw digits", () => {
    expect(formatWorkspaceFeedCount(1100)).toBe("1,100 feeds");
  });
});
