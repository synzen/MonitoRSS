import setupLogger from "@monitorss/logger";

const datadogApiKey = process.env.BACKEND_API_DATADOG_API_KEY;

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: datadogApiKey
    ? {
        apiKey: datadogApiKey,
        service: "monitorss-backend-api-next",
      }
    : undefined,
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
  disableConsole: !!datadogApiKey,
});

export default logger;
