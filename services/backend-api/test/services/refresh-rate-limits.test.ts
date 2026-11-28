import { describe, it } from "node:test";
import assert from "node:assert";
import {
  MAX_REFRESH_RATE_SECONDS,
  resolveRefreshRateLimits,
} from "../../src/services/user-feeds/refresh-rate-limits";

describe("resolveRefreshRateLimits", () => {
  const upgrade = { defaultRateSeconds: 600, supporterRateSeconds: 120 };

  it("uses the plan minimum when no platform floor applies", () => {
    const limits = resolveRefreshRateLimits({ planMinimumSeconds: 600 });

    assert.deepStrictEqual(limits, {
      minimumSeconds: 600,
      maximumSeconds: MAX_REFRESH_RATE_SECONDS,
      canUpgrade: false,
      limitedBy: "plan",
    });
  });

  it("keeps the plan minimum when the platform floor is faster", () => {
    const limits = resolveRefreshRateLimits({
      planMinimumSeconds: 600,
      premiumFloorSeconds: 300,
    });

    assert.strictEqual(limits.minimumSeconds, 600);
    assert.strictEqual(limits.limitedBy, "plan");
  });

  it("raises the minimum to the platform floor and reports the platform bound", () => {
    const limits = resolveRefreshRateLimits({
      planMinimumSeconds: 600,
      premiumFloorSeconds: 7200,
      upgrade,
    });

    assert.strictEqual(limits.minimumSeconds, 7200);
    assert.strictEqual(limits.limitedBy, "platform");
    // Upgrading cannot get below the platform floor, so it must not be offered.
    assert.strictEqual(limits.canUpgrade, false);
  });

  it("marks the platform as the bound when it equals the plan minimum", () => {
    const limits = resolveRefreshRateLimits({
      planMinimumSeconds: 600,
      premiumFloorSeconds: 600,
      upgrade,
    });

    assert.strictEqual(limits.minimumSeconds, 600);
    assert.strictEqual(limits.limitedBy, "platform");
    assert.strictEqual(limits.canUpgrade, false);
  });

  it("offers an upgrade when a faster plan lowers the effective minimum", () => {
    const limits = resolveRefreshRateLimits({
      planMinimumSeconds: 600,
      upgrade,
    });

    assert.strictEqual(limits.minimumSeconds, 600);
    assert.strictEqual(limits.canUpgrade, true);
    assert.strictEqual(limits.limitedBy, "plan");
  });

  it("offers an upgrade only down to the platform floor", () => {
    const limits = resolveRefreshRateLimits({
      planMinimumSeconds: 600,
      premiumFloorSeconds: 300,
      upgrade,
    });

    assert.strictEqual(limits.minimumSeconds, 600);
    assert.strictEqual(limits.canUpgrade, true);
  });

  it("does not offer an upgrade to accounts already faster than the default rate", () => {
    const limits = resolveRefreshRateLimits({
      planMinimumSeconds: 120,
      upgrade,
    });

    assert.strictEqual(limits.minimumSeconds, 120);
    assert.strictEqual(limits.canUpgrade, false);
  });

  it("does not offer an upgrade when the plan already matches the floor", () => {
    const limits = resolveRefreshRateLimits({
      planMinimumSeconds: 7200,
      premiumFloorSeconds: 7200,
      upgrade,
    });

    assert.strictEqual(limits.minimumSeconds, 7200);
    assert.strictEqual(limits.canUpgrade, false);
  });
});
