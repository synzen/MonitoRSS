import { plainToClass } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
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
  DISCORD_BOT_TOKEN: string;

  @IsString()
  @MinLength(1)
  DISCORD_CLIENT_ID: string;

  @IsString()
  @MinLength(1)
  DISCORD_CLIENT_SECRET: string;

  @IsString()
  @MinLength(1)
  DISCORD_REDIRECT_URI: string;

  @IsString()
  @MinLength(1)
  LOGIN_REDIRECT_URI: string;

  @IsString()
  @MinLength(1)
  MONGODB_URI: string;

  @IsNumber()
  DEFAULT_REFRESH_RATE_MINUTES: number;

  @IsNumber()
  DEFAULT_MAX_FEEDS: number;

  @IsBoolean()
  API_SUBSCRIPTIONS_ENABLED: boolean;

  @IsString()
  @IsOptional()
  API_SUBSCRIPTIONS_HOST?: string;

  @IsString()
  @IsOptional()
  API_SUBSCRIPTIONS_ACCESS_TOKEN?: string;

  @IsString()
  SESSION_SECRET: string;

  @IsString()
  SESSION_SALT: string;

  @IsString()
  FEED_USER_AGENT: string;

  @IsString()
  @IsOptional()
  DATADOG_API_KEY?: string;

  @IsString()
  @IsOptional()
  AWS_URL_REQUEST_QUEUE_ENDPOINT?: string;

  @IsString()
  AWS_URL_REQUEST_QUEUE_REGION: string;

  @IsString()
  AWS_URL_REQUEST_QUEUE_URL: string;

  @IsString()
  @IsOptional()
  FEED_FETCHER_GRPC_URL?: string;

  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  DEFAULT_DATE_FORMAT?: string;

  @IsString()
  @IsOptional()
  DEFAULT_TIMEZONE?: string;

  @IsString()
  @IsOptional()
  DEFAULT_DATE_LANGUAGE?: string;

  @IsString()
  FEED_FETCHER_API_KEY: string;

  @IsString()
  FEED_FETCHER_API_HOST: string;

  @IsString()
  FEED_HANDLER_API_HOST: string;

  @IsString()
  FEED_HANDLER_API_KEY: string;
}

export function validateConfig(config: Record<string, unknown>) {
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
