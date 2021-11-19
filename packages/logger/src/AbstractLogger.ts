import {
  InternalCommonLogger, 
  InternalCommonLoggerLogLevel, 
} from './types/InternalCommonLogger.interface';

export interface LoggerOptions {
  /**
   * The current node environment
   */
  env?: string
  /**
   * A list of NODE_ENV values that this logger will be used for. If the env does not match
   * the current NODE_ENV, the logger will fail silently.
   */
  useInEnvs?: string[]
}

export abstract class AbstractLogger<T extends LoggerOptions> {
  private logger: InternalCommonLogger;

  /**
   * If false, the created logger instances will not log anything
   */
  protected shouldLog = false;

  constructor(private readonly options: T) {
    this.shouldLog = options.useInEnvs && options.env
      ? options.useInEnvs.includes(options.env)
      : true;
    this.logger = this.createLogger(options);
  }

  protected abstract createLogger(options: T): InternalCommonLogger;

  log(level: InternalCommonLoggerLogLevel, data?: Record<string, any>) {
    this.logger.log(level, this.constructMetaObject(data));
  }

  private constructMetaObject(extraData?: Record<string, any>) {
    const { env } = this.options;
    
    return {
      ...(env && { env }),
      ...extraData,
    };
  }
}
