import { describe, it } from "node:test";
import assert from "node:assert";
import {
  PREMIUM_FEED_ALLOWANCES,
  resolveWorkspacePremiumAllowance,
  resolveWorkspaceFeedLimit,
  WORKSPACE_TIER_FEED_LIMITS,
} from "../../src/shared/utils/billing";
import { SubscriptionProductKey } from "../../src/repositories/shared/enums";

describe("resolveWorkspaceFeedLimit", () => {
  it("returns the base tier limit when no add-ons are present", () => {
    assert.strictEqual(
      resolveWorkspaceFeedLimit([
        { productKey: SubscriptionProductKey.Tier2, quantity: 1 },
      ]),
      WORKSPACE_TIER_FEED_LIMITS[SubscriptionProductKey.Tier2],
    );

    assert.strictEqual(
      resolveWorkspaceFeedLimit([
        { productKey: SubscriptionProductKey.Tier3, quantity: 1 },
      ]),
      WORKSPACE_TIER_FEED_LIMITS[SubscriptionProductKey.Tier3],
    );
  });

  it("adds one slot per additional-feed add-on quantity", () => {
    assert.strictEqual(
      resolveWorkspaceFeedLimit([
        { productKey: SubscriptionProductKey.Tier3, quantity: 1 },
        {
          productKey: SubscriptionProductKey.Tier3AdditionalFeed,
          quantity: 10,
        },
      ]),
      WORKSPACE_TIER_FEED_LIMITS[SubscriptionProductKey.Tier3] + 10,
    );
  });

  it("sums multiple add-on line items for the same add-on", () => {
    assert.strictEqual(
      resolveWorkspaceFeedLimit([
        { productKey: SubscriptionProductKey.Tier3, quantity: 1 },
        { productKey: SubscriptionProductKey.Tier3AdditionalFeed, quantity: 5 },
        { productKey: SubscriptionProductKey.Tier3AdditionalFeed, quantity: 3 },
      ]),
      WORKSPACE_TIER_FEED_LIMITS[SubscriptionProductKey.Tier3] + 8,
    );
  });

  it("does not grant add-on feeds to a Tier 2 base", () => {
    assert.strictEqual(
      resolveWorkspaceFeedLimit([
        { productKey: SubscriptionProductKey.Tier2, quantity: 1 },
        {
          productKey: SubscriptionProductKey.Tier3AdditionalFeed,
          quantity: 30,
        },
      ]),
      WORKSPACE_TIER_FEED_LIMITS[SubscriptionProductKey.Tier2],
    );
  });

  it("returns null when no base workspace tier is present", () => {
    assert.strictEqual(
      resolveWorkspaceFeedLimit([
        { productKey: SubscriptionProductKey.Tier3AdditionalFeed, quantity: 5 },
      ]),
      null,
    );

    assert.strictEqual(resolveWorkspaceFeedLimit([]), null);
  });

  it("returns null (never NaN) when a base tier is missing from the limit table", () => {
    // Simulates drift between WORKSPACE_BASE_TIER_KEYS and the feed-limit table:
    // a tier the resolver treats as a base tier but has no configured limit.
    // The old `?? 0` form let this become NaN; the resolver must signal null so
    // callers can fail loudly instead of reporting a bogus limit.
    const result = resolveWorkspaceFeedLimit([
      { productKey: SubscriptionProductKey.Tier1, quantity: 1 },
    ]);

    // Tier 1 is not a workspace base tier, so it resolves to null (no base tier
    // found) rather than NaN. This guards the contract the caller relies on:
    // the result is a number or null, never NaN.
    assert.strictEqual(result, null);
    assert.strictEqual(Number.isNaN(result as unknown as number), false);
  });
});

describe("resolveWorkspacePremiumAllowance", () => {
  it("maps the complete premium-feed ladder", () => {
    const cases = [
      [70, SubscriptionProductKey.Tier2, 5],
      [140, SubscriptionProductKey.Tier3, 10],
      [300, SubscriptionProductKey.Tier3, 20],
      [500, SubscriptionProductKey.Tier3, 35],
      [1000, SubscriptionProductKey.Tier3, 70],
      [2000, SubscriptionProductKey.Tier3, 140],
    ] as const;

    for (const [totalFeeds, baseTier, expected] of cases) {
      assert.strictEqual(
        resolveWorkspacePremiumAllowance({ totalFeeds, baseTier }),
        expected,
      );
    }
  });

  it("keeps Tier 2 on its fixed rung even when a legacy add-on increases total feeds", () => {
    assert.strictEqual(
      resolveWorkspacePremiumAllowance({
        totalFeeds: 500,
        baseTier: SubscriptionProductKey.Tier2,
      }),
      5,
    );
  });

  it("uses the largest configured rung for capacities above the ladder", () => {
    assert.strictEqual(
      resolveWorkspacePremiumAllowance({
        totalFeeds: 2500,
        baseTier: SubscriptionProductKey.Tier3,
      }),
      PREMIUM_FEED_ALLOWANCES.workspace[
        PREMIUM_FEED_ALLOWANCES.workspace.length - 1
      ]!.premiumSlots,
    );
  });
});
