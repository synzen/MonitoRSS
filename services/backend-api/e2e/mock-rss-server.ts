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
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(MOCK_RSS_SERVER_PORT, () =>
  console.log(`Mock RSS server on http://localhost:${MOCK_RSS_SERVER_PORT}`),
);
