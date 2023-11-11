import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AppConfigService } from './app-config.service';
import { DiscordPresenceActivityType } from '../constants/discord-presence-activity-type.constants';
import { DiscordPresenceStatus } from '../constants/discord-presence-status.constants';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  BOT_PRESENCE_DISCORD_BOT_TOKEN: string;

  @IsString()
  @IsNotEmpty()
  BOT_PRESENCE_RABBITMQ_URL: string;

  @IsIn(Object.values(DiscordPresenceStatus))
  @IsOptional()
  BOT_PRESENCE_STATUS?: DiscordPresenceStatus;

  @IsIn(Object.values(DiscordPresenceActivityType))
  @IsOptional()
  BOT_PRESENCE_ACTIVITY_TYPE?: DiscordPresenceActivityType;

  @IsString()
  @IsOptional()
  BOT_PRESENCE_ACTIVITY_NAME?: string;

  @IsString()
  @IsOptional()
  BOT_PRESENCE_ACTIVITY_STREAM_URL?: string;
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
