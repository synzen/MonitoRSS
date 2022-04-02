import setupLogger from '@monitorss/logger';
import config from 'src/config';

const configValues = config();

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues.DATADOG_API_KEY as string,
    service: 'monitorss-feedfetcher',
  },
});

export default logger;
