import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsString,
  MinLength,
  validateSync,
  IsOptional,
  IsBoolean,
  IsNumber,
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

  @IsString()
  @MinLength(1)
  FEED_FETCHER_FEEDS_MONGODB_URI!: string;

  @IsBoolean()
  @IsOptional()
  FEED_FETCHER_SYNC_DB?: boolean;

  @IsString()
  @MinLength(1)
  FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_URL!: string;

  @IsString()
  @MinLength(1)
  FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_REGION!: string;

  @IsString()
  @IsOptional()
  FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_ENDPOINT?: string;

  @IsString()
  @MinLength(1)
  FEED_FETCHER_AWS_ACCESS_KEY_ID!: string;

  @IsString()
  @MinLength(1)
  FEED_FETCHER_AWS_SECRET_ACCESS_KEY!: string;

  @IsNumber()
  FEED_FETCHER_FAILED_REQUEST_DURATION_THRESHOLD_HOURS!: number;

  @IsNumber()
  FEED_FETCHER_API_PORT!: number;

  @IsBoolean()
  @IsOptional()
  FEED_FETCHER_SKIP_POLLING_SQS_REQUEST_QUEUE?: boolean;
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
