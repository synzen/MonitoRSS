import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";

import { probeExistingFeeds } from "./disable-probe";
import { ProdFetchAbortError } from "./prod-fetch";

let server: http.Server | undefined;

async function startStubServer(
  handler: (probedUrl: string, res: http.ServerResponse) => void,
): Promise<void> {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk;
    });
    req.on("end", () => {
      const body = JSON.parse(raw) as { url: string };
      handler(body.url, res);
    });
  });

  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server!.address() as AddressInfo;
  process.env.FEED_REQUESTS_API_URL = `http://127.0.0.1:${port}`;
  process.env.FEED_REQUESTS_API_KEY = "test-api-key";
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

test("feeds whose prod probe returns a valid feed body are kept", async () => {
  await startStubServer((url, res) =>
    respondJson(res, 200, {
      requestStatus: "SUCCESS",
      response: { body: `<rss><channel><title>${url}</title></channel></rss>` },
    }),
  );

  const valid = await probeExistingFeeds(
    ["https://a.example/feed.xml", "https://b.example/feed.xml"],
    2,
  );

  assert.deepEqual(
    valid,
    new Set(["https://a.example/feed.xml", "https://b.example/feed.xml"]),
  );
});

test("a feed-level prod failure keeps its disable meaning while healthy feeds are kept", async () => {
  await startStubServer((url, res) => {
    if (url === "https://dead.example/feed.xml") {
      respondJson(res, 200, {
        requestStatus: "BAD_STATUS_CODE",
        response: { statusCode: 404 },
      });
    } else {
      respondJson(res, 200, {
        requestStatus: "SUCCESS",
        response: { body: "<rss><channel></channel></rss>" },
      });
    }
  });

  const valid = await probeExistingFeeds(
    ["https://ok.example/feed.xml", "https://dead.example/feed.xml"],
    2,
  );

  assert.deepEqual(valid, new Set(["https://ok.example/feed.xml"]));
});

test("PARSE_ERROR from prod keeps its disable meaning", async () => {
  await startStubServer((url, res) =>
    respondJson(res, 200, { requestStatus: "PARSE_ERROR" }),
  );

  const valid = await probeExistingFeeds(["https://notafeed.example"], 1);

  assert.deepEqual(valid, new Set());
});

test("a SUCCESS body that is not feed XML keeps its disable meaning", async () => {
  await startStubServer((url, res) =>
    respondJson(res, 200, {
      requestStatus: "SUCCESS",
      response: { body: "<html><body>parked domain</body></html>" },
    }),
  );

  const valid = await probeExistingFeeds(["https://parked.example/feed"], 1);

  assert.deepEqual(valid, new Set());
});

test("an infra error mid-batch aborts the probe — no feed set escapes to drive disables", async () => {
  await startStubServer((url, res) => {
    if (url === "https://second.example/feed.xml") {
      respondJson(res, 500, { message: "Internal server error" });
    } else {
      respondJson(res, 200, {
        requestStatus: "SUCCESS",
        response: { body: "<rss><channel></channel></rss>" },
      });
    }
  });

  await assert.rejects(
    probeExistingFeeds(
      [
        "https://first.example/feed.xml",
        "https://second.example/feed.xml",
        "https://third.example/feed.xml",
      ],
      1,
    ),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      return true;
    },
  );
});

test("an unreachable feed-requests API aborts rather than reading as dead feeds", async () => {
  await startStubServer((url, res) => respondJson(res, 200, {}));
  const unreachableUrl = process.env.FEED_REQUESTS_API_URL;
  await new Promise((resolve) => server!.close(resolve));
  server = undefined;
  process.env.FEED_REQUESTS_API_URL = unreachableUrl;

  await assert.rejects(
    probeExistingFeeds(["https://a.example/feed.xml"], 1),
    (err: unknown) => {
      assert.ok(err instanceof ProdFetchAbortError);
      return true;
    },
  );
});
