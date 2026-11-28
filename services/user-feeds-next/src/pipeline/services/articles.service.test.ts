import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { findOrFetchFeedArticles } from "./articles.service";
import { FeedResponseRequestStatus } from "../../feed-fetcher";
import type { ParsedArticlesCacheStore } from "../../stores/interfaces/parsed-articles-cache";

const feedRequestsServiceHost = "http://feed-requests:8000";

const stubCacheStore = (): ParsedArticlesCacheStore =>
  ({
    exists: async () => false,
    get: async () => null,
    set: async () => undefined,
  }) as never;

describe("findOrFetchFeedArticles URL passthrough", () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: string | undefined;

  beforeEach(() => {
    capturedBody = undefined;

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      capturedBody = init?.body as string;

      return new Response(
        JSON.stringify({
          requestStatus: FeedResponseRequestStatus.Success,
          response: {
            statusCode: 200,
            body: `<rss><channel><title>t</title>
              <item><guid>g1</guid><title>Post</title><link>https://example.com/1</link></item>
            </channel></rss>`,
            hash: "hash",
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("passes reddit destination URLs through unchanged for feed-requests to route", async () => {
    await findOrFetchFeedArticles("https://www.reddit.com/r/javascript", {
      feedRequestsServiceHost,
      parsedArticlesCacheStore: stubCacheStore(),
    });

    const body = JSON.parse(capturedBody as string);

    assert.strictEqual(body.url, "https://www.reddit.com/r/javascript");
  });

  it("passes legacy reddit RSS URLs through unchanged", async () => {
    const legacyUrl = "https://www.reddit.com/r/javascript.rss";

    await findOrFetchFeedArticles(legacyUrl, {
      feedRequestsServiceHost,
      parsedArticlesCacheStore: stubCacheStore(),
    });

    const body = JSON.parse(capturedBody as string);

    assert.strictEqual(body.url, legacyUrl);
  });

  it("passes non-reddit URLs through unchanged", async () => {
    const feedUrl = "https://example.com/feed.xml";

    await findOrFetchFeedArticles(feedUrl, {
      feedRequestsServiceHost,
      parsedArticlesCacheStore: stubCacheStore(),
    });

    const body = JSON.parse(capturedBody as string);

    assert.strictEqual(body.url, feedUrl);
  });
});
