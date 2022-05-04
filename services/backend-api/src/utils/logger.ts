import setupLogger from '@monitorss/logger';
import config from '../config/config';

const configValues = config();

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues.datadogApikey as string,
    service: 'monitorss-web-v2',
  },
  enableDebugLogs: process.env.LOG_LEVEL === 'debug',
});

export default logger;
