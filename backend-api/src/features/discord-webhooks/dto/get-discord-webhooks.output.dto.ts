import { DiscordWebhook } from '../types/discord-webhook.type';

interface DiscordWebhookOutputDto {
  id: string;
  channelId: string;
  avatarUrl?: string;
  name: string;
}

export class GetDiscordWebhooksOutputDto {
  results: DiscordWebhookOutputDto[];

  static fromEntities(webhooks: DiscordWebhook[]): GetDiscordWebhooksOutputDto {
    return {
      results: webhooks.map((webhook) => ({
        id: webhook.id,
        channelId: webhook.channel_id,
        avatarUrl: webhook.avatar || undefined,
        name: webhook.name,
      })),
    };
  }
}
