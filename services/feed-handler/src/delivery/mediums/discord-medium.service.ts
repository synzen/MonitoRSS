import { DeliveryMedium } from "./delivery-medium.interface";
import { Injectable } from "@nestjs/common";
import { Article } from "../../shared";
import { ConfigService } from "@nestjs/config";
import { RESTProducer } from "@synzen/discord-rest";
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  DeliveryDetails,
} from "../types";
import { replaceTemplateString } from "../../articles/utils/replace-template-string";
import { ArticleDeliveryErrorCode } from "../delivery.constants";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  rabbitMqUri: string;
  botToken: string;
  clientId: string;
  producer: RESTProducer;

  static BASE_API_URL = "https://discord.com/api/v10";

  constructor(private readonly configService: ConfigService) {
    this.rabbitMqUri = this.configService.getOrThrow("DISCORD_RABBITMQ_URI");
    this.botToken = this.configService.getOrThrow("DISCORD_BOT_TOKEN");
    this.clientId = this.configService.getOrThrow("DISCORD_CLIENT_ID");
    this.producer = new RESTProducer(this.rabbitMqUri, {
      clientId: this.clientId,
    });
  }

  private getChannelApiUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/messages`;
  }

  private getWebhookApiUrl(webhookId: string, webhookToken: string) {
    return `${DiscordMediumService.BASE_API_URL}/webhooks/${webhookId}/${webhookToken}`;
  }

  async deliverArticle(
    article: Article,
    details: DeliveryDetails
  ): Promise<ArticleDeliveryState> {
    const { channel, webhook } = details.deliverySettings;

    if (!channel && !webhook) {
      return {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
        internalMessage: "No channel or webhook specified",
      };
    }

    try {
      if (webhook) {
        const { id, token } = webhook;
        await this.deliverArticleToWebhook(article, id, token, details);
      } else if (channel) {
        const channelId = channel.id;
        await this.deliverArticleToChannel(article, channelId, details);
      }

      return {
        status: ArticleDeliveryStatus.Sent,
      };
    } catch (err) {
      console.error(
        `Failed to deliver article ${
          article.id
        } to Discord webook/channel. Webhook: ${JSON.stringify(
          webhook
        )}, channel: ${JSON.stringify(channel)}`,
        {
          details,
        }
      );

      return {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: (err as Error).message,
      };
    }
  }

  private async deliverArticleToChannel(
    article: Article,
    channelId: string,
    {
      deliverySettings: { guildId, content },
      feedDetails: { id, url },
    }: DeliveryDetails
  ) {
    const apiUrl = this.getChannelApiUrl(channelId);

    await this.producer.enqueue(
      apiUrl,
      {
        method: "POST",
        body: JSON.stringify({
          content: replaceTemplateString(article, content),
        }),
      },
      {
        articleID: article.id,
        feedURL: url,
        channel: channelId,
        feedId: id,
        guildId,
      }
    );
  }

  private async deliverArticleToWebhook(
    article: Article,
    webhookId: string,
    webhookToken: string,
    {
      deliverySettings: { guildId, content },
      feedDetails: { id, url },
    }: DeliveryDetails
  ) {
    const apiUrl = this.getWebhookApiUrl(webhookId, webhookToken);

    await this.producer.enqueue(
      apiUrl,
      {
        method: "POST",
        body: JSON.stringify({
          content: replaceTemplateString(article, content),
        }),
      },
      {
        articleID: article.id,
        feedURL: url,
        webhookId,
        feedId: id,
        guildId,
      }
    );
  }
}
