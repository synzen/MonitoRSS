import winston from 'winston';
import { AbstractLogger, LoggerOptions } from './AbstractLogger';

interface ConsoleJSONLoggerOptions extends LoggerOptions {}

export default class ConsoleJSONLogger extends AbstractLogger<ConsoleJSONLoggerOptions> {
  protected createLogger() {
    return winston.createLogger({
      transports: [
        new winston.transports.Console(),
      ],
      silent: !this.shouldLog,
      exitOnError: false,
    });
  }
}
