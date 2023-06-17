import { DeliveryMedium } from "./delivery-medium.interface";
import { Injectable } from "@nestjs/common";
import {
  Article,
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode,
} from "../../shared";
import { JobResponse, RESTProducer } from "@synzen/discord-rest";
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
import { JobResponseError } from "@synzen/discord-rest/dist/RESTConsumer";
import { ArticleFormatterService } from "../../article-formatter/article-formatter.service";
import { FormatOptions } from "../../article-formatter/types";
import { randomUUID } from "node:crypto";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  static BASE_API_URL = "https://discord.com/api/v10";
  producer: RESTProducer;

  constructor(
    private readonly configService: ConfigService,
    private readonly articleFormatterService: ArticleFormatterService
  ) {
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

  private getForumApiUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/threads`;
  }

  async formatArticle(
    article: Article,
    options: FormatOptions
  ): Promise<Article> {
    return this.articleFormatterService.formatArticleForDiscord(
      article,
      options
    );
  }

  async deliverTestArticle(
    article: Article,
    details: TestDiscordDeliveryDetails
  ): Promise<{
    apiPayload: Record<string, unknown>;
    result: JobResponse<unknown> | JobResponseError;
  }> {
    const {
      channel,
      webhook,
      embeds,
      content,
      splitOptions,
      forumThreadTitle,
      forumThreadTags,
    } = details.mediumDetails;
    const channelId = channel?.id;
    const isForum = channel?.type === "forum";
    const webhookId = webhook?.id;

    if (webhookId) {
      const { id: webhookId, token: webhookToken, name, iconUrl } = webhook;

      const apiUrl = this.getWebhookApiUrl(webhookId, webhookToken);
      const apiPayloads = this.generateApiPayloads(article, {
        embeds,
        content,
        splitOptions,
      }).map((payload) => ({
        ...payload,
        username: name ? name : undefined,
        avatar_url: iconUrl ? iconUrl : undefined,
      }));

      const results = await Promise.all(
        apiPayloads.map((payload) =>
          this.producer.fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify(payload),
          })
        )
      );

      return {
        apiPayload: apiPayloads[0],
        result: results[0],
      };
    } else if (channelId && isForum) {
      const forumApiUrl = this.getForumApiUrl(channelId);
      const bodies = this.generateApiPayloads(article, {
        embeds: embeds,
        content: content,
        splitOptions: splitOptions,
      });

      const threadBody = {
        name:
          this.generateApiPayloads(article, {
            content: forumThreadTitle || "{{title}}",
            embeds: [],
            splitOptions: {
              limit: 100,
            },
          })[0].content || "New Article",
        message: bodies[0],
        applied_tags: forumThreadTags?.map((tag) => tag.id),
      };

      const firstResponse = await this.producer.fetch(forumApiUrl, {
        method: "POST",
        body: JSON.stringify(threadBody),
      });

      if (firstResponse.state === "error") {
        throw new Error(
          `Failed to create initial thread for forum channel ${channelId}: ${firstResponse.message}`
        );
      }

      const threadId = (firstResponse.body as Record<string, unknown>)
        .id as string;

      const channelApiUrl = this.getChannelApiUrl(threadId);

      await Promise.all(
        bodies.slice(1, bodies.length).map((body) =>
          this.producer.fetch(channelApiUrl, {
            method: "POST",
            body: JSON.stringify(body),
          })
        )
      );

      return {
        apiPayload: threadBody,
        result: firstResponse,
      };
    } else if (channelId) {
      const apiUrl = this.getChannelApiUrl(channelId);
      const apiPayloads = this.generateApiPayloads(article, {
        embeds: details.mediumDetails.embeds,
        content: details.mediumDetails.content,
        splitOptions,
      });

      const results = await Promise.all(
        apiPayloads.map((payload) =>
          this.producer.fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify(payload),
          })
        )
      );

      return {
        apiPayload: apiPayloads[0] as Record<string, unknown>,
        result: results[0],
      };
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
        if (channel.type === "forum") {
          return await this.deliverArticleToForum(article, channel.id, details);
        }

        const channelId = channel.id;

        return await this.deliverArticleToChannel(article, channelId, details);
      } else {
        throw new Error("No channel or webhook specified for Discord medium");
      }
    } catch (err) {
      logger.error(
        `Failed to deliver article ${
          article.flattened.id
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

  private async deliverArticleToForum(
    article: Article,
    channelId: string,
    details: DeliveryDetails
  ): Promise<ArticleDeliveryState> {
    const {
      deliverySettings: { guildId, forumThreadTitle },
      feedDetails: { id, url },
    } = details;

    const forumApiUrl = this.getForumApiUrl(channelId);
    const bodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
    });

    const threadBody = {
      name:
        this.generateApiPayloads(article, {
          content: forumThreadTitle || "{{title}}",
          embeds: [],
          splitOptions: {
            limit: 100,
          },
        })[0].content || "New Article",
      message: bodies[0],
      applied_tags: details.deliverySettings.forumThreadTags?.map(
        (tag) => tag.id
      ),
    };

    const res = await this.producer.fetch(
      forumApiUrl,
      {
        method: "POST",
        body: JSON.stringify(threadBody),
      },
      {
        id: details.deliveryId,
        articleID: article.flattened.id,
        feedURL: url,
        channel: channelId,
        feedId: id,
        guildId,
        emitDeliveryResult: bodies.length === 1,
      }
    );

    if (res.state === "error") {
      throw new Error(
        `Failed to create initial thread for forum channel ${channelId}: ${res.message}`
      );
    }

    const threadId = (res.body as Record<string, unknown>).id as string;

    const channelApiUrl = this.getChannelApiUrl(threadId);

    const additionalIds = await Promise.all(
      bodies.slice(1, bodies.length).map(async (body, index) => {
        const additionalDeliveryId = randomUUID();

        await this.producer.enqueue(
          channelApiUrl,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
          {
            id: additionalDeliveryId,
            articleID: article.flattened.id,
            feedURL: url,
            channel: threadId,
            feedId: id,
            guildId,
            emitDeliveryResult: index === bodies.length - 1,
          }
        );

        return additionalDeliveryId;
      })
    );

    return {
      id: details.deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId: details.mediumId,
      contentType: ArticleDeliveryContentType.DiscordArticleMessage,
    };
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
    const bodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
    });

    await Promise.all(
      bodies.map((body) =>
        this.producer.enqueue(
          apiUrl,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
          {
            id: details.deliveryId,
            articleID: article.flattened.id,
            feedURL: url,
            channel: channelId,
            feedId: id,
            guildId,
            emitDeliveryResult: true,
          }
        )
      )
    );

    return {
      id: details.deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId: details.mediumId,
      contentType: ArticleDeliveryContentType.DiscordArticleMessage,
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

    const bodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
    }).map((payload) => ({
      ...payload,
      username: webhookUsername ? webhookUsername : undefined,
      avatar_url: webhookIconUrl ? webhookIconUrl : undefined,
    }));

    await Promise.all(
      bodies.map((body) =>
        this.producer.enqueue(
          apiUrl,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
          {
            id: details.deliveryId,
            articleID: article.flattened.id,
            feedURL: url,
            webhookId,
            feedId: id,
            guildId,
            emitDeliveryResult: true,
          }
        )
      )
    );

    return {
      id: details.deliveryId,
      status: ArticleDeliveryStatus.PendingDelivery,
      mediumId: details.mediumId,
      contentType: ArticleDeliveryContentType.DiscordArticleMessage,
    };
  }

  generateApiPayloads(
    article: Article,
    {
      embeds,
      content,
      splitOptions,
    }: {
      embeds: DeliveryDetails["deliverySettings"]["embeds"];
      content?: string;
      splitOptions: DeliveryDetails["deliverySettings"]["splitOptions"] & {
        limit?: number;
      };
    }
  ): DiscordMessageApiPayload[] {
    const payloadContent = this.articleFormatterService.applySplit(
      replaceTemplateString(article.flattened, content) || "",
      {
        ...splitOptions,
        isEnabled: !!splitOptions,
      }
    );

    const payloads: DiscordMessageApiPayload[] = payloadContent.map(
      (contentPart) => ({
        content: contentPart,
        embeds: [],
      })
    );

    payloads[payloads.length - 1].embeds = (embeds || [])
      ?.map((embed) => {
        let timestamp: string | undefined = undefined;

        if (embed.timestamp === "now") {
          timestamp = new Date().toISOString();
        } else if (embed.timestamp === "article") {
          timestamp = article.raw.date?.toISOString();
        }

        const embedTitle = this.articleFormatterService.applySplit(
          replaceTemplateString(article.flattened, embed.title) || "",
          {
            limit: 256,
          }
        )[0];

        const embedUrl =
          replaceTemplateString(article.flattened, embed.url) || null;

        const embedDescription = this.articleFormatterService.applySplit(
          replaceTemplateString(article.flattened, embed.description) || "",
          {
            limit: 2048,
          }
        )[0];

        const embedFields = (embed.fields || [])
          ?.filter((field) => field.name && field.value)
          .map((field) => ({
            name: this.articleFormatterService.applySplit(
              replaceTemplateString(article.flattened, field.name) || "",
              {
                limit: 256,
              }
            )[0],
            value: this.articleFormatterService.applySplit(
              replaceTemplateString(article.flattened, field.value) || "",
              {
                limit: 1024,
              }
            )[0],
            inline: field.inline,
          }));

        const embedFooter = !embed.footer?.text
          ? undefined
          : {
              text: this.articleFormatterService.applySplit(
                replaceTemplateString(article.flattened, embed.footer.text) ||
                  "",
                {
                  limit: 2048,
                }
              )[0],
              icon_url:
                replaceTemplateString(
                  article.flattened,
                  embed.footer.iconUrl
                ) || null,
            };

        const embedImage = !embed.image?.url
          ? undefined
          : {
              url: replaceTemplateString(
                article.flattened,
                embed.image.url
              ) as string,
            };

        const embedThumbnail = !embed.thumbnail?.url
          ? undefined
          : {
              url: replaceTemplateString(
                article.flattened,
                embed.thumbnail.url
              ) as string,
            };

        const embedAuthor = !embed.author?.name
          ? undefined
          : {
              name: this.articleFormatterService.applySplit(
                replaceTemplateString(article.flattened, embed.author.name) ||
                  "",
                {
                  limit: 256,
                }
              )[0],
              url: replaceTemplateString(article.flattened, embed.author.url),
              icon_url:
                replaceTemplateString(
                  article.flattened,
                  embed.author.iconUrl
                ) || null,
            };

        return {
          title: embedTitle,
          description: embedDescription,
          author: embedAuthor,
          color: embed.color,
          footer: embedFooter,
          image: embedImage,
          thumbnail: embedThumbnail,
          url: embedUrl,
          fields: embedFields,
          timestamp,
        };
      })
      // Discord only allows 10 embeds per message
      .slice(0, 10);

    return payloads;
  }
}
