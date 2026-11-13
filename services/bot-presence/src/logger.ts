import setupLogger from "@monitorss/logger";

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const otlpHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
  datadog: {
    service: process.env.SERVICE_NAME || "bot-presence",
    apiKey: process.env.BOT_PRESENCE_DATADOG_API_KEY || undefined,
  },
  otlp:
    otlpEndpoint && otlpHeaders
      ? {
          endpoint: otlpEndpoint,
          headers: otlpHeaders,
          service:
            process.env.OTEL_SERVICE_NAME ||
            process.env.SERVICE_NAME ||
            "bot-presence",
        }
      : undefined,
  disableConsole: !!process.env.BOT_PRESENCE_DATADOG_API_KEY,
});

export default logger;
