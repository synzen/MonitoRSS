import setupLogger from "@monitorss/logger";

const datadogApiKey = process.env.USER_FEEDS_DATADOG_API_KEY;
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const otlpHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: datadogApiKey
    ? {
        apiKey: datadogApiKey,
        service: "monitorss-user-feeds-next-service",
      }
    : undefined,
  otlp: otlpEndpoint && otlpHeaders
    ? {
        endpoint: otlpEndpoint,
        headers: otlpHeaders,
        service: process.env.OTEL_SERVICE_NAME || "monitorss-user-feeds-next-service",
      }
    : undefined,
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
  disableConsole: !!datadogApiKey,
});

export default logger;
