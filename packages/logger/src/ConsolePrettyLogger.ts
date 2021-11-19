import winston from 'winston';
import { AbstractLogger, LoggerOptions } from './AbstractLogger';

interface ConsoleJSONLoggerOptions extends LoggerOptions {}

export default class ConsolePrettyLogger extends AbstractLogger<ConsoleJSONLoggerOptions> {
  protected createLogger() {
    return winston.createLogger({
      transports: [
        new winston.transports.Console(),
      ],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({
          level, message, timestamp, ...rest
        }) => {

          const stringifiedRest = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';

          return `${timestamp} ${level}: ${message}${stringifiedRest}`;
        }),
      ),
      // silent: !this.shouldLog,
      exitOnError: false,
    });
  }
}
