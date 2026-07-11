import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";

import { fetchFeedViaProd, ProdFetchAbortError } from "./prod-fetch";

interface StubCall {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
}

let server: http.Server | undefined;

async function startStubServer(
  handler: (res: http.ServerResponse) => void,
): Promise<{ calls: StubCall[] }> {
  const calls: StubCall[] = [];

  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk;
    });
    req.on("end", () => {
      calls.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: raw ? JSON.parse(raw) : {},
      });
      handler(res);
    });
  });

  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server!.address() as AddressInfo;
  process.env.FEED_REQUESTS_API_URL = `http://127.0.0.1:${port}`;
  process.env.FEED_REQUESTS_API_KEY = "test-api-key";

  return { calls };
}

function respondJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;
  }
  delete process.env.FEED_REQUESTS_API_URL;
  delete process.env.FEED_REQUESTS_API_KEY;
});

test("sends a stale-aware probe with the api key and no header overrides, returning the body on SUCCESS", async () => {
  const { calls } = await startStubServer((res) =>
    respondJson(res, 200, {
      requestStatus: "SUCCESS",
      response: { body: "<rss></rss>", statusCode: 200, hash: "abc" },
    }),
  );

  const result = await fetchFeedViaProd("https://example.com/feed.xml");

  assert.deepEqual(result, { kind: "success", body: "<rss></rss>" });

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.method, "POST");
  assert.equal(call.url, "/v1/feed-requests");
  assert.equal(call.headers["api-key"], "test-api-key");
  assert.equal(call.body.url, "https://example.com/feed.xml");
  assert.equal(call.body.executeFetchIfStale, true);
  assert.ok(!("executeFetch" in call.body), "must not force a fresh fetch");
  assert.ok(
    !("lookupDetails" in call.body),
    "must not send header overrides — probes use prod's default user agent",
  );
});

test("a trailing slash in the API URL override still reaches the endpoint", async () => {
  const { calls } = await startStubServer((res) =>
    respondJson(res, 200, {
      requestStatus: "SUCCESS",
      response: { body: "<rss></rss>", statusCode: 200 },
    }),
  );
  process.env.FEED_REQUESTS_API_URL = `${process.env.FEED_REQUESTS_API_URL}/`;

  await fetchFeedViaProd("https://example.com/feed.xml");

  assert.equal(calls[0].url, "/v1/feed-requests");
});

test("SUCCESS without a body aborts rather than masquerading as an empty feed", async () => {
  await startStubServer((res) =>
    respondJson(res, 200, {
      requestStatus: "SUCCESS",
      response: { statusCode: 200 },
    }),
  );

  await assert.rejects(
    fetchFeedViaProd("https://example.com/feed.xml"),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      return true;
    },
  );
});

test("PARSE_ERROR is a feed-level failure carrying the prod status", async () => {
  await startStubServer((res) =>
    respondJson(res, 200, {
      requestStatus: "PARSE_ERROR",
      response: { statusCode: 200 },
    }),
  );

  const result = await fetchFeedViaProd("https://example.com/feed.xml");

  assert.deepEqual(result, {
    kind: "feed-failure",
    prodStatus: "PARSE_ERROR",
    statusCode: 200,
  });
});

test("BAD_STATUS_CODE is a feed-level failure carrying the upstream status code", async () => {
  await startStubServer((res) =>
    respondJson(res, 200, {
      requestStatus: "BAD_STATUS_CODE",
      response: { statusCode: 404 },
    }),
  );

  const result = await fetchFeedViaProd("https://example.com/feed.xml");

  assert.deepEqual(result, {
    kind: "feed-failure",
    prodStatus: "BAD_STATUS_CODE",
    statusCode: 404,
  });
});

for (const prodStatus of [
  "FETCH_TIMEOUT",
  "FETCH_ERROR",
  "INVALID_SSL_CERTIFICATE",
  "REFUSED_LARGE_FEED",
]) {
  test(`${prodStatus} is a feed-level failure carrying the prod status`, async () => {
    await startStubServer((res) => respondJson(res, 200, { requestStatus: prodStatus }));

    const result = await fetchFeedViaProd("https://example.com/feed.xml");

    assert.deepEqual(result, { kind: "feed-failure", prodStatus });
  });
}

test("connection refused aborts the run with the distinct infra error, not a feed failure", async () => {
  await startStubServer((res) => respondJson(res, 200, {}));
  const unreachableUrl = process.env.FEED_REQUESTS_API_URL;
  await new Promise((resolve) => server!.close(resolve));
  server = undefined;
  process.env.FEED_REQUESTS_API_URL = unreachableUrl;

  await assert.rejects(
    fetchFeedViaProd("https://example.com/feed.xml"),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      return true;
    },
  );
});

for (const httpStatus of [401, 403]) {
  test(`API auth rejection (${httpStatus}) aborts the run with the infra error`, async () => {
    await startStubServer((res) =>
      respondJson(res, httpStatus, { statusCode: httpStatus, message: "Forbidden" }),
    );

    await assert.rejects(
      fetchFeedViaProd("https://example.com/feed.xml"),
      (err: unknown) => {
        assert.ok(err instanceof ProdFetchAbortError);
        assert.match((err as Error).message, new RegExp(String(httpStatus)));
        return true;
      },
    );
  });
}

test("API 5xx aborts the run with the infra error", async () => {
  await startStubServer((res) =>
    respondJson(res, 500, { statusCode: 500, message: "Internal server error" }),
  );

  await assert.rejects(
    fetchFeedViaProd("https://example.com/feed.xml"),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      assert.match((err as Error).message, /500/);
      return true;
    },
  );
});

test("INTERNAL_ERROR from the service aborts the run with the infra error", async () => {
  await startStubServer((res) =>
    respondJson(res, 200, { requestStatus: "INTERNAL_ERROR" }),
  );

  await assert.rejects(
    fetchFeedViaProd("https://example.com/feed.xml"),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      return true;
    },
  );
});

test("an unexpected status like MATCHED_HASH aborts the run with the infra error", async () => {
  await startStubServer((res) =>
    respondJson(res, 200, { requestStatus: "MATCHED_HASH" }),
  );

  await assert.rejects(
    fetchFeedViaProd("https://example.com/feed.xml"),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      assert.match((err as Error).message, /MATCHED_HASH/);
      return true;
    },
  );
});

test("missing env vars abort with a clear message before any request is made", async () => {
  delete process.env.FEED_REQUESTS_API_URL;
  delete process.env.FEED_REQUESTS_API_KEY;

  await assert.rejects(
    fetchFeedViaProd("https://example.com/feed.xml"),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      assert.match((err as Error).message, /FEED_REQUESTS_API_URL/);
      return true;
    },
  );
});
