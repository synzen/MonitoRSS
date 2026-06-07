export const MOCK_RSS_SERVER_PORT =
  Number(process.env.E2E_MOCK_RSS_PORT) || 3001;
export const MOCK_RSS_HOST = "host.docker.internal";
export const MOCK_RSS_FEED_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed.xml?v=${Date.now()}`;
export const MOCK_RSS_FEED_500_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed-500?v=${Date.now()}`;
export const MOCK_RSS_FEED_403_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed-403?v=${Date.now()}`;
export const MOCK_RSS_FEED_404_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed-404?v=${Date.now()}`;
export const MOCK_RSS_HTML_PAGE_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/html-with-feed?v=${Date.now()}`;

export const FRONTEND_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
// Default host 27019 matches docker-compose.e2e.yml's mongo mapping, kept distinct
// from the dev stack's 27018 so both stacks can run at once; parameterized so
// concurrent e2e runs can each bind a distinct host port.
export const MONGO_URI = `mongodb://127.0.0.1:${process.env.E2E_MONGO_PORT || 27019}/rss`;
export const MOCK_DISCORD_SERVER_PORT =
  Number(process.env.E2E_MOCK_DISCORD_PORT) || 3002;

// The mock mailer listens for plain SMTP on one port and exposes captured
// messages over HTTP on another (the HTTP port doubles as Playwright's readiness
// probe, since it can't health-check a raw SMTP socket). The backend (in Docker)
// reaches the SMTP port via host.docker.internal.
export const MOCK_SMTP_SERVER_PORT =
  Number(process.env.E2E_MOCK_SMTP_PORT) || 3004;
export const MOCK_SMTP_HTTP_PORT =
  Number(process.env.E2E_MOCK_SMTP_HTTP_PORT) || 3005;
export const MOCK_SMTP_HOST = "host.docker.internal";
