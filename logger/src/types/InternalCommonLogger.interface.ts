export type InternalCommonLoggerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface InternalCommonLogger {
  log(level: InternalCommonLoggerLogLevel, data?: Record<string, any> | Error): void
}
