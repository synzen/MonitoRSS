import { DeliveryMedium } from "./delivery-medium.interface";
import { Injectable } from "@nestjs/common";
import { Article } from "../../shared";
import { ConfigService } from "@nestjs/config";
import { RESTProducer } from "@synzen/discord-rest";
import { DeliveryDetails } from "../types";
import { replaceTemplateString } from "../../articles/utils/replace-template-string";

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

  async deliver(deliveryDetails: DeliveryDetails): Promise<void> {
    await Promise.all(
      deliveryDetails.articles.map((article) =>
        this.deliverArticle(article, deliveryDetails)
      )
    );
  }

  private getChannelApiUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/messages`;
  }

  private getWebhookApiUrl(webhookId: string, webhookToken: string) {
    return `${DiscordMediumService.BASE_API_URL}/webhooks/${webhookId}/${webhookToken}`;
  }

  private async deliverArticle(article: Article, details: DeliveryDetails) {
    const channels = details.deliverySettings.channels || [];
    await Promise.all(
      channels.map(async ({ id }) => {
        try {
          await this.deliverArticleToChannel(article, id, details);
        } catch (err) {
          console.error(
            `Failed to deliver article ${article.id} to Discord channel ${id}`,
            {
              details,
            }
          );
        }
      })
    );

    const webhooks = details.deliverySettings.webhooks || [];
    await Promise.all(
      webhooks.map(async ({ id, token }) => {
        try {
          await this.deliverArticleToWebhook(article, id, token, details);
        } catch (err) {
          console.error(
            `Failed to deliver article ${article.id} to Discord webook ${id}`,
            {
              details,
            }
          );
        }
      })
    );
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
