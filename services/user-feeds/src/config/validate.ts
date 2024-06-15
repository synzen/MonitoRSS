import { plainToClass } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
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

  @IsString()
  @IsOptional()
  USER_FEEDS_DATADOG_API_KEY: string;

  @IsString()
  USER_FEEDS_FEED_REQUESTS_API_URL: string;

  @IsString()
  @IsNotEmpty()
  USER_FEEDS_FEED_REQUESTS_GRPC_URL: string;

  @IsString()
  USER_FEEDS_FEED_REQUESTS_API_KEY: string;

  @IsString()
  USER_FEEDS_POSTGRES_URI: string;

  @IsString()
  USER_FEEDS_POSTGRES_DATABASE: string;

  @IsString()
  USER_FEEDS_DISCORD_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  USER_FEEDS_DISCORD_API_TOKEN: string;

  @IsString()
  USER_FEEDS_DISCORD_RABBITMQ_URI: string;

  @IsNumberString()
  USER_FEEDS_API_PORT: string;

  @IsString()
  USER_FEEDS_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  USER_FEEDS_RABBITMQ_BROKER_URL: string;

  @IsString()
  USER_FEEDS_FEED_REQUESTS_GRPC_USE_TLS!: string;

  @IsString()
  @IsOptional()
  USER_FEEDS_POSTGRES_REPLICA1_URI?: string;

  @IsBoolean()
  @IsOptional()
  USER_FEEDS_REDIS_DISABLE_CLUSTER: boolean;

  @IsString()
  USER_FEEDS_REDIS_URI: string;
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
