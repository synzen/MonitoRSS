import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsString,
  MinLength,
  validateSync,
  IsOptional,
  IsBoolean,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Local = 'local',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @IsString()
  @IsOptional()
  DATADOG_API_KEY!: string;

  @IsString()
  @MinLength(1)
  POSTGRES_URI!: string;

  @IsBoolean()
  @IsOptional()
  SYNC_DB!: boolean;

  @IsString()
  @MinLength(1)
  AWS_SQS_QUEUE_URL!: string;

  @IsString()
  @MinLength(1)
  AWS_REGION!: string;

  @IsString()
  @MinLength(1)
  AWS_ACCESS_KEY_ID!: string;

  @IsString()
  @MinLength(1)
  AWS_SECRET_ACCESS_KEY!: string;

  @IsString()
  @IsOptional()
  AWS_SQS_QUEUE_SERVICE_ENDPOINT!: string;
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
