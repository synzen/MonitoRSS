import { createServer } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import { URL } from "url";
import { MOCK_RSS_SERVER_PORT } from "./helpers/constants";
import { teeConsoleToFile } from "./helpers/log-to-file";

teeConsoleToFile("mock-rss");

// Feeds that must START healthy and LATER fail: a feed cannot be created against a
// failing URL (creation validates it), so specs that need an established-then-broken
// feed create it against /flaky/<key>.xml and then POST /flaky/<key>/<mode> to flip
// that key's response for the rest of the run. Keys are per-spec-generated, so parallel
// workers never interfere with each other's feeds.
type FlakyMode = "ok" | "fail" | "rate-limit";
const flakyModes = new Map<string, FlakyMode>();

// Hours out, not minutes: the Retry-After header has to dominate the retry
// backoff's own tier intervals to be observable in the health-alert timestamp.
const RATE_LIMIT_RETRY_AFTER_SECONDS = 7200;

const server = createServer((req, res) => {
  const parsedUrl = new URL(
    req.url || "/",
    `http://localhost:${MOCK_RSS_SERVER_PORT}`,
  );
  if (parsedUrl.pathname === "/feed.xml") {
    const rss = readFileSync(
      join(__dirname, "fixtures", "test-feed.xml"),
      "utf-8",
    );
    res.writeHead(200, { "Content-Type": "application/rss+xml" });
    res.end(rss);
  } else if (/^\/flaky\/[^/]+\.xml$/.test(parsedUrl.pathname)) {
    const key = parsedUrl.pathname.slice("/flaky/".length, -".xml".length);
    const mode = flakyModes.get(key) ?? "ok";
    if (mode === "fail") {
      res.writeHead(500);
      res.end("Internal Server Error");
    } else if (mode === "rate-limit") {
      res.writeHead(429, { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) });
      res.end("Too Many Requests");
    } else {
      const rss = readFileSync(
        join(__dirname, "fixtures", "test-feed.xml"),
        "utf-8",
      );
      res.writeHead(200, { "Content-Type": "application/rss+xml" });
      res.end(rss);
    }
  } else if (
    req.method === "POST" &&
    /^\/flaky\/[^/]+\/(fail|ok|rate-limit)$/.test(parsedUrl.pathname)
  ) {
    // /flaky/<key>/<mode> — the leading slash yields an empty first segment.
    const [, , key, mode] = parsedUrl.pathname.split("/");
    flakyModes.set(key, mode as FlakyMode);
    res.writeHead(200);
    res.end("OK");
  } else if (parsedUrl.pathname === "/feed-500") {
    res.writeHead(500);
    res.end("Internal Server Error");
  } else if (parsedUrl.pathname === "/feed-403") {
    res.writeHead(403);
    res.end("Forbidden");
  } else if (parsedUrl.pathname === "/feed-404") {
    res.writeHead(404);
    res.end("Not Found");
  } else if (parsedUrl.pathname === "/html-with-feed") {
    const resolvedFeedUrl = `http://${req.headers.host}/resolved-feed.xml`;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>HTML Page With Feed</title>
  <link rel="alternate" type="application/rss+xml" title="Resolved Test Feed" href="${resolvedFeedUrl}" />
</head>
<body><p>This page links to an RSS feed.</p></body>
</html>`);
  } else if (parsedUrl.pathname === "/resolved-feed.xml") {
    res.writeHead(200, { "Content-Type": "application/rss+xml" });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Resolved Test Feed</title>
    <link>http://example.com</link>
    <description>A test feed discovered via HTML link</description>
    <item>
      <title>Resolved Article One</title>
      <link>http://example.com/resolved-1</link>
      <description>First article in the resolved feed</description>
    </item>
  </channel>
</rss>`);
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(MOCK_RSS_SERVER_PORT, "0.0.0.0", () =>
  console.log(`Mock RSS server on http://localhost:${MOCK_RSS_SERVER_PORT}`),
);
