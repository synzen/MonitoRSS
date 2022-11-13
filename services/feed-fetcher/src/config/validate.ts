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
  API_KEY!: string;

  @IsString()
  @IsOptional()
  DATADOG_API_KEY?: string;

  @IsString()
  @MinLength(1)
  POSTGRES_URI!: string;

  @IsBoolean()
  @IsOptional()
  SYNC_DB?: boolean;

  @IsString()
  @MinLength(1)
  AWS_SQS_REQUEST_QUEUE_URL!: string;

  @IsString()
  @MinLength(1)
  AWS_SQS_REQUEST_QUEUE_REGION!: string;

  @IsString()
  @IsOptional()
  AWS_SQS_REQUEST_QUEUE_ENDPOINT?: string;

  @IsString()
  @MinLength(1)
  AWS_ACCESS_KEY_ID!: string;

  @IsString()
  @MinLength(1)
  AWS_SECRET_ACCESS_KEY!: string;

  @IsNumber()
  FAILED_REQUEST_DURATION_THRESHOLD_HOURS!: number;
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
