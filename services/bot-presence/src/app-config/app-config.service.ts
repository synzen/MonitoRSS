import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getBotToken() {
    return this.configService.getOrThrow<string>(
      'BOT_PRESENCE_DISCORD_BOT_TOKEN',
    );
  }

  getRabbitMqUrl() {
    return this.configService.getOrThrow<string>('BOT_PRESENCE_RABBITMQ_URL');
  }
}
