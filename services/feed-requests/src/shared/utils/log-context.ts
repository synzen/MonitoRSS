import { AsyncLocalStorage } from 'node:async_hooks';
import logger from '../../utils/logger';

interface LogContext {
  prefix: string;
}

export const logContextStorage = new AsyncLocalStorage<LogContext>();

function prefixed(message: string): string {
  const ctx = logContextStorage.getStore();

  return ctx?.prefix ? `${ctx.prefix} ${message}` : message;
}

const contextLogger = {
  info: (msg: string, meta?: Record<string, any>) =>
    logger.info(prefixed(msg), meta),
  debug: (msg: string, meta?: Record<string, any>) =>
    logger.debug(prefixed(msg), meta),
  error: (msg: string, meta?: Record<string, any>) =>
    logger.error(prefixed(msg), meta),
  warn: (msg: string, meta?: Record<string, any>) =>
    logger.warn(prefixed(msg), meta),
  datadog: (msg: string, meta?: Record<string, any>) =>
    logger.datadog(prefixed(msg), meta),
};

export default contextLogger;
