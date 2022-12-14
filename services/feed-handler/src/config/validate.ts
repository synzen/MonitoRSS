import { plainToClass } from "class-transformer";
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
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
  FEED_HANDLER_FEED_REQUEST_SERVICE_URL: string;

  @IsString()
  FEED_HANDLER_FEED_FETCHER_API_KEY: string;

  @IsString()
  FEED_HANDLER_POSTGRES_URI: string;

  @IsString()
  FEED_HANDLER_FEED_MONGODB_URI: string;

  @IsString()
  FEED_HANDLER_POSTGRES_DATABASE: string;

  @IsString()
  FEED_HANDLER_DISCORD_CLIENT_ID: string;

  @IsString()
  FEED_HANDLER_DISCORD_RABBITMQ_URI: string;

  @IsNumberString()
  FEED_HANDLER_API_PORT: string;

  @IsString()
  FEED_HANDLER_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  FEED_HANDLER_RABBITMQ_BROKER_URL: string;
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
