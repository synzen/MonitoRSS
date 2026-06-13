import type { Config } from "../../config";
import { SubscriptionProductKey } from "../../repositories/shared/enums";

// Workspace billing (subscriptions, dormancy, the never-activated creation
// cap) only exists when Paddle is configured. Self-hosted instances without
// Paddle keep fully active workspaces with default benefits.
export function isBillingEnabled(config: Config): boolean {
  return Boolean(
    config.BACKEND_API_PADDLE_KEY && config.BACKEND_API_PADDLE_URL,
  );
}

// The base plans a workspace subscription can carry. Tier 1 and Free are
// personal-only. Read by both the billing-update validation and the webhook
// handler so the two gates cannot drift apart.
export const WORKSPACE_BASE_TIER_KEYS = new Set<string>([
  SubscriptionProductKey.Tier2,
  SubscriptionProductKey.Tier3,
]);

export const WORKSPACE_PRODUCT_KEYS = new Set<string>([
  ...WORKSPACE_BASE_TIER_KEYS,
  SubscriptionProductKey.Tier3AdditionalFeed,
]);

// How long a conversion-in-progress guard suppresses feed-limit enforcement and
// blocks a second concurrent conversion. Comfortably longer than webhook
// latency so a normal conversion is covered, short enough that a dropped
// webhook can't exempt (or block) a workspace for long. Shared by the
// enforcement read model and the conversion command so the two cannot drift.
export const CONVERSION_GUARD_TTL_MS = 5 * 60 * 1000;

// The single definition of "can this personal subscription fund a workspace,
// and how many feeds does it bring": a base workspace tier (Tier 2 / 3) yields
// the feed limit it carries. Used by both the conversion read model (eligible /
// ineligible) and the conversion command (proceed / throw) so the offer and the
// action can't drift apart. Returns null when there is no convertible plan.
export function resolvePersonalConvertibility(
  personalSubscription:
    | { productKey: string; benefits: { maxUserFeeds: number } }
    | null
    | undefined,
): { feedLimit: number } | null {
  if (
    !personalSubscription ||
    !WORKSPACE_BASE_TIER_KEYS.has(personalSubscription.productKey)
  ) {
    return null;
  }

  return { feedLimit: personalSubscription.benefits.maxUserFeeds };
}
