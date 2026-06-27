import { getPlanDisplayName, ProductKey } from "@/constants";

// The two workspace base tiers a subscription can be on. Retained as the key set
// for the feed-limit map and the current-capacity derivation; the capacity model
// no longer offers them as separate purchasable cards.
export const WORKSPACE_TIERS = [ProductKey.Tier2, ProductKey.Tier3] as const;
export type WorkspaceTier = (typeof WORKSPACE_TIERS)[number];

// Must match the backend's WORKSPACE_TIER_FEED_LIMITS (shared/utils/billing.ts),
// which the activation webhook and change-preview both read. The client can't
// import across the package boundary, so a guard test (WorkspaceBilling.test)
// locks these values to keep the displayed limit and the granted limit in step.
export const TIER_FEED_LIMITS: Record<WorkspaceTier, number> = {
  [ProductKey.Tier2]: 70,
  [ProductKey.Tier3]: 140,
};

// User-facing label for the Team plan at an arbitrary capacity chosen on the
// slider. The capacity model has a single plan name ("Team"); the feed count is
// what the buyer is choosing, so it rides in the label.
export const capacityPlanLabel = (feeds: number) =>
  `${getPlanDisplayName(ProductKey.Tier2)} (${feeds} feeds)`;
