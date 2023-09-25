import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IsNotEmpty, IsString, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AppConfigService } from './app-config.service';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  BOT_PRESENCE_DISCORD_BOT_TOKEN: string;

  @IsString()
  @IsNotEmpty()
  BOT_PRESENCE_RABBITMQ_URL: string;
}

function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
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

@Module({})
export class AppConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [AppConfigService],
      exports: [AppConfigService],
      imports: [
        ConfigModule.forRoot({
          cache: true,
          validate,
        }),
      ],
    };
  }
}
