import setupLogger from "@monitorss/logger";
import { config } from "../../config";
import { EnvironmentVariables } from "../../config/validate";

const configValues =
  process.env.NODE_ENV === "test" ? ({} as EnvironmentVariables) : config();

const datadogApiKey = configValues.USER_FEEDS_DATADOG_API_KEY as string;

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: datadogApiKey
    ? {
        apiKey: datadogApiKey,
        service: "monitorss-user-feeds-service",
      }
    : undefined,
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
  disableConsole: !!datadogApiKey,
});

export default logger;
