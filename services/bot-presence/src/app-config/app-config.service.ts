import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordPresenceStatus } from '../constants/discord-presence-status.constants';
import { DiscordPresenceActivityType } from '../constants/discord-presence-activity-type.constants';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getBotToken() {
    return this.configService.getOrThrow<string>(
      'BOT_PRESENCE_DISCORD_BOT_TOKEN',
    );
  }

  getSupporterGuildId() {
    return this.configService.getOrThrow('BOT_PRESENCE_SUPPORTER_GUILD_ID');
  }

  getPresenceStatus() {
    const status = this.configService.get<DiscordPresenceStatus | undefined>(
      'BOT_PRESENCE_STATUS',
    );
    const activityType = this.configService.get<
      DiscordPresenceActivityType | undefined
    >('BOT_PRESENCE_ACTIVITY_TYPE');
    const activityName = this.configService.get<string | undefined>(
      'BOT_PRESENCE_ACTIVITY_NAME',
    );
    const activityStreamUrl = this.configService.get<string | undefined>(
      'BOT_PRESENCE_ACTIVITY_STREAM_URL',
    );

    if (!status) {
      return null;
    }

    return {
      status,
      activity:
        activityName && activityType
          ? {
              name: activityName,
              type: activityType,
              url: activityStreamUrl,
            }
          : undefined,
    };
  }

  getRabbitMqUrl() {
    return this.configService.getOrThrow<string>('BOT_PRESENCE_RABBITMQ_URL');
  }
}
