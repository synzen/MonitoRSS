const REDDIT_HOSTNAME_SUFFIX = "reddit.com";

// Mirrors the backend's hostname-suffix detection (shared/utils/is-reddit-feed-url.ts)
// so client and server agree on what counts as a Reddit feed. Matching on the parsed
// hostname (not a substring) avoids false positives like reddit.com.evil.example.
export function isRedditFeedUrl(url: string): boolean {
  let hostname: string;

  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return hostname === REDDIT_HOSTNAME_SUFFIX || hostname.endsWith(`.${REDDIT_HOSTNAME_SUFFIX}`);
}
