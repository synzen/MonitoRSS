import type { Config } from "../../config";
import {
  SubscriptionProductKey,
  UserFeedDisabledCode,
} from "../../repositories/shared/enums";

// The disable states that still occupy a feed-limit slot, so an already
// over-limit or manually-disabled scope isn't double-counted. The single
// source of truth shared by limit enforcement (user-feeds.service) and the
// change-preview's projected feed impact (workspace-billing.service) so the
// previewed disable count and what activation actually disables cannot drift.
export const DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS = [
  UserFeedDisabledCode.ExceededFeedLimit,
  UserFeedDisabledCode.Manual,
];

// Workspace billing (subscriptions, dormancy, the never-activated creation
// cap) is on only when the supporter program is enabled AND Paddle is
// configured. BACKEND_API_ENABLE_SUPPORTERS is the master switch: turning it
// off yields the self-host posture (fully active workspaces, default benefits)
// even if Paddle credentials are still present. Paddle remains required so the
// billing endpoints never run without a Paddle client behind them.
export function isBillingEnabled(config: Config): boolean {
  return Boolean(
    config.BACKEND_API_ENABLE_SUPPORTERS &&
      config.BACKEND_API_PADDLE_KEY &&
      config.BACKEND_API_PADDLE_URL,
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

// Feed limit each base workspace tier carries. The single source of truth the
// webhook's benefits table and the change-preview's projected-impact both read,
// so the activated limit and the previewed limit cannot drift.
export const WORKSPACE_TIER_FEED_LIMITS = {
  [SubscriptionProductKey.Tier2]: 70,
  [SubscriptionProductKey.Tier3]: 140,
} as const satisfies Record<string, number>;

// The feed limit a set of subscription items would grant: the base tier's limit
// plus one slot per additional-feed add-on. Mirrors how the webhook computes
// maxUserFeeds when it activates the same items. Returns null when no base
// workspace tier is present (the caller validates that separately).
export function resolveWorkspaceFeedLimit(
  items: Array<{ productKey: string; quantity: number }>,
): number | null {
  const baseTier = items.find((item) =>
    WORKSPACE_BASE_TIER_KEYS.has(item.productKey),
  );

  if (!baseTier) {
    return null;
  }

  const baseLimit =
    WORKSPACE_TIER_FEED_LIMITS[
      baseTier.productKey as keyof typeof WORKSPACE_TIER_FEED_LIMITS
    ];

  // A base tier that's a workspace tier but is missing from the feed-limit
  // table (the two constants drifting apart) would otherwise yield NaN, which
  // `?? 0` does not catch. Signal "unknown" so the caller decides, rather than
  // silently reporting a bogus limit.
  if (baseLimit == null) {
    return null;
  }

  const addonFeeds = items
    .filter(
      (item) => item.productKey === SubscriptionProductKey.Tier3AdditionalFeed,
    )
    .reduce((sum, item) => sum + item.quantity, 0);

  return baseLimit + addonFeeds;
}

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
