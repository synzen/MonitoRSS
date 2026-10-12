import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { fetchFeed, fetchFeedForDeliveryPreview } from "./feed-fetcher";
import { FeedResponseRequestStatus } from "./types";

const serviceHost = "http://feed-requests:8000";

describe("feed-fetcher request bodies", () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl: string | undefined;
  let capturedBody: string | undefined;

  beforeEach(() => {
    capturedUrl = undefined;
    capturedBody = undefined;

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      capturedUrl = input.toString();
      capturedBody = init?.body as string;

      return new Response(
        JSON.stringify({
          requestStatus: FeedResponseRequestStatus.Success,
          response: {
            statusCode: 200,
            body: "<rss></rss>",
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

  it("fetchFeed forwards lookup details headers to feed requests", async () => {
    await fetchFeed("https://oauth.reddit.com/r/test/.rss", {
      serviceHost,
      lookupDetails: {
        key: "lookup-key",
        url: "https://oauth.reddit.com/r/test/.rss",
        headers: { Authorization: "Bearer token" },
      },
    });

    const body = JSON.parse(capturedBody as string);

    assert.deepEqual(body.lookupDetails, {
      key: "lookup-key",
      url: "https://oauth.reddit.com/r/test/.rss",
      headers: { Authorization: "Bearer token" },
    });
  });

  it("fetchFeedForDeliveryPreview forwards lookup details headers to feed requests", async () => {
    await fetchFeedForDeliveryPreview("https://oauth.reddit.com/r/test/.rss", {
      serviceHost,
      stalenessThresholdSeconds: 120,
      lookupDetails: {
        key: "lookup-key",
        url: "https://oauth.reddit.com/r/test/.rss",
        headers: { Authorization: "Bearer token" },
      },
    });

    assert.ok(capturedUrl?.endsWith("/delivery-preview"));

    const body = JSON.parse(capturedBody as string);

    assert.equal(body.lookupKey, "lookup-key");
    assert.deepEqual(body.headers, { Authorization: "Bearer token" });
  });
});
