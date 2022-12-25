import setupLogger from "@monitorss/logger";
import { config } from "../../config";
import { EnvironmentVariables } from "../../config/validate";

const configValues =
  process.env.NODE_ENV === "test" ? ({} as EnvironmentVariables) : config();

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues.USER_FEEDS_DATADOG_API_KEY as string,
    service: "monitorss-user-feeds-service",
  },
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
});

export default logger;
