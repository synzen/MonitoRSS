export const MAX_REFRESH_RATE_SECONDS = 24 * 60 * 60;

export type RefreshRateLimitSource = "plan" | "platform";

export interface RefreshRateLimits {
  // Smallest interval the server accepts for this feed, after both the plan's
  // fastest rate and any platform-provider cost floor.
  minimumSeconds: number;
  maximumSeconds: number;
  // Whether a faster plan would actually lower minimumSeconds.
  canUpgrade: boolean;
  // Which bound sets the minimum: the user's plan or the platform provider.
  limitedBy: RefreshRateLimitSource;
}

export function resolveRefreshRateLimits(input: {
  // Fastest interval the feed's current plan/workspace allows, before floors.
  planMinimumSeconds: number;
  // Per-fetch cost floor of the feed's platform provider; 0 when none applies.
  premiumFloorSeconds?: number;
  // Rates a supporter upgrade would unlock; omitted when no upgrade exists.
  upgrade?: {
    defaultRateSeconds: number;
    supporterRateSeconds: number;
  };
}): RefreshRateLimits {
  const premiumFloorSeconds = input.premiumFloorSeconds ?? 0;
  const minimumSeconds = Math.max(
    input.planMinimumSeconds,
    premiumFloorSeconds,
  );
  const upgradeMinimumSeconds = input.upgrade
    ? Math.max(input.upgrade.supporterRateSeconds, premiumFloorSeconds)
    : undefined;

  return {
    minimumSeconds,
    maximumSeconds: MAX_REFRESH_RATE_SECONDS,
    canUpgrade:
      input.upgrade !== undefined &&
      // Mirrors the upgrade being locked for accounts still on the default
      // (non-supporter) rate.
      input.planMinimumSeconds >= input.upgrade.defaultRateSeconds &&
      (upgradeMinimumSeconds as number) < minimumSeconds,
    limitedBy:
      premiumFloorSeconds >= input.planMinimumSeconds ? "platform" : "plan",
  };
}
