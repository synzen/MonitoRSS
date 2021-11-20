import setupLogger, { MonitoLogger } from '@monitorss/logger';
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



class Logger {
  logger: MonitoLogger;

  context?: Record<string, any>;

  constructor() {
    this.logger = setupLogger({
      env: process.env.NODE_ENV || 'local',
      datadog: datadogConfig,
      enableDebugLogs: config.logging.enableDebugLogs,
    });
  }

  setContext(context: Record<string, any>) {
    this.context = context;

    return this;
  }

  debug(message: string, data?: Record<string, any>) {
    this.logger.debug(message, {
      ...this.context,
      ...data,
    });
  }

  info(message: string, data?: Record<string, any>) {
    this.logger.info(message, {
      ...this.context,
      ...data,
    });
  }

  warn(message: string, data?: Record<string, any>) {
    this.logger.warn(message, {
      ...this.context,
      ...data,
    });
  }

  error(
    message: string,
    error?: Error | Record<string, any>,
    data?: Record<string, any>,
  ) {
    if (error instanceof Error) {
      this.logger.error(
        message,
        {
          stack: error?.stack?.split('\n'),
          ...this.context,
          ...data,
        });
    } else {
      this.logger.error(
        message, {
          ...this.context,
          ...error,
          ...data,
        });
    }
  }
}

export default Logger;
