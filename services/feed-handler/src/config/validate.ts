import { plainToClass } from "class-transformer";
import {
  IsEnum,
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
  FEED_REQUEST_SERVICE_URL: string;

  @IsString()
  POSTGRES_URI: string;

  @IsString()
  FEED_MONGODB_URI: string;

  @IsString()
  POSTGRES_DATABASE: string;

  @IsString()
  DISCORD_CLIENT_ID: string;

  @IsString()
  DISCORD_RABBITMQ_URI: string;

  @IsNumberString()
  PORT: string;

  @IsString()
  FEED_EVENT_QUEUE_URL: string;

  @IsString()
  AWS_REGION: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  API_KEY: string;
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
