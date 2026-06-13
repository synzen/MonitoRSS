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
