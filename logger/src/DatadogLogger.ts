import { AbstractLogger, LoggerOptions } from './AbstractLogger';
import winston from 'winston';

interface DatadogLoggerOptions extends LoggerOptions {
  /**
   * Datadog API key credential.
   */
  apiKey: string,
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

export default class DatadogLogger extends AbstractLogger<DatadogLoggerOptions> {
  protected createLogger(options: DatadogLoggerOptions) {
    const { service, apiKey } = options;
    const source = options.source || 'nodejs';

    // https://docs.datadoghq.com/logs/log_collection/nodejs/?tab=winston30
    const httpTransport = new winston.transports.Http({
      host: 'http-intake.logs.datadoghq.com',
      path: `/api/v2/logs?dd-api-key=${apiKey}&ddsource=${source}&service=${service}`,
      ssl: true,
    });

    return winston.createLogger({
      exitOnError: false,
      silent: !this.shouldLog,
      format: winston.format.json(),
      transports: [
        httpTransport,
      ],
      exceptionHandlers: [
        new winston.transports.Console(),
      ],
    });
  }
}
