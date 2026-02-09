import { join } from "path";

export const MOCK_RSS_SERVER_PORT = 3001;
export const MOCK_RSS_HOST = "host.docker.internal";
export const MOCK_RSS_FEED_URL = `http://${MOCK_RSS_HOST}:${MOCK_RSS_SERVER_PORT}/feed.xml`;
export const AUTH_STATE_PATH = join(process.cwd(), "e2e", "auth.json");
