import { createServer } from "http";
import { URL } from "url";
import { MOCK_REDDIT_SERVER_PORT } from "./helpers/constants";
import { teeConsoleToFile } from "./helpers/log-to-file";

teeConsoleToFile("mock-reddit");

// Stands in for BOTH reddit hosts the backend talks to:
//   - www.reddit.com/api/v1/* (OAuth: authorize, access_token, revoke_token)
//   - oauth.reddit.com/r/*    (authenticated feed fetches with a Bearer token)
//
// Like the mock Discord server, the authorize endpoint skips the consent screen:
// it mints a code and immediately 302s back to redirect_uri with the state echoed
// byte-for-byte (the backend validates state against its session-stored nonce).
// Tokens are tracked so revocation has real consequences: a revoked refresh token
// fails the refresh grant with 400 (what the backend maps to "app revoked"), and
// its access tokens stop authenticating feed fetches.

let grantCounter = 0;

const activeAccessTokens = new Set<string>();
// refresh token -> access tokens minted under it (so revoke kills them all)
const refreshGrants = new Map<string, Set<string>>();
const revokedRefreshTokens = new Set<string>();

function mintGrant(): { accessToken: string; refreshToken: string } {
  grantCounter += 1;
  const accessToken = `mock-reddit-access-${grantCounter}`;
  const refreshToken = `mock-reddit-refresh-${grantCounter}`;
  activeAccessTokens.add(accessToken);
  refreshGrants.set(refreshToken, new Set([accessToken]));
  return { accessToken, refreshToken };
}

function parseForm(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

function json(
  res: import("http").ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function subredditRss(pathname: string): string {
  const subreddit = pathname.match(/^\/r\/([^/]+)/)?.[1] ?? "unknown";
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>r/${subreddit}</title>
    <link>https://www.reddit.com/r/${subreddit}/</link>
    <description>Mock subreddit feed for E2E tests</description>
    <item>
      <title>${subreddit} post one</title>
      <link>https://www.reddit.com/r/${subreddit}/comments/1/post-one/</link>
      <description>First mock post in r/${subreddit}</description>
      <pubDate>Thu, 04 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>${subreddit} post two</title>
      <link>https://www.reddit.com/r/${subreddit}/comments/2/post-two/</link>
      <description>Second mock post in r/${subreddit}</description>
      <pubDate>Wed, 03 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
}

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));

  req.on("end", () => {
    const url = new URL(
      req.url || "/",
      `http://localhost:${MOCK_REDDIT_SERVER_PORT}`,
    );
    const method = req.method || "GET";
    const rawBody = Buffer.concat(chunks).toString();

    // Log every request: this is the audit trail proving reddit traffic (OAuth AND
    // authenticated feed fetches) hit the mock rather than reddit.com.
    const auth = req.headers.authorization;
    const authSummary = !auth
      ? "none"
      : auth.startsWith("Bearer ")
        ? `bearer=${auth.slice(7)}`
        : "basic";
    console.log(`[mock-reddit] ${method} ${url.pathname} auth=${authSummary}`);

    if (method === "GET" && url.pathname === "/api/v1/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");

      if (!redirectUri) {
        return json(res, 400, { error: "missing redirect_uri" });
      }

      grantCounter += 1;
      const location = new URL(redirectUri);
      location.searchParams.set("code", `mock-reddit-code-${grantCounter}`);
      if (state !== null) {
        location.searchParams.set("state", state);
      }

      res.writeHead(302, { Location: location.toString() });
      return res.end();
    }

    if (method === "POST" && url.pathname === "/api/v1/access_token") {
      if (!req.headers.authorization?.startsWith("Basic ")) {
        return json(res, 401, { error: "missing basic auth" });
      }

      const form = parseForm(rawBody);

      if (form.grant_type === "authorization_code") {
        if (!/^mock-reddit-code-\d+$/.test(form.code ?? "")) {
          return json(res, 400, { error: "invalid_grant" });
        }

        const { accessToken, refreshToken } = mintGrant();
        return json(res, 200, {
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: refreshToken,
          scope: "read",
        });
      }

      if (form.grant_type === "refresh_token") {
        const refreshToken = form.refresh_token ?? "";
        const grant = refreshGrants.get(refreshToken);

        // Reddit responds 400 to refresh attempts on a revoked/unknown grant;
        // the backend maps that to RedditAppRevokedException.
        if (!grant || revokedRefreshTokens.has(refreshToken)) {
          return json(res, 400, { error: "invalid_grant" });
        }

        grantCounter += 1;
        const accessToken = `mock-reddit-access-${grantCounter}`;
        activeAccessTokens.add(accessToken);
        grant.add(accessToken);
        return json(res, 200, {
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: refreshToken,
          scope: "read",
        });
      }

      return json(res, 400, { error: "unsupported_grant_type" });
    }

    if (method === "POST" && url.pathname === "/api/v1/revoke_token") {
      const form = parseForm(rawBody);
      const token = form.token ?? "";

      revokedRefreshTokens.add(token);
      for (const accessToken of refreshGrants.get(token) ?? []) {
        activeAccessTokens.delete(accessToken);
      }

      res.writeHead(204);
      return res.end();
    }

    // oauth.reddit.com stand-in: authenticated subreddit feed fetches.
    if (method === "GET" && url.pathname.startsWith("/r/")) {
      const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];

      if (!bearer || !activeAccessTokens.has(bearer)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }

      res.writeHead(200, { "Content-Type": "application/rss+xml" });
      return res.end(subredditRss(url.pathname));
    }

    console.error(`[mock-reddit] Unmatched: ${method} ${url.pathname}`);
    return json(res, 404, { error: "not found (mock)" });
  });
});

server.listen(MOCK_REDDIT_SERVER_PORT, () =>
  console.log(
    `Mock Reddit server on http://localhost:${MOCK_REDDIT_SERVER_PORT}`,
  ),
);
