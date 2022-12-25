import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsString,
  MinLength,
  validateSync,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Local = 'local',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsString()
  @MinLength(1)
  FEED_FETCHER_API_KEY!: string;

  @IsString()
  @IsOptional()
  FEED_FETCHER_DATADOG_API_KEY?: string;

  @IsString()
  @MinLength(1)
  FEED_FETCHER_POSTGRES_URI!: string;

  @IsBoolean()
  @IsOptional()
  FEED_FETCHER_SYNC_DB?: boolean;

  @IsNumber()
  FEED_FETCHER_FAILED_REQUEST_DURATION_THRESHOLD_HOURS!: number;

  @IsNumber()
  FEED_FETCHER_API_PORT!: number;

  @IsString()
  @IsNotEmpty()
  FEED_FETCHER_RABBITMQ_BROKER_URL!: string;
}

export function validateConfig(
  config: Record<string, unknown> | EnvironmentVariables,
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
