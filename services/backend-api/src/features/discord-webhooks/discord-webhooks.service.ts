import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { WebhookMissingPermissionsException } from "./exceptions";
import { DiscordWebhook, DiscordWebhookType } from "../../common";

@Injectable()
export class DiscordWebhooksService {
  clientId: string;

  constructor(
    private readonly discordApiService: DiscordAPIService,
    private readonly configService: ConfigService
  ) {
    this.clientId = configService.get<string>(
      "BACKEND_API_DISCORD_CLIENT_ID"
    ) as string;
  }

  async getWebhooksOfServer(serverId: string): Promise<DiscordWebhook[]> {
    try {
      const webhooks: DiscordWebhook[] =
        await this.discordApiService.executeBotRequest(
          `/guilds/${serverId}/webhooks`
        );

      return webhooks.filter((webhook) => this.canBeUsedByBot(webhook));
    } catch (err) {
      if (err instanceof DiscordAPIError && err.statusCode === 403) {
        throw new WebhookMissingPermissionsException();
      }

      throw err;
    }
  }

  async getWebhook(webhookId: string): Promise<DiscordWebhook | null> {
    try {
      const webhook: DiscordWebhook =
        await this.discordApiService.executeBotRequest(
          `/webhooks/${webhookId}`
        );

      return webhook;
    } catch (err: unknown | DiscordAPIError) {
      if (err instanceof DiscordAPIError && err.statusCode === 404) {
        return null;
      }

      throw err;
    }
  }

  canBeUsedByBot(webhook: DiscordWebhook): boolean {
    return (
      webhook.type === DiscordWebhookType.INCOMING &&
      (webhook.application_id === null ||
        webhook.application_id === this.clientId)
    );
  }
}
