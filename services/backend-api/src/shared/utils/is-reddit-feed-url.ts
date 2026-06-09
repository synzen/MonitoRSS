const REDDIT_HOSTNAME_SUFFIX = "reddit.com";

export function isRedditFeedUrl(url: string): boolean {
  let hostname: string;

  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return (
    hostname === REDDIT_HOSTNAME_SUFFIX ||
    hostname.endsWith(`.${REDDIT_HOSTNAME_SUFFIX}`)
  );
}
