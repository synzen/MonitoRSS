import setupLogger from "@monitorss/logger";

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
});

export default logger;
