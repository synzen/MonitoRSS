export const MOCK_RSS_SERVER_PORT = 3001;
export const MOCK_RSS_HOST = "host.docker.internal";
export const MOCK_RSS_FEED_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed.xml?v=${Date.now()}`;
export const MOCK_RSS_FEED_500_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed-500?v=${Date.now()}`;
export const MOCK_RSS_FEED_403_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed-403?v=${Date.now()}`;
export const MOCK_RSS_FEED_404_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed-404?v=${Date.now()}`;
export const MOCK_RSS_HTML_PAGE_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/html-with-feed?v=${Date.now()}`;

export const FRONTEND_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
export const MONGO_URI = "mongodb://127.0.0.1:27019/rss";
export const MOCK_DISCORD_SERVER_PORT = 3002;
