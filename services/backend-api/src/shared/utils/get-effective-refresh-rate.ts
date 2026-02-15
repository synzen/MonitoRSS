export function getEffectiveRefreshRateSeconds(
  feed: { userRefreshRateSeconds?: number; refreshRateSeconds?: number },
  fallback?: number,
): number | undefined {
  return feed.userRefreshRateSeconds ?? feed.refreshRateSeconds ?? fallback;
}
