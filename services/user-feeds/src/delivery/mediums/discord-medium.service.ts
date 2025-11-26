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
  DiscordMessageApiPayload,
  TestDiscordDeliveryDetails,
} from "../types";
import logger from "../../shared/utils/logger";
import { ConfigService } from "@nestjs/config";
import { ArticleFormatterService } from "../../article-formatter/article-formatter.service";
import { FormatOptions } from "../../article-formatter/types";
import { generateDeliveryId } from "../../shared/utils/generate-delivery-id";
import { DiscordSendArticleOperationType } from "../types/discord-send-article-operation.type";
import { DiscordPayloadBuilderService } from "./discord/services/discord-payload-builder.service";

interface SendTestArticleResult {
  operationType?: DiscordSendArticleOperationType;
  apiPayload: Record<string, unknown>;
  result: {
    status: number;
    state: "success" | "error";
    message: string;
    body: object;
  };
}

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  static BASE_API_URL = "https://discord.com/api/v10";
  producer: RESTProducer;
  handler: RESTHandler;
  private botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly articleFormatterService: ArticleFormatterService,
    private readonly payloadBuilderService: DiscordPayloadBuilderService
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

  private getCreateChannelThreadUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/threads`;
  }

  private getCreateChannelMessageThreadUrl(
    channelId: string,
    messageId: string
  ) {
    return (
      `${DiscordMediumService.BASE_API_URL}` +
      `/channels/${channelId}/messages/${messageId}/threads`
    );
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
  ): Promise<SendTestArticleResult> {
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
        channelNewThreadTitle,
      },
      filterReferences,
    } = details;
    const channelId = channel?.id;
    const isForum = channel?.type === "forum" || webhook?.type === "forum";

    if (isForum) {
      const apiUrl = channelId
        ? this.getCreateChannelThreadUrl(channelId)
        : webhook
        ? this.getWebhookApiUrl(webhook.id, webhook.token)
        : undefined;

      if (!apiUrl) {
        throw new Error("No channel or webhook specified for Discord forum");
      }

      const threadNameContent = forumThreadTitle || "{{title}}";

      let bodies: DiscordMessageApiPayload[];
      let threadBody: Record<string, unknown>;
      const threadName =
        this.payloadBuilderService.generateApiTextPayload(article, {
          content: threadNameContent,
          limit: 100,
          mentions,
          filterReferences,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }) || "New Article";

      if (channelId) {
        bodies = this.payloadBuilderService.generateApiPayloads(article, {
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
          applied_tags: this.payloadBuilderService.getForumTagsToSend(
            forumThreadTags,
            filterReferences
          ),
          type: 11,
        };
      } else {
        bodies = this.payloadBuilderService
          .generateApiPayloads(article, {
            embeds,
            content,
            splitOptions,
            filterReferences,
            mentions,
            placeholderLimits,
            enablePlaceholderFallback,
            components,
          })
          .map((payload) => ({
            ...payload,
            username: this.payloadBuilderService.generateApiTextPayload(
              article,
              {
                content: webhook?.name,
                limit: 256,
                filterReferences,
                mentions,
                placeholderLimits,
                enablePlaceholderFallback,
                components,
              }
            ),
            avatar_url: this.payloadBuilderService.generateApiTextPayload(
              article,
              {
                content: webhook?.iconUrl,
                filterReferences,
                mentions,
                placeholderLimits,
                enablePlaceholderFallback,
                components,
              }
            ),
          }));

        threadBody = {
          ...bodies[0],
          thread_name: threadName,
          applied_tags: this.payloadBuilderService.getForumTagsToSend(
            forumThreadTags,
            filterReferences
          ),
          type: 11,
        };
      }

      const firstResponse = await this.sendDiscordApiRequest(apiUrl, {
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
      } else if (firstResponse.status !== 201) {
        return {
          apiPayload: threadBody,
          result: {
            status: firstResponse.status,
            state: "success",
            body: firstResponse.body,
            message: firstResponse.detail || "",
          },
        };
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
          this.sendDiscordApiRequest(threadChannelUrl, {
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
      const apiPayloads = this.payloadBuilderService
        .generateApiPayloads(article, {
          embeds,
          content,
          splitOptions,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        })
        .map((payload) => ({
          ...payload,
          username: this.payloadBuilderService.generateApiTextPayload(article, {
            content: webhook?.name,
            limit: 256,
            filterReferences,
            mentions,
            placeholderLimits,
            enablePlaceholderFallback,
            components,
          }),
          avatar_url: this.payloadBuilderService.generateApiTextPayload(
            article,
            {
              content: webhook?.iconUrl,
              filterReferences,
              mentions,
              placeholderLimits,
              enablePlaceholderFallback,
              components,
            }
          ),
        }));

      const results = await Promise.all(
        apiPayloads.map((payload) =>
          this.sendDiscordApiRequest(apiUrl, {
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
      const shouldCreateThread = channel.type === "new-thread";

      let useChannelId = channelId;

      const apiPayloads = this.payloadBuilderService.generateApiPayloads(
        article,
        {
          embeds: details.mediumDetails.embeds,
          content: details.mediumDetails.content,
          splitOptions,
          mentions,
          filterReferences,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }
      );
      let currentApiPayloadIndex = 0;

      const apiPayloadResults: {
        status: number;
        success: boolean;
        detail?: string;
        body: object;
      }[] = [];

      if (shouldCreateThread) {
        const createThreadFirst =
          details.mediumDetails.channelNewThreadExcludesPreview;

        const threadName =
          this.payloadBuilderService.generateApiTextPayload(article, {
            content: channelNewThreadTitle || "{{title}}",
            limit: 100,
            mentions,
            filterReferences,
            placeholderLimits,
            enablePlaceholderFallback,
            components,
          }) || "New Article";

        const threadBody = {
          name: threadName,
          type: 11,
        };

        if (!createThreadFirst) {
          // Send the post, create a thread, and then send the rest
          const apiUrl = this.getChannelApiUrl(channelId);
          const firstResponse = await this.sendDiscordApiRequest(apiUrl, {
            method: "POST",
            body: apiPayloads[0],
          });

          if (!firstResponse.success) {
            throw new Error(
              `Failed to create initial post for channel ${channelId}: ` +
                `${firstResponse.detail}. Body: ${JSON.stringify(
                  firstResponse.body
                )}`
            );
          }

          const messageId = (firstResponse.body as Record<string, unknown>)
            .id as string;

          const messageThreadUrl = this.getCreateChannelMessageThreadUrl(
            channelId,
            messageId
          );

          const threadResponse = await this.sendDiscordApiRequest(
            messageThreadUrl,
            {
              method: "POST",
              body: threadBody,
            }
          );

          if (!threadResponse.success) {
            throw new Error(
              `Failed to create thread for forum channel ${channelId}: ` +
                `${threadResponse.detail}. Body: ${JSON.stringify(
                  threadResponse.body
                )}`
            );
          } else if (threadResponse.status !== 201) {
            return {
              operationType:
                DiscordSendArticleOperationType.CreateThreadOnMessage,
              apiPayload: threadBody,
              result: {
                status: threadResponse.status,
                state: "success",
                body: threadResponse.body,
                message: threadResponse.detail || "",
              },
            };
          }

          useChannelId = (threadResponse.body as Record<string, unknown>)
            .id as string;

          currentApiPayloadIndex = 1;
          apiPayloadResults.push(firstResponse);
        } else {
          // Create a thread and then send all the posts
          const apiUrl = this.getCreateChannelThreadUrl(channelId);
          const firstResponse = await this.sendDiscordApiRequest(apiUrl, {
            method: "POST",
            body: threadBody,
          });

          if (!firstResponse.success) {
            throw new Error(
              `Failed to create initial thread for channel ${channelId}: ` +
                `${firstResponse.detail}. Body: ${JSON.stringify(
                  firstResponse.body
                )}`
            );
          } else if (firstResponse.status !== 201) {
            return {
              apiPayload: threadBody,
              result: {
                status: firstResponse.status,
                state: "success",
                body: firstResponse.body,
                message: firstResponse.detail || "",
              },
            };
          }

          useChannelId = (firstResponse.body as Record<string, unknown>)
            .id as string;
        }
      }

      const apiUrl = this.getChannelApiUrl(useChannelId);
      const results = [];

      for (const payload of apiPayloads.slice(
        currentApiPayloadIndex,
        apiPayloads.length
      )) {
        const result = await this.sendDiscordApiRequest(apiUrl, {
          method: "POST",
          body: payload,
        });
        results.push(result);
      }

      apiPayloadResults.push(...results);

      return {
        apiPayload: apiPayloads[0] as Record<string, unknown>,
        result: {
          status: apiPayloadResults[0].status,
          state: apiPayloadResults[0].success ? "success" : "error",
          body: apiPayloadResults[0].body,
          message: apiPayloadResults[0].detail || "",
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
          id: generateDeliveryId(),
          mediumId: details.mediumId,
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
          internalMessage: "No channel or webhook specified",
          articleIdHash: article.flattened.idHash,
          article,
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

        return await this.deliverArticleToWebhook(article, webhook, details);
      } else if (channel) {
        if (channel.type === "forum") {
          return await this.deliverArticleToChannelForum(
            article,
            channel.id,
            details
          );
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

      return [
        {
          id: generateDeliveryId(),
          mediumId: details.mediumId,
          status: ArticleDeliveryStatus.Failed,
          errorCode: ArticleDeliveryErrorCode.Internal,
          internalMessage: (err as Error).message,
          articleIdHash: article.flattened.idHash,
          article,
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
    const bodies = this.payloadBuilderService
      .generateApiPayloads(article, {
        embeds: details.deliverySettings.embeds,
        content: details.deliverySettings.content,
        splitOptions: details.deliverySettings.splitOptions,
        filterReferences,
        mentions,
        placeholderLimits: details.deliverySettings.placeholderLimits,
        enablePlaceholderFallback,
        components,
      })
      .map((payload) => ({
        ...payload,
        username: this.payloadBuilderService.generateApiTextPayload(article, {
          content: webhookUsername,
          limit: 256,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }),
        avatar_url: this.payloadBuilderService.generateApiTextPayload(article, {
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
        this.payloadBuilderService.generateApiTextPayload(article, {
          content: forumThreadTitle || "{{title}}",
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }) || "New Article",
      applied_tags: this.payloadBuilderService.getForumTagsToSend(
        forumThreadTags,
        filterReferences
      ),
    };

    const res = await this.sendDiscordApiRequest(apiUrl, {
      method: "POST",
      body: threadBody,
    });

    if (!res.success || res.status >= 300 || res.status < 200) {
      throw new Error(
        `Failed to create initial thread for webhook forum ${webhookId}: ${
          res.detail
        }. Body: ${JSON.stringify(res.body)}`
      );
    }

    const threadId = (res.body as Record<string, unknown>).id as string;

    const channelApiUrl = this.getWebhookApiUrl(webhookId, webhookToken, {
      threadId,
    });

    const parentDeliveryId = generateDeliveryId();
    const additionalDeliveryStates: ArticleDeliveryState[] = [];

    for (const body of bodies.slice(1, bodies.length)) {
      const additionalDeliveryId = generateDeliveryId();

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

      additionalDeliveryStates.push({
        id: additionalDeliveryId,
        status: ArticleDeliveryStatus.PendingDelivery,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        parent: parentDeliveryId,
        articleIdHash: article.flattened.idHash,
        article,
      });
    }

    return [
      {
        id: parentDeliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordThreadCreation,
        articleIdHash: article.flattened.idHash,
        article,
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

    const forumApiUrl = this.getCreateChannelThreadUrl(channelId);
    const bodies = this.payloadBuilderService.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    });

    const threadNameContent = forumThreadTitle || "{{title}}";

    const threadBody = {
      name:
        this.payloadBuilderService.generateApiTextPayload(article, {
          content: threadNameContent,
          limit: 100,
          filterReferences,
          mentions,
          placeholderLimits: details.deliverySettings.placeholderLimits,
          enablePlaceholderFallback,
          components,
        }) || "New Article",
      message: bodies[0],
      applied_tags: this.payloadBuilderService.getForumTagsToSend(
        forumThreadTags,
        filterReferences
      ),
      type: 11,
    };

    const res = await this.sendDiscordApiRequest(forumApiUrl, {
      method: "POST",
      body: threadBody,
    });

    const threadCreationDeliveryStates =
      this.parseThreadCreateResponseToDeliveryStates(
        res,
        article,
        details,
        ArticleDeliveryContentType.DiscordThreadCreation
      );

    if (!res.success || res.status >= 300 || res.status < 200) {
      return threadCreationDeliveryStates;
    }

    const parentDeliveryId = threadCreationDeliveryStates[0].id;

    const threadId = (res.body as Record<string, unknown>).id as string;

    const channelApiUrl = this.getChannelApiUrl(threadId);
    const additionalDeliveryStates: ArticleDeliveryState[] = [];

    for (const body of bodies.slice(1, bodies.length)) {
      const additionalDeliveryId = generateDeliveryId();

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

      additionalDeliveryStates.push({
        id: additionalDeliveryId,
        status: ArticleDeliveryStatus.PendingDelivery,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        parent: parentDeliveryId,
        articleIdHash: article.flattened.idHash,
        article,
      });
    }

    return [...threadCreationDeliveryStates, ...additionalDeliveryStates];
  }

  private async deliverArticleToChannel(
    article: Article,
    channelId: string,
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState[]> {
    const {
      deliverySettings: {
        guildId,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
        channelNewThreadTitle,
        channelNewThreadExcludesPreview,
        channel,
      },
      feedDetails: { id, url },
      filterReferences,
    } = details;
    let parentDeliveryId: string | null = null;
    let threadCreationDeliveryStates: ArticleDeliveryState[] = [];

    const bodies = this.payloadBuilderService.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    });
    let currentBodiesIndex = 0;
    const shouldCreateThread = channel?.type === "new-thread";

    let useChannelId = channelId;

    if (shouldCreateThread) {
      const shouldCreateThreadFirst = !!channelNewThreadExcludesPreview;
      const threadName =
        this.payloadBuilderService.generateApiTextPayload(article, {
          content: channelNewThreadTitle || "{{title}}",
          limit: 100,
          mentions,
          filterReferences,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }) || "New Article";

      const threadBody = {
        name: threadName,
        type: 11,
      };

      if (shouldCreateThreadFirst) {
        // Create the thread first and send all the posts into it
        const apiUrl = this.getCreateChannelThreadUrl(channelId);
        const firstResponse = await this.sendDiscordApiRequest(apiUrl, {
          method: "POST",
          body: threadBody,
        });

        threadCreationDeliveryStates =
          this.parseThreadCreateResponseToDeliveryStates(
            firstResponse,
            article,
            details,
            ArticleDeliveryContentType.DiscordThreadCreation
          );

        if (!firstResponse.success) {
          return threadCreationDeliveryStates;
        }

        useChannelId = (firstResponse.body as Record<string, unknown>)
          .id as string;
      } else {
        // Send the post, create a thread, and then send the rest
        const apiUrl = this.getChannelApiUrl(channelId);
        const firstPostResponse = await this.sendDiscordApiRequest(apiUrl, {
          method: "POST",
          body: bodies[0],
        });

        if (!firstPostResponse.success) {
          return this.parseThreadCreateResponseToDeliveryStates(
            firstPostResponse,
            article,
            details,
            ArticleDeliveryContentType.DiscordArticleMessage
          );
        }

        threadCreationDeliveryStates.push({
          id: generateDeliveryId(),
          status: ArticleDeliveryStatus.Sent,
          mediumId: details.mediumId,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          articleIdHash: article.flattened.idHash,
          article,
        });

        const messageId = (firstPostResponse.body as Record<string, unknown>)
          .id as string;

        const messageThreadUrl = this.getCreateChannelMessageThreadUrl(
          channelId,
          messageId
        );

        const threadResponse = await this.sendDiscordApiRequest(
          messageThreadUrl,
          {
            method: "POST",
            body: threadBody,
          }
        );

        if (!threadResponse.success) {
          const failureStates = this.parseThreadCreateResponseToDeliveryStates(
            threadResponse,
            article,
            details,
            ArticleDeliveryContentType.DiscordThreadCreation
          );

          failureStates.map((s) => {
            s.parent =
              threadCreationDeliveryStates[
                threadCreationDeliveryStates.length - 1
              ].id;
          });

          return [...threadCreationDeliveryStates, ...failureStates];
        }

        threadCreationDeliveryStates.push({
          id: generateDeliveryId(),
          status: ArticleDeliveryStatus.Sent,
          mediumId: details.mediumId,
          contentType: ArticleDeliveryContentType.DiscordThreadCreation,
          articleIdHash: article.flattened.idHash,
          parent:
            threadCreationDeliveryStates[
              threadCreationDeliveryStates.length - 1
            ].id,
          article,
        });

        useChannelId = (threadResponse.body as Record<string, unknown>)
          .id as string;

        currentBodiesIndex = 1;
      }
    }

    if (threadCreationDeliveryStates.length > 0) {
      parentDeliveryId =
        threadCreationDeliveryStates[threadCreationDeliveryStates.length - 1]
          .id;
    }

    const apiUrl = this.getChannelApiUrl(useChannelId);
    const allRecords: ArticleDeliveryState[] = [];

    for (const body of bodies.slice(currentBodiesIndex, bodies.length)) {
      const deliveryId = generateDeliveryId();

      await this.producer.enqueue(
        apiUrl,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        {
          id: deliveryId,
          articleID: article.flattened.id,
          feedURL: url,
          channel: useChannelId,
          feedId: id,
          guildId,
          emitDeliveryResult: true,
        }
      );

      allRecords.push({
        id: deliveryId,
        status: ArticleDeliveryStatus.PendingDelivery,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        parent: parentDeliveryId || undefined,
        articleIdHash: article.flattened.idHash,
        article,
      });
    }

    return [...threadCreationDeliveryStates, ...allRecords];
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
  ): Promise<ArticleDeliveryState[]> {
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

    const initialBodies = this.payloadBuilderService.generateApiPayloads(
      article,
      {
        embeds: details.deliverySettings.embeds,
        content: details.deliverySettings.content,
        splitOptions: details.deliverySettings.splitOptions,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }
    );

    const bodies = initialBodies.map((payload) => ({
      ...payload,
      username: this.payloadBuilderService.generateApiTextPayload(article, {
        content: webhookUsername,
        limit: 256,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }),
      avatar_url: this.payloadBuilderService.generateApiTextPayload(article, {
        content: webhookIconUrl,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      }),
    }));

    const parentDeliveryId = generateDeliveryId();
    const allRecords: ArticleDeliveryState[] = await Promise.all(
      bodies.map(async (body, idx) => {
        const deliveryId = idx === 0 ? parentDeliveryId : generateDeliveryId();

        await this.producer.enqueue(
          apiUrl,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
          {
            id: deliveryId,
            articleID: article.flattened.id,
            feedURL: url,
            webhookId,
            feedId: id,
            guildId,
            emitDeliveryResult: true,
          }
        );

        return {
          id: deliveryId,
          status: ArticleDeliveryStatus.PendingDelivery,
          mediumId: details.mediumId,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          articleIdHash: article.flattened.idHash,
          parent: idx === 0 ? undefined : parentDeliveryId,
          article,
        };
      })
    );

    return allRecords;
  }

  private parseThreadCreateResponseToDeliveryStates(
    response: Awaited<
      ReturnType<typeof DiscordMediumService.prototype.sendDiscordApiRequest>
    >,
    article: Article,
    details: DeliverArticleDetails,
    contentType: ArticleDeliveryContentType
  ): ArticleDeliveryState[] {
    if (!response.success) {
      throw new Error(
        `Failed to create thread for medium ${details.mediumId}: ${
          response.detail
        }. Body: ${JSON.stringify(response.body)}`
      );
    } else {
      if (response.status === 404) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: contentType,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.NoChannelOrWebhook,
            internalMessage: `Response: ${JSON.stringify(response.body)}`,
            externalDetail:
              "Unknown channel. Update the connection to use a different channel.",
            article,
          },
        ];
      } else if (response.status === 403) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: contentType,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
            internalMessage: `Response: ${JSON.stringify(response.body)}`,
            externalDetail: "Missing permissions",
            article,
          },
        ];
      } else if (response.status === 400) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Rejected,
            mediumId: details.mediumId,
            contentType: contentType,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
            internalMessage: `Response: ${JSON.stringify(response.body)}`,
            externalDetail: JSON.stringify(response.body, null, 2),
            article,
          },
        ];
      } else if (response.status > 300 || response.status < 200) {
        return [
          {
            id: generateDeliveryId(),
            status: ArticleDeliveryStatus.Failed,
            mediumId: details.mediumId,
            articleIdHash: article.flattened.idHash,
            errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
            internalMessage: `Response: ${JSON.stringify(response.body)}`,
            article,
          },
        ];
      }

      return [
        {
          id: generateDeliveryId(),
          status: ArticleDeliveryStatus.Sent,
          mediumId: details.mediumId,
          contentType: contentType,
          articleIdHash: article.flattened.idHash,
          article,
        },
      ];
    }
  }

  private async sendDiscordApiRequest(
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
