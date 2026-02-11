import setupLogger from "@monitorss/logger";

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
  datadog: {
    service: process.env.SERVICE_NAME || "bot-presence",
    apiKey: process.env.BOT_PRESENCE_DATADOG_API_KEY || undefined,
  },
  disableConsole: !!process.env.BOT_PRESENCE_DATADOG_API_KEY,
});

export default logger;
