import { plainToClass, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexadecimal,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  validateSync,
} from "class-validator";

export enum Environment {
  Development = "development",
  Production = "production",
  Local = "local",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  BACKEND_API_PORT: number;

  @IsString()
  @MinLength(1)
  BACKEND_API_DISCORD_BOT_TOKEN: string;

  @IsString()
  @MinLength(1)
  BACKEND_API_DISCORD_CLIENT_ID: string;

  @IsString()
  @MinLength(1)
  BACKEND_API_DISCORD_CLIENT_SECRET: string;

  @IsString()
  @MinLength(1)
  BACKEND_API_DISCORD_REDIRECT_URI: string;

  @IsString()
  @MinLength(1)
  BACKEND_API_LOGIN_REDIRECT_URI: string;

  @IsString()
  @MinLength(1)
  BACKEND_API_MONGODB_URI: string;

  @IsNumber()
  BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: number;

  @IsNumber()
  BACKEND_API_DEFAULT_MAX_FEEDS: number;

  @IsBoolean()
  BACKEND_API_SUBSCRIPTIONS_ENABLED: boolean;

  @IsString()
  @IsOptional()
  BACKEND_API_SUBSCRIPTIONS_HOST?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN?: string;

  @IsString()
  BACKEND_API_SESSION_SECRET: string;

  @IsString()
  BACKEND_API_SESSION_SALT: string;

  @IsString()
  BACKEND_API_FEED_USER_AGENT: string;

  @IsString()
  @IsOptional()
  BACKEND_API_DATADOG_API_KEY?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_AWS_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_DEFAULT_DATE_FORMAT?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_DEFAULT_TIMEZONE?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_DEFAULT_DATE_LANGUAGE?: string;

  @IsString()
  BACKEND_API_FEED_REQUESTS_API_KEY: string;

  @IsString()
  BACKEND_API_FEED_REQUESTS_API_HOST: string;

  @IsString()
  BACKEND_API_USER_FEEDS_API_HOST: string;

  @IsString()
  BACKEND_API_USER_FEEDS_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  BACKEND_API_RABBITMQ_BROKER_URL: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  BACKEND_API_DEFAULT_MAX_USER_FEEDS?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT?: number;

  @IsOptional()
  @IsString()
  BACKEND_API_SMTP_HOST?: string;

  @IsOptional()
  @IsString()
  BACKEND_API_SMTP_USERNAME?: string;

  @IsOptional()
  @IsString()
  BACKEND_API_SMTP_PASSWORD?: string;

  @IsOptional()
  @IsString()
  BACKEND_API_SMTP_FROM?: string;

  @IsOptional()
  @IsString()
  BACKEND_API_PADDLE_KEY?: string;

  @IsOptional()
  @IsString()
  BACKEND_API_PADDLE_URL?: string;

  @IsOptional()
  @IsString()
  BACKEND_API_PADDLE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @Type(() => Boolean)
  BACKEND_API_ALLOW_LEGACY_REVERSION?: boolean;

  @IsBoolean()
  @IsOptional()
  BACKEND_API_ENABLE_SUPPORTERS?: boolean;

  @IsString()
  @IsOptional()
  BACKEND_API_SUPPORTER_GUILD_ID?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_SUPPORTER_ROLE_ID?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_SUPPORTER_SUBROLE_IDS?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_SENTRY_HOST?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  BACKEND_API_SENTRY_PROJECT_IDS?: string[];

  @IsString()
  @IsOptional()
  BACKEND_API_ENCRYPTION_KEY_HEX?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_REDDIT_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  @MinLength(64)
  @IsHexadecimal()
  BACKEND_API_REDDIT_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  BACKEND_API_REDDIT_REDIRECT_URI?: string;
}

export function validateConfig(
  config: Record<string, unknown> | EnvironmentVariables
) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
