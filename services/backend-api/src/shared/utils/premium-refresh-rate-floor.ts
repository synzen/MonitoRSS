import { isRedditFeedUrl } from "./is-reddit-feed-url";

// Reddit feeds fetch with the feed owner's own OAuth grant rather than a
// metered platform-provider key, so they inherit the regular plan refresh
// rates. Every other platform feed keeps the premium per-fetch floor.
export function appliesPremiumRefreshRateFloor(url: string): boolean {
  return !isRedditFeedUrl(url);
}
