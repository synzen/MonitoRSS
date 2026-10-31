import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { Agent, setGlobalDispatcher } from 'undici';

const envFiles: Record<string, string> = {
  development: '.env.development',
  production: '.env.production',
  local: '.env.local',
};

const envFilePath = path.join(
  __dirname,
  '..',
  '..',
  envFiles[process.env.NODE_ENV as string] || envFiles.local,
);

dotenv.config({
  path: envFilePath,
});

const booleanFromString = z
  .string()
  .optional()
  .transform((val) => val === 'true');

const numberWithDefault = (def: number) =>
  z
    .string()
    .optional()
    .transform((val) => Number(val ?? def))
    .pipe(z.number());

const environmentSchema = z.enum([
  'development',
  'production',
  'local',
  'test',
]);

export const configSchema = z.object({
  NODE_ENV: environmentSchema,
  FEED_REQUESTS_API_KEY: z.string().min(1),
  FEED_REQUESTS_DATADOG_API_KEY: z.string().optional(),
  FEED_REQUESTS_POSTGRES_URI: z.string().min(1),
  FEED_REQUESTS_MAX_FAIL_ATTEMPTS: numberWithDefault(11),
  FEED_REQUESTS_API_PORT: z.coerce.number(),
  FEED_REQUESTS_RABBITMQ_BROKER_URL: z.string().min(1),
  FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT: z.string().min(1),
  FEED_REQUESTS_S3_ENDPOINT: z.string().optional(),
  FEED_REQUESTS_S3_API_KEY_ID: z.string().optional(),
  FEED_REQUESTS_S3_API_KEY: z.string().optional(),
  FEED_REQUESTS_REDIS_URI: z.string().min(1),
  FEED_REQUESTS_REDIS_DISABLE_CLUSTER: booleanFromString,
  FEED_REQUESTS_REQUEST_TIMEOUT_MS: numberWithDefault(15000),
  FEED_REQUESTS_RABBITMQ_PREFETCH_COUNT: numberWithDefault(3),
  FEED_REQUESTS_HISTORY_PERSISTENCE_MONTHS: numberWithDefault(2),
});

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | undefined;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (process.env.NODE_ENV === 'test') {
    cachedConfig = testConfig();

    return cachedConfig;
  }

  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error}`);
  }

  setGlobalDispatcher(
    new Agent({
      connect: { timeout: parsed.data.FEED_REQUESTS_REQUEST_TIMEOUT_MS },
    }),
  );

  cachedConfig = parsed.data;

  return cachedConfig;
}

export function testConfig(): Config {
  const values: Config = {
    NODE_ENV: 'test',
    FEED_REQUESTS_POSTGRES_URI: 'postgres://postgres:12345@localhost:5432/test',
    FEED_REQUESTS_API_KEY: '123456789',
    FEED_REQUESTS_API_PORT: 3000,
    FEED_REQUESTS_RABBITMQ_BROKER_URL: 'amqp://localhost:5672',
    FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT: 'test',
    FEED_REQUESTS_REDIS_URI: 'redis://localhost:6379',
    FEED_REQUESTS_MAX_FAIL_ATTEMPTS: 11,
    FEED_REQUESTS_REQUEST_TIMEOUT_MS: 15000,
    FEED_REQUESTS_RABBITMQ_PREFETCH_COUNT: 3,
    FEED_REQUESTS_HISTORY_PERSISTENCE_MONTHS: 2,
    FEED_REQUESTS_REDIS_DISABLE_CLUSTER: true,
  };

  return values;
}
