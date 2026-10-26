import setupLogger from '@monitorss/logger';
import { loadConfig } from '../config';

// The logger is imported by scripts (e.g. run-migrations) that may run with a
// partial environment; config validation failures must not break logging.
let datadogApiKey: string | undefined;

if (process.env.NODE_ENV !== 'test') {
  try {
    datadogApiKey = loadConfig().FEED_REQUESTS_DATADOG_API_KEY;
  } catch {
    datadogApiKey = process.env.FEED_REQUESTS_DATADOG_API_KEY;
  }
}

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: datadogApiKey
    ? {
        apiKey: datadogApiKey,
        service: process.env.SERVICE_NAME || 'monitorss-feed-requests-service',
      }
    : undefined,
  enableDebugLogs: process.env.LOG_LEVEL === 'debug',
  disableConsole: !!datadogApiKey,
});

export default logger;
