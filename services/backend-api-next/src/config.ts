import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export enum Environment {
  Development = "development",
  Production = "production",
  Local = "local",
  Test = "test",
}

const configSchema = z.object({
  NODE_ENV: z.nativeEnum(Environment).default(Environment.Local),
  BACKEND_API_PORT: z.coerce.number().default(3000),

  // Discord OAuth
  BACKEND_API_DISCORD_BOT_TOKEN: z.string().min(1),
  BACKEND_API_DISCORD_CLIENT_ID: z.string().min(1),
  BACKEND_API_DISCORD_CLIENT_SECRET: z.string().min(1),
  BACKEND_API_DISCORD_REDIRECT_URI: z.string().min(1),
  BACKEND_API_LOGIN_REDIRECT_URI: z.string().min(1),

  // MongoDB
  BACKEND_API_MONGODB_URI: z.string().min(1),

  // Session
  BACKEND_API_SESSION_SECRET: z.string().min(1),
  BACKEND_API_SESSION_SALT: z.string().min(1),

  // RabbitMQ
  BACKEND_API_RABBITMQ_BROKER_URL: z.string().min(1),

  // Service APIs
  BACKEND_API_FEED_REQUESTS_API_HOST: z.string().min(1),
  BACKEND_API_FEED_REQUESTS_API_KEY: z.string().min(1),
  BACKEND_API_USER_FEEDS_API_HOST: z.string().min(1),
  BACKEND_API_USER_FEEDS_API_KEY: z.string().min(1),

  // Feed settings
  BACKEND_API_FEED_USER_AGENT: z.string().min(1),

  // Defaults
  BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: z.coerce.number().default(10),
  BACKEND_API_DEFAULT_MAX_FEEDS: z.coerce.number().default(5),
  BACKEND_API_DEFAULT_MAX_USER_FEEDS: z.coerce.number().default(5),
  BACKEND_API_DEFAULT_DATE_FORMAT: z
    .string()
    .default("ddd, D MMMM YYYY, h:mm A z"),
  BACKEND_API_DEFAULT_TIMEZONE: z.string().default("UTC"),
  BACKEND_API_DEFAULT_DATE_LANGUAGE: z.string().default("en"),

  // Subscriptions
  BACKEND_API_SUBSCRIPTIONS_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  BACKEND_API_SUBSCRIPTIONS_HOST: z.string().optional(),
  BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN: z.string().optional(),

  // Supporters
  BACKEND_API_ENABLE_SUPPORTERS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS: z.coerce.number().default(5),
  BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER: z.coerce.number().default(100),
  BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT: z.coerce.number().default(0),
  BACKEND_API_SUPPORTER_GUILD_ID: z.string().optional(),
  BACKEND_API_SUPPORTER_ROLE_ID: z.string().optional(),
  BACKEND_API_SUPPORTER_SUBROLE_IDS: z.string().optional(),

  // Optional services
  BACKEND_API_DATADOG_API_KEY: z.string().optional(),

  // SMTP
  BACKEND_API_SMTP_HOST: z.string().optional(),
  BACKEND_API_SMTP_USERNAME: z.string().optional(),
  BACKEND_API_SMTP_PASSWORD: z.string().optional(),
  BACKEND_API_SMTP_FROM: z.string().optional(),

  // Paddle
  BACKEND_API_PADDLE_KEY: z.string().optional(),
  BACKEND_API_PADDLE_URL: z.string().optional(),
  BACKEND_API_PADDLE_WEBHOOK_SECRET: z.string().optional(),

  // Legacy
  BACKEND_API_ALLOW_LEGACY_REVERSION: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // Sentry
  BACKEND_API_SENTRY_HOST: z.string().optional(),
  BACKEND_API_SENTRY_PROJECT_IDS: z
    .string()
    .transform((val) => (val ? val.split(",") : []))
    .default(""),

  // Encryption
  BACKEND_API_ENCRYPTION_KEY_HEX: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]+$/)
    .optional(),

  // Reddit
  BACKEND_API_REDDIT_CLIENT_ID: z.string().optional(),
  BACKEND_API_REDDIT_CLIENT_SECRET: z.string().optional(),
  BACKEND_API_REDDIT_REDIRECT_URI: z.string().optional(),

  // Admin
  BACKEND_API_ADMIN_USER_IDS: z
    .string()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : []
    )
    .default(""),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${formattedErrors}`);
  }

  return result.data;
}
