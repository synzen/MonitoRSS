import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import {
  DiscordWebhook,
  DiscordWebhookType,
} from './types/discord-webhook.type';

@Injectable()
export class DiscordWebhooksService {
  constructor(
    private readonly discordApiService: DiscordAPIService,
    private readonly configService: ConfigService,
  ) {}

  async getWebhooksOfServer(serverId: string): Promise<DiscordWebhook[]> {
    const webhooks: DiscordWebhook[] =
      await this.discordApiService.executeBotRequest(
        `/guilds/${serverId}/webhooks`,
      );

    const botClientId = this.configService.get<string>('discordClientId');

    return webhooks.filter(
      (webhook) =>
        webhook.application_id === botClientId &&
        webhook.type === DiscordWebhookType.INCOMING,
    );
  }
}
