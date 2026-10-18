import { mock } from 'node:test';
import logger from '../../utils/logger';

/**
 * Replaces the logger's output methods with no-ops. Logger contents are not
 * asserted anywhere, and leaving the real console transports on drowns the
 * test runner's output in production log lines.
 */
export function silenceLogger(): void {
  mock.method(logger, 'debug', () => {});
  mock.method(logger, 'info', () => {});
  mock.method(logger, 'warn', () => {});
  mock.method(logger, 'error', () => {});
  mock.method(logger, 'datadog', () => {});
}
