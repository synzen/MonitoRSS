import { DeliveryMedium } from "./delivery-medium.interface";
import { Injectable } from "@nestjs/common";
import {
  Article,
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
} from "../../shared";
import { ConfigService } from "@nestjs/config";
import { JobResponse, RESTProducer } from "@synzen/discord-rest";
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  DeliveryDetails,
  DiscordMessageApiPayload,
} from "../types";
import { replaceTemplateString } from "../../articles/utils/replace-template-string";
import { JobResponseError } from "@synzen/discord-rest/dist/RESTConsumer";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  rabbitMqUri: string;
  clientId: string;
  producer: RESTProducer;

  static BASE_API_URL = "https://discord.com/api/v10";

  constructor(private readonly configService: ConfigService) {
    this.rabbitMqUri = this.configService.getOrThrow(
      "FEED_HANDLER_DISCORD_RABBITMQ_URI"
    );
    this.clientId = this.configService.getOrThrow(
      "FEED_HANDLER_DISCORD_CLIENT_ID"
    );
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

    const result = await this.producer.fetch(
      apiUrl,
      {
        method: "POST",
        body: JSON.stringify(this.generateApiPayload(article, details)),
      },
      {
        articleID: article.id,
        feedURL: url,
        channel: channelId,
        feedId: id,
        guildId,
      }
    );

    return this.extractDeliveryStatusFromProducerResult(details, result);
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

    const result = await this.producer.fetch(
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
        articleID: article.id,
        feedURL: url,
        webhookId,
        feedId: id,
        guildId,
      }
    );

    return this.extractDeliveryStatusFromProducerResult(details, result);
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

  private extractDeliveryStatusFromProducerResult(
    details: DeliveryDetails,
    result: JobResponse<unknown> | JobResponseError
  ): ArticleDeliveryState {
    if (result.state === "error") {
      return {
        mediumId: details.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: result.message,
      };
    }

    if (result.status === 400) {
      return {
        mediumId: details.mediumId,
        status: ArticleDeliveryStatus.Rejected,
        errorCode: ArticleDeliveryRejectedCode.BadRequest,
        internalMessage: `Discord rejected the request with status code ${
          result.status
        } Body: ${JSON.stringify(result.body)}`,
      };
    }

    if (result.status >= 500) {
      return {
        mediumId: details.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
        internalMessage: `Status code from Discord ${
          result.status
        } received. Body: ${JSON.stringify(result.body)}`,
      };
    }

    if (result.status < 200 || result.status > 400) {
      return {
        mediumId: details.mediumId,
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: `Unhandled status code from Discord ${
          result.status
        } received. Body: ${JSON.stringify(result.body)}`,
      };
    }

    return {
      mediumId: details.mediumId,
      status: ArticleDeliveryStatus.Sent,
    };
  }
}
