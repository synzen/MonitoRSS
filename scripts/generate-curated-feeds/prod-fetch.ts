/**
 * All feed probes go through the production feed-requests service so that
 * validation and disable decisions reflect exactly what prod polling will
 * experience (egress IP, user agent, TLS stack, rate limiting). There is
 * deliberately no local-fetch fallback.
 */

const FEED_LEVEL_FAILURE_STATUSES = [
  "PARSE_ERROR",
  "BAD_STATUS_CODE",
  "FETCH_TIMEOUT",
  "FETCH_ERROR",
  "INVALID_SSL_CERTIFICATE",
  "REFUSED_LARGE_FEED",
] as const;

export type FeedFailureStatus = (typeof FEED_LEVEL_FAILURE_STATUSES)[number];

export type ProdFetchResult =
  | { kind: "success"; body: string }
  | { kind: "feed-failure"; prodStatus: FeedFailureStatus; statusCode?: number };

/**
 * The feed-requests API itself failed (unreachable, auth rejected, 5xx,
 * internal error). The run must abort: this must never be treated as a
 * dead feed.
 */
export class ProdFetchAbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProdFetchAbortError";
  }
}

export async function fetchFeedViaProd(url: string): Promise<ProdFetchResult> {
  const apiUrl = process.env.FEED_REQUESTS_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.FEED_REQUESTS_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new ProdFetchAbortError(
      "FEED_REQUESTS_API_URL and FEED_REQUESTS_API_KEY must be set to reach the feed-requests API",
    );
  }

  let response: Response;

  try {
    response = await fetch(`${apiUrl}/v1/feed-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({ url, executeFetchIfStale: true }),
    });
  } catch (err) {
    // undici wraps the real network error (e.g. ECONNREFUSED) in `cause`
    const { cause, message } = err as Error & { cause?: unknown };
    throw new ProdFetchAbortError(
      `Failed to reach the feed-requests API at ${apiUrl}: ${cause ?? message}`,
    );
  }

  if (!response.ok) {
    throw new ProdFetchAbortError(
      `feed-requests API responded with HTTP ${response.status} while probing ${url}`,
    );
  }

  let data: {
    requestStatus: string;
    response?: { body?: string; statusCode?: number };
  };

  try {
    data = (await response.json()) as typeof data;
  } catch (err) {
    throw new ProdFetchAbortError(
      `feed-requests API returned a non-JSON response while probing ${url}: ${(err as Error).message}`,
    );
  }

  if (data.requestStatus === "SUCCESS") {
    if (typeof data.response?.body !== "string") {
      throw new ProdFetchAbortError(
        `feed-requests API returned SUCCESS without a body while probing ${url}`,
      );
    }

    return { kind: "success", body: data.response.body };
  }

  const prodStatus = FEED_LEVEL_FAILURE_STATUSES.find(
    (status) => status === data.requestStatus,
  );

  if (prodStatus) {
    const failure: ProdFetchResult = { kind: "feed-failure", prodStatus };
    if (data.response?.statusCode !== undefined) {
      failure.statusCode = data.response.statusCode;
    }
    return failure;
  }

  throw new ProdFetchAbortError(
    `Unexpected feed-requests status "${data.requestStatus}" for ${url}`,
  );
}
