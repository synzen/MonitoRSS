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

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const otlpHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: datadogApiKey
    ? {
        apiKey: datadogApiKey,
        service: process.env.SERVICE_NAME || 'monitorss-feed-requests-service',
      }
    : undefined,
  otlp:
    otlpEndpoint && otlpHeaders
      ? {
          endpoint: otlpEndpoint,
          headers: otlpHeaders,
          service:
            process.env.OTEL_SERVICE_NAME ||
            process.env.SERVICE_NAME ||
            'monitorss-feed-requests-service',
        }
      : undefined,
  enableDebugLogs: process.env.LOG_LEVEL === 'debug',
  disableConsole: !!datadogApiKey,
});

export default logger;
