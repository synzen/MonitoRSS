import { DeliveryMedium } from "./delivery-medium.interface";
import { Injectable } from "@nestjs/common";
import { Article, ArticleDeliveryErrorCode } from "../../shared";
import { RESTProducer } from "@synzen/discord-rest";
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  DeliveryDetails,
  DiscordMessageApiPayload,
  TestDiscordDeliveryDetails,
} from "../types";
import { replaceTemplateString } from "../../articles/utils/replace-template-string";
import logger from "../../shared/utils/logger";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  static BASE_API_URL = "https://discord.com/api/v10";
  producer: RESTProducer;

  constructor(private readonly configService: ConfigService) {
    const rabbitmqUri = configService.getOrThrow(
      "USER_FEEDS_DISCORD_RABBITMQ_URI"
    );
    const discordClientId = configService.getOrThrow(
      "USER_FEEDS_DISCORD_CLIENT_ID"
    );

    this.producer = new RESTProducer(rabbitmqUri, {
      clientId: discordClientId,
    });
  }

  private getChannelApiUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/messages`;
  }

  private getWebhookApiUrl(webhookId: string, webhookToken: string) {
    return `${DiscordMediumService.BASE_API_URL}/webhooks/${webhookId}/${webhookToken}`;
  }

  async deliverTestArticle(
    article: Record<string, unknown>,
    details: TestDiscordDeliveryDetails
  ) {
    const { channel, webhook, embeds, content } = details.mediumDetails;
    const channelId = channel?.id;
    const webhookId = webhook?.id;

    if (webhookId) {
      const { id: webhookId, token: webhookToken, name, iconUrl } = webhook;

      const apiUrl = this.getWebhookApiUrl(webhookId, webhookToken);
      const apiBody = {
        ...this.generateApiPayload(article, {
          embeds,
          content,
        }),
        username: name,
        avatar_url: iconUrl,
      };

      return this.producer.fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify(apiBody),
      });
    } else if (channelId) {
      const apiUrl = this.getChannelApiUrl(channelId);
      const apiBody = this.generateApiPayload(article, {
        embeds: details.mediumDetails.embeds,
        content: details.mediumDetails.content,
      });

      return this.producer.fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify(apiBody),
      });
    } else {
      throw new Error("No channel or webhook specified for Discord medium");
    }
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
      logger.error(
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
        body: JSON.stringify(
          this.generateApiPayload(article, {
            embeds: details.deliverySettings.embeds,
            content: details.deliverySettings.content,
          })
        ),
      },
      {
        id: details.deliveryId,
        articleID: article.id,
        feedURL: url,
        channel: channelId,
        feedId: id,
        guildId,
        emitDeliveryResult: true,
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
          ...this.generateApiPayload(article, {
            embeds: details.deliverySettings.embeds,
            content: details.deliverySettings.content,
          }),
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
        emitDeliveryResult: true,
      }
    );

    return {
      id: details.deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId: details.mediumId,
    };
  }

  private generateApiPayload(
    article: Record<string, unknown>,
    {
      embeds,
      content,
    }: {
      embeds: DeliveryDetails["deliverySettings"]["embeds"];
      content?: string;
    }
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
