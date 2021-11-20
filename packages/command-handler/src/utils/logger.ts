import setupLogger from '@monitorss/logger';
import config from '../config';

let datadogConfig: {
  apiKey: string;
  service: string
} | undefined = undefined;

if (config.logging.datadog.apiKey) {
  datadogConfig = {
    apiKey: config.logging.datadog.apiKey,
    service: config.logging.datadog.service,
  };
} else {
  console.warn('Datadog logger is not set');
}

const internalLogger = setupLogger({
  env: process.env.NODE_ENV || 'local',
  datadog: datadogConfig,
  enableDebugLogs: config.logging.enableDebugLogs,
});

const logger = {
  debug: (message: string, data?: Record<string, any>) => internalLogger.debug(message, data),
  info: (message: string, data?: Record<string, any>) => internalLogger.info(message, data),
  warn: (message: string, data?: Record<string, any>) => internalLogger.warn(message, data),
  error: (
    message: string,
    error?: Error | Record<string, any>,
    data?: Record<string, any>,
  ) => {
    if (error instanceof Error) {
      internalLogger.error(
        message,
        {
          stack: error?.stack?.split('\n'),
          ...data,
        });
    } else {
      internalLogger.error(
        message, {
          ...error,
          ...data,
        });
    }
  }, 
};

export default logger;
