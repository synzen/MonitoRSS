import { createServer } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import { URL } from "url";
import { MOCK_RSS_SERVER_PORT } from "./helpers/constants";

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

server.listen(MOCK_RSS_SERVER_PORT, () =>
  console.log(`Mock RSS server on http://localhost:${MOCK_RSS_SERVER_PORT}`),
);
