import { UserFeed } from '../entities/user-feed.entity';

/**
 * Gets the effective refresh rate for a user feed.
 * Priority: userRefreshRateSeconds (user override) > refreshRateSeconds (system default)
 */
export function getEffectiveRefreshRateSeconds(
  feed: Pick<UserFeed, 'userRefreshRateSeconds' | 'refreshRateSeconds'>,
  fallback?: number
): number | undefined {
  return feed.userRefreshRateSeconds ?? feed.refreshRateSeconds ?? fallback;
}
