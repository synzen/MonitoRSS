import {
  DeliverArticleDetails,
  DeliveryMedium,
} from "./delivery-medium.interface";
import { Injectable } from "@nestjs/common";
import {
  Article,
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode,
  ArticleDiscordFormatted,
} from "../../shared";
import { RESTHandler, RESTProducer } from "@synzen/discord-rest";
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
import { ArticleFormatterService } from "../../article-formatter/article-formatter.service";
import { FormatOptions } from "../../article-formatter/types";
import { randomUUID } from "node:crypto";
import { ArticleFiltersService } from "../../article-filters/article-filters.service";
import {
  FilterExpressionReference,
  LogicalExpression,
} from "../../article-filters/types";
import dayjs from "dayjs";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  static BASE_API_URL = "https://discord.com/api/v10";
  producer: RESTProducer;
  handler: RESTHandler;
  private botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly articleFormatterService: ArticleFormatterService,
    private readonly articleFiltersService: ArticleFiltersService
  ) {
    const rabbitmqUri = configService.getOrThrow(
      "USER_FEEDS_DISCORD_RABBITMQ_URI"
    );
    const discordClientId = configService.getOrThrow(
      "USER_FEEDS_DISCORD_CLIENT_ID"
    );
    this.botToken = configService.getOrThrow("USER_FEEDS_DISCORD_API_TOKEN");

    this.producer = new RESTProducer(rabbitmqUri, {
      clientId: discordClientId,
    });
    this.handler = new RESTHandler();
  }

  private getChannelApiUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/messages`;
  }

  private getWebhookApiUrl(
    webhookId: string,
    webhookToken: string,
    queries?: {
      threadId?: string | null;
    }
  ) {
    const urlQueries = new URLSearchParams();

    urlQueries.append("wait", "true");

    if (queries?.threadId) {
      urlQueries.append("thread_id", queries.threadId);
    }

    return `${
      DiscordMediumService.BASE_API_URL
    }/webhooks/${webhookId}/${webhookToken}?${urlQueries.toString()}`;
  }

  private getForumApiUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/threads`;
  }

  async close() {
    await this.producer.close();
  }

  async formatArticle(
    article: Article,
    options: FormatOptions
  ): Promise<ArticleDiscordFormatted> {
    const { article: formatted } =
      await this.articleFormatterService.formatArticleForDiscord(
        article,
        options
      );

    return formatted;
  }

  async deliverTestArticle(
    article: Article,
    details: TestDiscordDeliveryDetails
  ): Promise<{
    apiPayload: Record<string, unknown>;
    result: {
      status: number;
      state: "success" | "error";
      message: string;
      body: object;
    };
  }> {
    const {
      mediumDetails: {
        channel,
        webhook,
        embeds,
        content,
        splitOptions,
        forumThreadTitle,
        forumThreadTags,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      },
      filterReferences,
    } = details;
    const channelId = channel?.id;
    const isForum = channel?.type === "forum" || webhook?.type === "forum";

    if (isForum) {
      const apiUrl = channelId
        ? this.getForumApiUrl(channelId)
        : webhook
        ? this.getWebhookApiUrl(webhook.id, webhook.token)
        : undefined;

      if (!apiUrl) {
        throw new Error("No channel or webhook specified for Discord forum");
      }

      let bodies: DiscordMessageApiPayload[];
      let threadBody: Record<string, unknown>;
      const threadName =
        this.generateApiTextPayload(article, {
          content: forumThreadTitle || "{{title}}",
          limit: 100,
          mentions,
          filterReferences,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }) || "New Article";

      if (channelId) {
        bodies = this.generateApiPayloads(article, {
          embeds: embeds,
          content: content,
          splitOptions: splitOptions,
          mentions,
          filterReferences,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        });

        threadBody = {
          name: threadName,
          message: bodies[0],
          applied_tags: this.getForumTagsToSend(
            forumThreadTags,
            filterReferences
          ),
        };
      } else {
        bodies = this.generateApiPayloads(article, {
          embeds,
          content,
          splitOptions,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }).map((payload) => ({
          ...payload,
          username: this.generateApiTextPayload(article, {
            content: webhook?.name,
            limit: 256,
            filterReferences,
            mentions,
            placeholderLimits,
            enablePlaceholderFallback,
            components,
          }),
          avatar_url: this.generateApiTextPayload(article, {
            content: webhook?.iconUrl,
            filterReferences,
            mentions,
            placeholderLimits,
            enablePlaceholderFallback,
            components,
          }),
        }));

        threadBody = {
          ...bodies[0],
          thread_name: threadName,
          applied_tags: this.getForumTagsToSend(
            forumThreadTags,
            filterReferences
          ),
        };
      }

      const firstResponse = await this.sendDscordApiRequest(apiUrl, {
        method: "POST",
        body: threadBody,
      });

      if (!firstResponse.success) {
        throw new Error(
          `Failed to create initial thread for forum channel ${channelId}: ` +
            `${firstResponse.detail}. Body: ${JSON.stringify(
              firstResponse.body
            )}`
        );
      }

      const threadId = (firstResponse.body as Record<string, unknown>)
        .id as string;

      const threadChannelUrl = channelId
        ? this.getChannelApiUrl(threadId)
        : this.getWebhookApiUrl(
            webhook?.id as string,
            webhook?.token as string,
            {
              threadId,
            }
          );

      await Promise.all(
        bodies.slice(1, bodies.length).map((body) =>
          this.sendDscordApiRequest(threadChannelUrl, {
            method: "POST",
            body,
          })
        )
      );

      return {
        apiPayload: threadBody,
        result: {
          status: firstResponse.status,
          state: firstResponse.success ? "success" : "error",
          body: firstResponse.body,
          message: firstResponse.detail || "",
        },
      };
    } else if (webhook) {
      const apiUrl = this.getWebhookApiUrl(webhook.id, webhook.token, {
        threadId: webhook.threadId,
      });
      const apiPayloads = this.generateApiPayloads(article, {
        embeds,
        content,
        splitOptions,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }).map((payload) => ({
        ...payload,
        username: this.generateApiTextPayload(article, {
          content: webhook?.name,
          limit: 256,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }),
        avatar_url: this.generateApiTextPayload(article, {
          content: webhook?.iconUrl,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }),
      }));

      const results = await Promise.all(
        apiPayloads.map((payload) =>
          this.sendDscordApiRequest(apiUrl, {
            method: "POST",
            body: payload,
          })
        )
      );

      return {
        apiPayload: apiPayloads[0] as Record<string, unknown>,
        result: {
          status: results[0].status,
          state: results[0].success ? "success" : "error",
          body: results[0].body,
          message: results[0].detail || "",
        },
      };
    } else if (channelId) {
      const apiUrl = this.getChannelApiUrl(channelId);
      const apiPayloads = this.generateApiPayloads(article, {
        embeds: details.mediumDetails.embeds,
        content: details.mediumDetails.content,
        splitOptions,
        mentions,
        filterReferences,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      });

      const results = await Promise.all(
        apiPayloads.map((payload) =>
          this.sendDscordApiRequest(apiUrl, {
            method: "POST",
            body: payload,
          })
        )
      );

      return {
        apiPayload: apiPayloads[0] as Record<string, unknown>,
        result: {
          status: results[0].status,
          state: results[0].success ? "success" : "error",
          body: results[0].body,
          message: results[0].detail || "",
        },
      };
    } else {
      throw new Error("No channel or webhook specified for Discord medium");
    }
  }

  async deliverArticle(
    article: ArticleDiscordFormatted,
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState[]> {
    const {
      deliverySettings: { channel, webhook },
    } = details;

    if (!channel && !webhook) {
      return [
        {
          id: details.deliveryId,
          mediumId: details.mediumId,
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "No channel or webhook specified",
          articleIdHash: article.flattened.idHash,
        },
      ];
    }

    try {
      if (webhook) {
        if (webhook.type === "forum") {
          return await this.deliverArticleToWebhookForum(
            article,
            webhook,
            details
          );
        }

        return [await this.deliverArticleToWebhook(article, webhook, details)];
      } else if (channel) {
        if (channel.type === "forum") {
          return await this.deliverArticleToChannelForum(
            article,
            channel.id,
            details
          );
        }

        const channelId = channel.id;

        return [
          await this.deliverArticleToChannel(article, channelId, details),
        ];
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

      return [
        {
          id: details.deliveryId,
          mediumId: details.mediumId,
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: (err as Error).message,
          articleIdHash: article.flattened.idHash,
        },
      ];
    }
  }

  private async deliverArticleToWebhookForum(
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
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState[]> {
    const {
      deliverySettings: {
        guildId,
        forumThreadTitle,
        forumThreadTags,
        mentions,
        enablePlaceholderFallback,
        placeholderLimits,
        components,
      },
      feedDetails: { id, url },
      filterReferences,
    } = details;

    const apiUrl = this.getWebhookApiUrl(webhookId, webhookToken);
    const bodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
      filterReferences,
      mentions,
      placeholderLimits: details.deliverySettings.placeholderLimits,
      enablePlaceholderFallback,
      components,
    }).map((payload) => ({
      ...payload,
      username: this.generateApiTextPayload(article, {
        content: webhookUsername,
        limit: 256,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }),
      avatar_url: this.generateApiTextPayload(article, {
        content: webhookIconUrl,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }),
    }));

    const threadBody = {
      ...bodies[0],
      thread_name:
        this.generateApiTextPayload(article, {
          content: forumThreadTitle || "{{title}}",
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }) || "New Article",
      applied_tags: this.getForumTagsToSend(forumThreadTags, filterReferences),
    };

    const res = await this.sendDscordApiRequest(apiUrl, {
      method: "POST",
      body: threadBody,
    });

    if (!res.success) {
      throw new Error(
        `Failed to create initial thread for webhok forum ${webhookId}: ${
          res.detail
        }. Body: ${JSON.stringify(res.body)}`
      );
    }

    const threadId = (res.body as Record<string, unknown>).id as string;

    const channelApiUrl = this.getWebhookApiUrl(webhookId, webhookToken, {
      threadId,
    });

    const additionalDeliveryStates: ArticleDeliveryState[] = await Promise.all(
      bodies.slice(1, bodies.length).map(async (body) => {
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
            emitDeliveryResult: true,
          }
        );

        return {
          id: additionalDeliveryId,
          status: ArticleDeliveryStatus.PendingDelivery,
          mediumId: details.mediumId,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          parent: details.deliveryId,
          articleIdHash: article.flattened.idHash,
        };
      })
    );

    return [
      {
        id: details.deliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordThreadCreation,
        articleIdHash: article.flattened.idHash,
      },
      ...additionalDeliveryStates,
    ];
  }

  private async deliverArticleToChannelForum(
    article: Article,
    channelId: string,
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState[]> {
    const {
      deliverySettings: {
        guildId,
        forumThreadTitle,
        forumThreadTags,
        mentions,
        enablePlaceholderFallback,
        placeholderLimits,
        components,
      },
      feedDetails: { id, url },
      filterReferences,
    } = details;

    const forumApiUrl = this.getForumApiUrl(channelId);
    const bodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    });

    const threadBody = {
      name:
        this.generateApiTextPayload(article, {
          content: forumThreadTitle || "{{title}}",
          limit: 100,
          filterReferences,
          mentions,
          placeholderLimits: details.deliverySettings.placeholderLimits,
          enablePlaceholderFallback,
          components,
        }) || "New Article",
      message: bodies[0],
      applied_tags: this.getForumTagsToSend(forumThreadTags, filterReferences),
    };

    const res = await this.sendDscordApiRequest(forumApiUrl, {
      method: "POST",
      body: threadBody,
    });

    if (!res.success) {
      if (res.status === 404) {
        return [
          {
            id: details.deliveryId,
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: ArticleDeliveryContentType.DiscordThreadCreation,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
            internalMessage: `Response: ${JSON.stringify(res.body)}`,
            externalDetail:
              "Unknown channel. Update the connection to use a different channel.",
          },
        ];
      } else if (res.status === 403) {
        return [
          {
            id: details.deliveryId,
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: ArticleDeliveryContentType.DiscordThreadCreation,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
            internalMessage: `Response: ${JSON.stringify(res.body)}`,
            externalDetail: "Missing permissions",
          },
        ];
      } else if (res.status === 400) {
        return [
          {
            id: details.deliveryId,
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: ArticleDeliveryContentType.DiscordThreadCreation,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
            internalMessage: `Response: ${JSON.stringify(res.body)}`,
            externalDetail: JSON.stringify(res.body, null, 2),
          },
        ];
      } else {
        throw new Error(
          `Failed to create initial thread for forum channel ${channelId}: ${
            res.detail
          }. Body: ${JSON.stringify(res.body)}`
        );
      }
    }

    const threadId = (res.body as Record<string, unknown>).id as string;

    const channelApiUrl = this.getChannelApiUrl(threadId);

    const additionalDeliveryStates: ArticleDeliveryState[] = await Promise.all(
      bodies.slice(1, bodies.length).map(async (body) => {
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
            emitDeliveryResult: true,
          }
        );

        return {
          id: additionalDeliveryId,
          status: ArticleDeliveryStatus.PendingDelivery,
          mediumId: details.mediumId,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          parent: details.deliveryId,
          articleIdHash: article.flattened.idHash,
        };
      })
    );

    return [
      {
        id: details.deliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordThreadCreation,
        articleIdHash: article.flattened.idHash,
      },
      ...additionalDeliveryStates,
    ];
  }

  private async deliverArticleToChannel(
    article: Article,
    channelId: string,
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState> {
    const {
      deliverySettings: {
        guildId,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      },
      feedDetails: { id, url },
      filterReferences,
    } = details;
    const apiUrl = this.getChannelApiUrl(channelId);
    const bodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
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
      articleIdHash: article.flattened.idHash,
    };
  }

  private async deliverArticleToWebhook(
    article: Article,
    {
      id: webhookId,
      token: webhookToken,
      name: webhookUsername,
      iconUrl: webhookIconUrl,
      threadId,
    }: {
      id: string;
      token: string;
      name?: string;
      iconUrl?: string;
      threadId?: string | null;
    },
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState> {
    const {
      deliverySettings: {
        guildId,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      },
      feedDetails: { id, url },
      filterReferences,
    } = details;

    const apiUrl = this.getWebhookApiUrl(webhookId, webhookToken, {
      threadId,
    });

    const initialBodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    });

    const bodies = initialBodies.map((payload) => ({
      ...payload,
      username: this.generateApiTextPayload(article, {
        content: webhookUsername,
        limit: 256,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }),
      avatar_url: this.generateApiTextPayload(article, {
        content: webhookIconUrl,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }),
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
      articleIdHash: article.flattened.idHash,
    };
  }

  getForumTagsToSend(
    inputTags: DeliveryDetails["deliverySettings"]["forumThreadTags"],
    filterReferences: FilterExpressionReference
  ): string[] {
    if (!inputTags) {
      return [];
    }

    const results = inputTags.map(({ filters, id }) => {
      if (!filters) {
        return id;
      }

      const { result } = this.articleFiltersService.getArticleFilterResults(
        filters.expression as never,
        filterReferences
      );

      return result ? id : null;
    });

    return results.filter((result) => !!result) as string[];
  }

  generateApiTextPayload<T extends string | undefined>(
    article: Article,
    {
      content,
      limit,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    }: {
      content: T;
      limit?: number;
      filterReferences: FilterExpressionReference;
      mentions: DeliveryDetails["deliverySettings"]["mentions"];
      placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
      enablePlaceholderFallback: boolean;
      components: DeliveryDetails["deliverySettings"]["components"];
    }
  ): T {
    const payloads = this.generateApiPayloads(article, {
      embeds: [],
      content,
      splitOptions: {
        limit,
      },
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    });

    return (payloads[0].content || undefined) as T;
  }

  generateApiPayloads(
    article: Article,
    {
      embeds,
      content,
      splitOptions,
      mentions,
      filterReferences,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    }: {
      embeds: DeliveryDetails["deliverySettings"]["embeds"];
      content?: string;
      splitOptions?: DeliveryDetails["deliverySettings"]["splitOptions"] & {
        limit?: number;
      };
      mentions: DeliveryDetails["deliverySettings"]["mentions"];
      filterReferences: FilterExpressionReference;
      placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
      enablePlaceholderFallback: boolean;
      components: DeliveryDetails["deliverySettings"]["components"];
    }
  ): DiscordMessageApiPayload[] {
    const payloadContent = this.articleFormatterService.applySplit(
      this.replacePlaceholdersInString(article, content, {
        mentions,
        filterReferences,
        placeholderLimits,
        enablePlaceholderFallback,
      }),
      {
        ...splitOptions,
        isEnabled: !!splitOptions,
      }
    );

    const replacePlaceholderStringArgs = {
      mentions,
      filterReferences,
      placeholderLimits,
      enablePlaceholderFallback,
    };

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
        } else if (embed.timestamp === "article" && article.raw.date) {
          const dayjsDate = dayjs(article.raw.date);

          if (dayjsDate.isValid()) {
            timestamp = dayjsDate.toISOString();
          }
        }

        const embedTitle = this.articleFormatterService.applySplit(
          this.replacePlaceholdersInString(
            article,
            embed.title,
            replacePlaceholderStringArgs
          ),
          {
            limit: 256,
          }
        )[0];

        const embedUrl =
          this.replacePlaceholdersInString(article, embed.url, {
            ...replacePlaceholderStringArgs,
            encodeUrl: true,
          }) || null;

        const embedDescription = this.articleFormatterService.applySplit(
          this.replacePlaceholdersInString(
            article,
            embed.description,
            replacePlaceholderStringArgs
          ),
          {
            limit: 4096,
          }
        )[0];

        const embedFields = (embed.fields || [])
          ?.filter((field) => field.name && field.value)
          .map((field) => ({
            name: this.articleFormatterService.applySplit(
              this.replacePlaceholdersInString(
                article,
                field.name,
                replacePlaceholderStringArgs
              ),
              {
                limit: 256,
              }
            )[0],
            value: this.articleFormatterService.applySplit(
              this.replacePlaceholdersInString(
                article,
                field.value,
                replacePlaceholderStringArgs
              ),
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
                this.replacePlaceholdersInString(
                  article,
                  embed.footer.text,
                  replacePlaceholderStringArgs
                ),
                {
                  limit: 2048,
                }
              )[0],
              icon_url:
                this.replacePlaceholdersInString(
                  article,
                  embed.footer.iconUrl,
                  { ...replacePlaceholderStringArgs, encodeUrl: true }
                ) || null,
            };

        const embedImage = !embed.image?.url
          ? undefined
          : {
              url: this.replacePlaceholdersInString(article, embed.image.url, {
                ...replacePlaceholderStringArgs,
                encodeUrl: true,
              }) as string,
            };

        const embedThumbnail = !embed.thumbnail?.url
          ? undefined
          : {
              url: this.replacePlaceholdersInString(
                article,
                embed.thumbnail.url,
                { ...replacePlaceholderStringArgs, encodeUrl: true }
              ) as string,
            };

        const embedAuthor = !embed.author?.name
          ? undefined
          : {
              name: this.articleFormatterService.applySplit(
                this.replacePlaceholdersInString(
                  article,
                  embed.author.name,
                  replacePlaceholderStringArgs
                ),
                {
                  limit: 256,
                }
              )[0],
              url: this.replacePlaceholdersInString(article, embed.author.url, {
                ...replacePlaceholderStringArgs,
                encodeUrl: true,
              }),
              icon_url:
                this.replacePlaceholdersInString(
                  article,
                  embed.author.iconUrl,
                  replacePlaceholderStringArgs
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

    if (components && payloads.length > 0) {
      payloads[payloads.length - 1].components = components.map(
        ({ type, components: nestedComponents }) => ({
          type,
          components: nestedComponents.map(({ style, type, label, url }) => {
            return {
              style,
              type,
              label: (
                this.replacePlaceholdersInString(
                  article,
                  label,
                  replacePlaceholderStringArgs
                ) || label
              ).slice(0, 80),
              url: this.replacePlaceholdersInString(article, url, {
                ...replacePlaceholderStringArgs,
                encodeUrl: true,
              }),
            };
          }),
        })
      );
    }

    return payloads;
  }

  private replacePlaceholdersInString(
    article: Article,
    str: string | undefined | null,
    {
      filterReferences,
      mentions: inputMentions,
      placeholderLimits,
      enablePlaceholderFallback,
      encodeUrl,
    }: {
      filterReferences: FilterExpressionReference;
      mentions: DeliveryDetails["deliverySettings"]["mentions"];
      placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
      enablePlaceholderFallback: boolean;
      encodeUrl?: boolean;
    }
  ): string {
    const referenceObject = {
      ...article.flattened,
    };

    if (inputMentions) {
      const mentions =
        inputMentions.targets
          ?.map((mention) => {
            if (mention.filters?.expression) {
              const { result } =
                this.articleFiltersService.getArticleFilterResults(
                  mention.filters.expression as unknown as LogicalExpression,
                  filterReferences
                );

              if (!result) {
                return null;
              }
            }

            if (mention.type === "role") {
              return `<@&${mention.id}>`;
            } else if (mention.type === "user") {
              return `<@${mention.id}>`;
            }
          })
          ?.filter((s) => s)
          ?.join(" ") || "";

      referenceObject["discord::mentions"] = mentions;
    }

    let value =
      replaceTemplateString(referenceObject, str, {
        supportFallbacks: enablePlaceholderFallback,
        split: {
          func: (str, { limit, appendString }) => {
            return this.articleFormatterService.applySplit(str, {
              appendChar: appendString,
              limit,
              isEnabled: true,
              includeAppendInFirstPart: true,
            })[0];
          },
          limits: placeholderLimits?.map((r) => ({
            key: r.placeholder,
            ...r,
          })),
        },
      }) || "";

    if (encodeUrl) {
      value = value.replace(/\s/g, "%20");
    }

    return value;
  }

  private async sendDscordApiRequest(
    url: string,
    { method, body }: { method: "POST"; body: object }
  ) {
    const res = await this.handler.fetch(url, {
      method,
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${this.botToken}`,
      },
    });

    const isOkStatus = res.status >= 200 && res.status < 300;

    try {
      return {
        success: true,
        status: res.status,
        body: (await res.json()) as Record<string, unknown>,
        detail: !isOkStatus ? `Bad status code: ${res.status}` : undefined,
      };
    } catch (err) {
      return {
        success: false,
        status: res.status,
        detail: (err as Error).message,
        body: {},
      };
    }
  }
}
