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
  // Retry backoff (ADR-011): how often a failing feed URL is re-fetched.
  // A URL always fetches on its own refresh cadence until it has gone without
  // a successful fetch for the suspension threshold — the greater of
  // SUSPENSION_BASE_MINUTES and SUSPENSION_RATE_MULTIPLIER x its refresh rate.
  // Probes then slow to 1h, 6h, and 24h as the time since the last success
  // crosses TIER1_HOURS and TIER2_HOURS. After EXPIRY_DAYS without a success,
  // probing stops entirely and the feed's feeds are disabled (one alert).
  // How long failures must persist before probing slows.
  FEED_REQUESTS_BACKOFF_SUSPENSION_BASE_MINUTES: numberWithDefault(240),
  // The suspension threshold also scales with the feed's own refresh rate
  // (multiplier x rateSeconds), so slow feeds aren't suspended after one miss.
  FEED_REQUESTS_BACKOFF_SUSPENSION_RATE_MULTIPLIER: numberWithDefault(2),
  // Time since last success after which probes go hourly → 6-hourly.
  FEED_REQUESTS_BACKOFF_TIER1_HOURS: numberWithDefault(24),
  // Time since last success after which probes go 6-hourly → daily.
  FEED_REQUESTS_BACKOFF_TIER2_HOURS: numberWithDefault(72),
  // Time since last success after which probing stops and feeds are disabled.
  FEED_REQUESTS_BACKOFF_EXPIRY_DAYS: numberWithDefault(14),
  // Minimum wait after a 429/503 response, with or without a Retry-After header.
  FEED_REQUESTS_BACKOFF_RATE_LIMIT_FLOOR_MINUTES: numberWithDefault(60),
  // Upper clamp on a host's Retry-After header, so a bad header can't silence a URL.
  FEED_REQUESTS_BACKOFF_RETRY_AFTER_MAX_HOURS: numberWithDefault(24),
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
    FEED_REQUESTS_BACKOFF_SUSPENSION_BASE_MINUTES: 240,
    FEED_REQUESTS_BACKOFF_SUSPENSION_RATE_MULTIPLIER: 2,
    FEED_REQUESTS_BACKOFF_TIER1_HOURS: 24,
    FEED_REQUESTS_BACKOFF_TIER2_HOURS: 72,
    FEED_REQUESTS_BACKOFF_EXPIRY_DAYS: 14,
    FEED_REQUESTS_BACKOFF_RATE_LIMIT_FLOOR_MINUTES: 60,
    FEED_REQUESTS_BACKOFF_RETRY_AFTER_MAX_HOURS: 24,
    FEED_REQUESTS_REQUEST_TIMEOUT_MS: 15000,
    FEED_REQUESTS_RABBITMQ_PREFETCH_COUNT: 3,
    FEED_REQUESTS_HISTORY_PERSISTENCE_MONTHS: 2,
    FEED_REQUESTS_REDIS_DISABLE_CLUSTER: true,
  };

  return values;
}
