import {
  describeFeedFailure,
  fetchFeedViaProd,
  isValidFeedXml,
} from "./prod-fetch";

/**
 * Returns the subset of URLs whose recent prod request history (up to the
 * last 100 requests within 30 days) has a >= 50% success rate. URLs with no
 * recent history return no rows and are absent from the result, so callers
 * must treat absence as "unknown" and fall back to a live probe, not as dead.
 */
export async function checkUrlsReliability(
  pgClient: import("pg").Client,
  urls: string[],
): Promise<Set<string>> {
  const SAMPLE_SIZE = 100;
  const { rows } = await pgClient.query(
    `SELECT url
     FROM (
       SELECT url, status,
              ROW_NUMBER() OVER (PARTITION BY url ORDER BY created_at DESC) AS rn
       FROM request_partitioned
       WHERE lookup_key = ANY($1)
         AND created_at >= NOW() - INTERVAL '30 days'
     ) sampled
     WHERE rn <= $2
     GROUP BY url
     HAVING COUNT(*) FILTER (WHERE status IN ('OK', 'MATCHED_HASH'))::float
          / COUNT(*) >= 0.5`,
    [urls, SAMPLE_SIZE],
  );
  return new Set(rows.map((r: { url: string }) => r.url));
}

/**
 * Probes existing curated feed URLs through the prod fetcher and returns the
 * set of URLs prod can still reach and parse as a feed. Feed-level failures
 * are reported per-URL and excluded (callers disable them); any other error
 * aborts the whole probe so a broken tunnel or API outage can never be
 * mistaken for dead feeds and disable anything.
 */
export async function probeExistingFeeds(
  urls: string[],
  concurrencyLimit: number,
): Promise<Set<string>> {
  const valid = new Set<string>();
  const executing: Promise<void>[] = [];
  let abortError: Error | null = null;

  for (const url of urls) {
    if (abortError) break;
    const promise = (async () => {
      if (abortError) return;
      try {
        const result = await fetchFeedViaProd(url);
        if (result.kind === "feed-failure") {
          console.log(`  FAIL (${describeFeedFailure(result)}): ${url}`);
          return;
        }
        if (!isValidFeedXml(result.body)) {
          console.log(`  FAIL (not valid RSS/Atom): ${url}`);
          return;
        }
        valid.add(url);
      } catch (err) {
        abortError ??= err as Error;
      }
    })().then(() => {
      executing.splice(executing.indexOf(promise), 1);
    });
    executing.push(promise);
    if (executing.length >= concurrencyLimit) await Promise.race(executing);
  }
  await Promise.all(executing);

  if (abortError) {
    throw abortError;
  }

  return valid;
}
