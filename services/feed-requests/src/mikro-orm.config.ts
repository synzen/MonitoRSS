import { Options } from '@mikro-orm/core';
import config from './config';

const configVals = config();

const postgresUri = configVals.FEED_REQUESTS_POSTGRES_URI;
const dbName = postgresUri.split('/').pop();

const MikroOrmConfig: Options = {
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  clientUrl: configVals.FEED_REQUESTS_POSTGRES_URI,
  type: 'postgresql',
  forceUtcTimezone: true,
  timezone: 'UTC',
  dbName,
  ensureDatabase: true,
};

export default MikroOrmConfig;
