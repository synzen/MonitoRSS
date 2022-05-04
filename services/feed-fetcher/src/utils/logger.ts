import setupLogger from '@monitorss/logger';
import config from '../config';

const configValues = config();

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues.DATADOG_API_KEY as string,
    service: 'monitorss-feedfetcher',
  },
  enableDebugLogs: process.env.LOG_LEVEL === 'debug',
});

export default logger;
