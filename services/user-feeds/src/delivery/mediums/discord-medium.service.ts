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

    this.producer = new RESTProducer(rabbitmqUri, {
      clientId: discordClientId,
    });
  }

  private getChannelApiUrl(channelId: string) {
    return `${DiscordMediumService.BASE_API_URL}/channels/${channelId}/messages`;
  }

  private getWebhookApiUrl(
    webhookId: string,
    webhookToken: string,
    queries?: {
      threadId?: string;
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

  async formatArticle(
    article: Article,
    options: FormatOptions
  ): Promise<ArticleDiscordFormatted> {
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
        }).map((payload) => ({
          ...payload,
          username: this.generateApiTextPayload(article, {
            content: webhook?.name,
            limit: 256,
            filterReferences,
            mentions,
            placeholderLimits,
            enablePlaceholderFallback,
          }),
          avatar_url: this.generateApiTextPayload(article, {
            content: webhook?.iconUrl,
            filterReferences,
            mentions,
            placeholderLimits,
            enablePlaceholderFallback,
          }),
        }));

        threadBody = {
          ...bodies[0],
          thread_name: threadName,
        };
      }

      const firstResponse = await this.producer.fetch(apiUrl, {
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
          this.producer.fetch(threadChannelUrl, {
            method: "POST",
            body: JSON.stringify(body),
          })
        )
      );

      return {
        apiPayload: threadBody,
        result: firstResponse,
      };
    } else if (webhook) {
      const apiUrl = this.getWebhookApiUrl(webhook.id, webhook.token);
      const apiPayloads = this.generateApiPayloads(article, {
        embeds,
        content,
        splitOptions,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
      }).map((payload) => ({
        ...payload,
        username: this.generateApiTextPayload(article, {
          content: webhook?.name,
          limit: 256,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
        }),
        avatar_url: this.generateApiTextPayload(article, {
          content: webhook?.iconUrl,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
        }),
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
        apiPayload: apiPayloads[0] as Record<string, unknown>,
        result: results[0],
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
        mentions,
        enablePlaceholderFallback,
        placeholderLimits,
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
    }).map((payload) => ({
      ...payload,
      username: this.generateApiTextPayload(article, {
        content: webhookUsername,
        limit: 256,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
      }),
      avatar_url: this.generateApiTextPayload(article, {
        content: webhookIconUrl,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
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
        }) || "New Article",
    };

    const res = await this.producer.fetch(
      apiUrl,
      {
        method: "POST",
        body: JSON.stringify(threadBody),
      },
      {
        id: details.deliveryId,
        articleID: article.flattened.id,
        feedURL: url,
        webhookId,
        feedId: id,
        guildId,
        emitDeliveryResult: false,
      }
    );

    if (res.state === "error") {
      throw new Error(
        `Failed to create initial thread for webhok forum ${webhookId}: ${res.message}`
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
        };
      })
    );

    return [
      {
        id: details.deliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordThreadCreation,
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
        mentions,
        enablePlaceholderFallback,
        placeholderLimits,
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
        }) || "New Article",
      message: bodies[0],
      applied_tags: this.getForumTagsToSend(
        details.deliverySettings.forumThreadTags,
        filterReferences
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
        emitDeliveryResult: false,
      }
    );

    if (res.state === "error") {
      throw new Error(
        `Failed to create initial thread for forum channel ${channelId}: ${res.message}`
      );
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
        };
      })
    );

    return [
      {
        id: details.deliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: details.mediumId,
        contentType: ArticleDeliveryContentType.DiscordThreadCreation,
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
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState> {
    const {
      deliverySettings: {
        guildId,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
      },
      feedDetails: { id, url },
      filterReferences,
    } = details;

    const apiUrl = this.getWebhookApiUrl(webhookId, webhookToken);

    const initialBodies = this.generateApiPayloads(article, {
      embeds: details.deliverySettings.embeds,
      content: details.deliverySettings.content,
      splitOptions: details.deliverySettings.splitOptions,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
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
      }),
      avatar_url: this.generateApiTextPayload(article, {
        content: webhookIconUrl,
        filterReferences,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
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

      const result = this.articleFiltersService.getArticleFilterResults(
        filters.expression as LogicalExpression,
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
    }: {
      content: T;
      limit?: number;
      filterReferences: FilterExpressionReference;
      mentions: DeliveryDetails["deliverySettings"]["mentions"];
      placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
      enablePlaceholderFallback: boolean;
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
            limit: 2048,
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
              const result = this.articleFiltersService.getArticleFilterResults(
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
}
