import setupLogger from '@monitorss/logger';
import config from '../config';

const configValues = process.env.NODE_ENV === 'test' ? {} : config();

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues['DATADOG_API_KEY'],
    service: 'monitorss-feedfetcher',
  },
  enableDebugLogs: process.env.LOG_LEVEL === 'debug',
});

export default logger;
