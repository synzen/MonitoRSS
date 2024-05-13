import ConsoleJSONLogger from './ConsoleJSONLogger';
import ConsolePrettyLogger from './ConsolePrettyLogger';
import DatadogLogger from './DatadogLogger';
import { InternalCommonLoggerLogLevel } from './types/InternalCommonLogger.interface';

type LoggerType = DatadogLogger | ConsoleJSONLogger | ConsolePrettyLogger;

interface Loggers {
  debug: LoggerType[]
  info: LoggerType[]
  warn: LoggerType[]
  error: LoggerType[]
  datadog: LoggerType[]
}

const setLoggingTransports = (loggers: Loggers) => {

  const createArrayLoggers = (
    level: InternalCommonLoggerLogLevel,
    loggerArr: LoggerType[],
  ) => (message: string, meta?: Record<string, any>) => {
    loggerArr.forEach(logger => logger.log(level, {
      message,
      ...meta,
    }));
  };

  return {
    /**
     * Used for pinpointing issues in a local environment.
     */
    debug: createArrayLoggers('debug', loggers.debug),
    /**
     * Used in situations where it might be useful for non-critical later analysis or debugging.
     * Should not be used for situations where business functions.
     */
    info: createArrayLoggers('info', loggers.info),
    /**
     * Used in situations that are unexpected, but the code can continue the work.
     */
    warn: createArrayLoggers('warn', loggers.warn),
    /**
     * Used in situations where business functionality is not working as expected.
     */
    error: createArrayLoggers('error', loggers.error),
    /**
     * When we only want to send data to Datadog.
     */
    datadog: createArrayLoggers('info', loggers.datadog),
  };
};

interface Config {
  /**
   * Whether to show debug logs in console. These logs have the potential to be verbose.
   */
  enableDebugLogs?: boolean
  /**
   * The Node.js environment (typically process.env.NODE_ENV)
   */
  env: string,
  disableConsole?: boolean
  /**
   * Datadog configuration variables. If undefined, datadog logging will be disabled.
   */
  datadog?: {
    /**
     * Datadog API key credential.
     */
    apiKey: string
    /**
     * The name of the application or service generating the log events. It is used to switch from
     * Logs to APM, so make sure you define the same value when you use both products
     * 
     * https://docs.datadoghq.com/api/latest/logs/
     */
    service: string
    /**
     * The integration name associated with your log: the technology from which the log originated.
     * When it matches an integration name, Datadog automatically installs the corresponding
     * parsers and facets.
     * 
     * https://docs.datadoghq.com/api/latest/logs/
     */
    source?: string
  }
}

const setupLogger = (config: Config) => {
  const consoleLogger = new ConsolePrettyLogger({});  

  const debugTransports: LoggerType[] = config.enableDebugLogs
    ? [consoleLogger]
    : [];
  const infoTransports: LoggerType[] = config.disableConsole ? [] : [
    consoleLogger,
  ];
  const warnTransports: LoggerType[] = config.disableConsole ? [] : [
    consoleLogger,
  ];
  const errorTransports: LoggerType[] = config.disableConsole ? [] : [
    consoleLogger,
  ];
  const datadogTransports: LoggerType[] = [];

  if (config.datadog) {
    const datadogLogger = new DatadogLogger({
      env: config.env,
      apiKey: config.datadog.apiKey,
      service: config.datadog.service,
      source: config.datadog.source || 'nodejs',
      useInEnvs: ['production'],
    });
    infoTransports.push(datadogLogger);
    warnTransports.push(datadogLogger);
    errorTransports.push(datadogLogger);
    datadogTransports.push(datadogLogger);
  }

  const logger = setLoggingTransports({
    debug: debugTransports,
    info: infoTransports,
    warn: warnTransports,
    error: errorTransports,
    datadog: datadogTransports,
  });

  return logger;
};

export type MonitoLogger = ReturnType<typeof setupLogger>;

export default setupLogger;
