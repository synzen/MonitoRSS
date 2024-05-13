import setupLogger from "@monitorss/logger";
import config from "../config/config";

const configValues = config();

export const ENABLE_DEBUG_LOGS = process.env.LOG_LEVEL === "debug";

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues.BACKEND_API_DATADOG_API_KEY as string,
    service: process.env.SERVICE_NAME || "monitorss-web-v2",
  },
  enableDebugLogs: ENABLE_DEBUG_LOGS,
  disableConsole: !!configValues.BACKEND_API_DATADOG_API_KEY,
});

export default logger;
