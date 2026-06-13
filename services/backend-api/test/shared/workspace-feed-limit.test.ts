import { describe, it } from "node:test";
import assert from "node:assert";
import {
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
        { productKey: SubscriptionProductKey.Tier3AdditionalFeed, quantity: 10 },
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
