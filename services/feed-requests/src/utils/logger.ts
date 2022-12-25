import setupLogger from '@monitorss/logger';
import config from '../config';
import { EnvironmentVariables } from '../config/validate';

const configValues =
  process.env.NODE_ENV === 'test' ? ({} as EnvironmentVariables) : config();

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues.FEED_REQUESTS_DATADOG_API_KEY as string,
    service: 'monitorss-feedfetcher',
  },
  enableDebugLogs: process.env.LOG_LEVEL === 'debug',
});

export default logger;
