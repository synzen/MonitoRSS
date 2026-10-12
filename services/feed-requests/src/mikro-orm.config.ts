import { defineConfig } from '@mikro-orm/postgresql';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import config from './config';

const configVals = config();

const postgresUri = configVals.FEED_REQUESTS_POSTGRES_URI;
const dbName = postgresUri.split('/').pop();

const MikroOrmConfig = defineConfig({
  metadataProvider: ReflectMetadataProvider,
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  clientUrl: configVals.FEED_REQUESTS_POSTGRES_URI,
  forceUtcTimezone: true,
  timezone: 'UTC',
  dbName,
  ensureDatabase: true,
  migrations: {
    path: './migrations',
    pathTs: './migrations',
  },
});

export default MikroOrmConfig;
