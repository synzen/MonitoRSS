import type { Config } from "../../config";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";
import { WebhookMissingPermissionsException } from "../../shared/exceptions/discord-webhooks.exceptions";
import {
  DiscordWebhook,
  DiscordWebhookType,
} from "../../shared/types/discord.types";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type { CreateWebhookDetails, GetWebhooksFilters } from "./types";

export class DiscordWebhooksService {
  private readonly clientId: string;

  constructor(
    private readonly config: Config,
    private readonly discordApiService: DiscordApiService
  ) {
    this.clientId = config.BACKEND_API_DISCORD_CLIENT_ID;
  }

  async createWebhook(
    channelId: string,
    details: CreateWebhookDetails
  ): Promise<DiscordWebhook> {
    const webhook = await this.discordApiService.executeBotRequest<DiscordWebhook>(
      `/channels/${channelId}/webhooks`,
      {
        method: "POST",
        body: JSON.stringify({
          name: details.name,
        }),
      }
    );

    return webhook;
  }

  async getWebhooksOfChannel(
    channelId: string,
    filters?: GetWebhooksFilters
  ): Promise<DiscordWebhook[]> {
    try {
      const webhooks =
        await this.discordApiService.executeBotRequest<DiscordWebhook[]>(
          `/channels/${channelId}/webhooks`
        );

      return webhooks.filter((webhook) => this.canBeUsedByBot(webhook, filters));
    } catch (err) {
      if (err instanceof DiscordAPIError && err.statusCode === 403) {
        throw new WebhookMissingPermissionsException();
      }

      throw err;
    }
  }

  async getWebhook(webhookId: string): Promise<DiscordWebhook | null> {
    try {
      const webhook =
        await this.discordApiService.executeBotRequest<DiscordWebhook>(
          `/webhooks/${webhookId}`
        );

      return webhook;
    } catch (err) {
      if (err instanceof DiscordAPIError && err.statusCode === 404) {
        return null;
      }

      throw err;
    }
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await this.discordApiService.executeBotRequest(`/webhooks/${webhookId}`, {
        method: "DELETE",
      });
    } catch (err) {
      if (err instanceof DiscordAPIError && err.statusCode === 404) {
        return;
      }

      throw err;
    }
  }

  canBeUsedByBot(webhook: DiscordWebhook, filters?: GetWebhooksFilters): boolean {
    const base = webhook.type === DiscordWebhookType.INCOMING;

    if (!filters?.onlyApplicationOwned) {
      return (
        base &&
        (webhook.application_id === null ||
          webhook.application_id === this.clientId)
      );
    } else {
      return base && webhook.application_id === this.clientId;
    }
  }
}
