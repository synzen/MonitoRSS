import { DeliveryMedium } from "./delivery-medium.interface";
import { Injectable, Inject } from "@nestjs/common";
import { Article, ArticleDeliveryErrorCode } from "../../shared";
import { RESTProducer } from "@synzen/discord-rest";
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  DeliveryDetails,
  DiscordMessageApiPayload,
} from "../types";
import { replaceTemplateString } from "../../articles/utils/replace-template-string";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  static BASE_API_URL = "https://discord.com/api/v10";

  constructor(
    @Inject("DISCORD_REST_PRODUCER") private readonly producer: RESTProducer
  ) {}

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
        id: details.deliveryId,
        mediumId: details.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
        internalMessage: "No channel or webhook specified",
      };
    }

    try {
      if (webhook) {
        const { id, token, name, iconUrl } = webhook;

        return await this.deliverArticleToWebhook(
          article,
          { id, token, name, iconUrl },
          details
        );
      } else if (channel) {
        const channelId = channel.id;

        return await this.deliverArticleToChannel(article, channelId, details);
      } else {
        throw new Error("No channel or webhook specified for Discord medium");
      }
    } catch (err) {
      console.error(
        `Failed to deliver article ${
          article.id
        } to Discord webook/channel. Webhook: ${JSON.stringify(
          webhook
        )}, channel: ${JSON.stringify(channel)}`,
        {
          details,
          err: (err as Error).stack,
        }
      );

      return {
        id: details.deliveryId,
        mediumId: details.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: (err as Error).message,
      };
    }
  }

  private async deliverArticleToChannel(
    article: Article,
    channelId: string,
    details: DeliveryDetails
  ): Promise<ArticleDeliveryState> {
    const {
      deliverySettings: { guildId },
      feedDetails: { id, url },
    } = details;
    const apiUrl = this.getChannelApiUrl(channelId);

    await this.producer.enqueue(
      apiUrl,
      {
        method: "POST",
        body: JSON.stringify(this.generateApiPayload(article, details)),
      },
      {
        id: details.deliveryId,
        articleID: article.id,
        feedURL: url,
        channel: channelId,
        feedId: id,
        guildId,
      }
    );

    return {
      id: details.deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId: details.mediumId,
    };
  }

  private async deliverArticleToWebhook(
    article: Article,
    {
      id: webhookId,
      token: webhookToken,
      name: webhookUsername,
      iconUrl: webhookIconUrl,
    }: {
      id: string;
      token: string;
      name?: string;
      iconUrl?: string;
    },
    details: DeliveryDetails
  ): Promise<ArticleDeliveryState> {
    const {
      deliverySettings: { guildId },
      feedDetails: { id, url },
    } = details;

    const apiUrl = this.getWebhookApiUrl(webhookId, webhookToken);

    await this.producer.enqueue(
      apiUrl,
      {
        method: "POST",
        body: JSON.stringify({
          ...this.generateApiPayload(article, details),
          username: webhookUsername,
          avatar_url: webhookIconUrl,
        }),
      },
      {
        id: details.deliveryId,
        articleID: article.id,
        feedURL: url,
        webhookId,
        feedId: id,
        guildId,
      }
    );

    return {
      id: details.deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId: details.mediumId,
    };
  }

  private generateApiPayload(
    article: Article,
    { deliverySettings: { embeds, content } }: DeliveryDetails
  ): DiscordMessageApiPayload {
    const payload: DiscordMessageApiPayload = {
      content: replaceTemplateString(article, content),
      embeds: embeds?.map((embed) => ({
        title: replaceTemplateString(article, embed.title),
        description: replaceTemplateString(article, embed.description),
        author: !embed.author?.name
          ? undefined
          : {
              name: replaceTemplateString(article, embed.author.name) as string,
              icon_url: replaceTemplateString(article, embed.author.iconUrl),
            },
        color: embed.color,
        footer: !embed.footer?.text
          ? undefined
          : {
              text: replaceTemplateString(article, embed.footer.text) as string,
              icon_url: replaceTemplateString(article, embed.footer.iconUrl),
            },
        image: !embed.image?.url
          ? undefined
          : {
              url: replaceTemplateString(article, embed.image.url) as string,
            },
        thumbnail: !embed.thumbnail?.url
          ? undefined
          : {
              url: replaceTemplateString(
                article,
                embed.thumbnail.url
              ) as string,
            },
        url: replaceTemplateString(article, embed.url),
        fields: embed.fields
          ?.filter((field) => field.name && field.value)
          .map((field) => ({
            name: replaceTemplateString(article, field.name) as string,
            value: replaceTemplateString(article, field.value) as string,
            inline: field.inline,
          })),
      })),
    };

    return payload;
  }
}
