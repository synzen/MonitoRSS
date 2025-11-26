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
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  TestDiscordDeliveryDetails,
} from "../types";
import logger from "../../shared/utils/logger";
import { ArticleFormatterService } from "../../article-formatter/article-formatter.service";
import { FormatOptions } from "../../article-formatter/types";
import { generateDeliveryId } from "../../shared/utils/generate-delivery-id";
import { DiscordPayloadBuilderService } from "./discord/services/discord-payload-builder.service";
import { DiscordApiClientService } from "./discord/services/discord-api-client.service";
// eslint-disable-next-line max-len
import { DiscordDeliveryResultService } from "./discord/services/discord-delivery-result.service";
// eslint-disable-next-line max-len
import { DiscordMessageEnqueueService } from "./discord/services/discord-message-enqueue.service";
// eslint-disable-next-line max-len
import {
  DiscordTestDeliveryService,
  SendTestArticleResult,
} from "./discord/services/discord-test-delivery.service";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  constructor(
    private readonly articleFormatterService: ArticleFormatterService,
    private readonly payloadBuilderService: DiscordPayloadBuilderService,
    private readonly apiClientService: DiscordApiClientService,
    private readonly deliveryResultService: DiscordDeliveryResultService,
    private readonly messageEnqueueService: DiscordMessageEnqueueService,
    private readonly testDeliveryService: DiscordTestDeliveryService
  ) {}

  async close() {
    await this.messageEnqueueService.close();
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
    return this.testDeliveryService.deliverTestArticle(article, details);
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

    const apiUrl = this.apiClientService.getWebhookApiUrl(
      webhookId,
      webhookToken
    );
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

    const res = await this.apiClientService.sendRequest(apiUrl, {
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

    const channelApiUrl = this.apiClientService.getWebhookApiUrl(
      webhookId,
      webhookToken,
      {
        threadId,
      }
    );

    const parentDeliveryId = generateDeliveryId();

    const additionalDeliveryStates =
      await this.messageEnqueueService.enqueueMessages({
        apiUrl: channelApiUrl,
        bodies: bodies.slice(1),
        article,
        mediumId: details.mediumId,
        feedId: id,
        feedUrl: url,
        guildId,
        channelId: threadId,
        parentDeliveryId,
      });

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

    const forumApiUrl =
      this.apiClientService.getCreateChannelThreadUrl(channelId);
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

    const res = await this.apiClientService.sendRequest(forumApiUrl, {
      method: "POST",
      body: threadBody,
    });

    const threadCreationDeliveryStates =
      this.deliveryResultService.parseThreadCreateResponseToDeliveryStates(
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

    const channelApiUrl = this.apiClientService.getChannelApiUrl(threadId);

    const additionalDeliveryStates =
      await this.messageEnqueueService.enqueueMessages({
        apiUrl: channelApiUrl,
        bodies: bodies.slice(1),
        article,
        mediumId: details.mediumId,
        feedId: id,
        feedUrl: url,
        guildId,
        channelId: threadId,
        parentDeliveryId,
      });

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
        const apiUrl =
          this.apiClientService.getCreateChannelThreadUrl(channelId);
        const firstResponse = await this.apiClientService.sendRequest(apiUrl, {
          method: "POST",
          body: threadBody,
        });

        threadCreationDeliveryStates =
          this.deliveryResultService.parseThreadCreateResponseToDeliveryStates(
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
        const apiUrl = this.apiClientService.getChannelApiUrl(channelId);
        const firstPostResponse = await this.apiClientService.sendRequest(
          apiUrl,
          {
            method: "POST",
            body: bodies[0],
          }
        );

        if (!firstPostResponse.success) {
          return this.deliveryResultService.parseThreadCreateResponseToDeliveryStates(
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

        const messageThreadUrl =
          this.apiClientService.getCreateChannelMessageThreadUrl(
            channelId,
            messageId
          );

        const threadResponse = await this.apiClientService.sendRequest(
          messageThreadUrl,
          {
            method: "POST",
            body: threadBody,
          }
        );

        if (!threadResponse.success) {
          const failureStates =
            this.deliveryResultService.parseThreadCreateResponseToDeliveryStates(
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

    const apiUrl = this.apiClientService.getChannelApiUrl(useChannelId);

    const allRecords = await this.messageEnqueueService.enqueueMessages({
      apiUrl,
      bodies: bodies.slice(currentBodiesIndex),
      article,
      mediumId: details.mediumId,
      feedId: id,
      feedUrl: url,
      guildId,
      channelId: useChannelId,
      parentDeliveryId: parentDeliveryId || undefined,
    });

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

    const apiUrl = this.apiClientService.getWebhookApiUrl(
      webhookId,
      webhookToken,
      {
        threadId,
      }
    );

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

    const deliveryStates = await this.messageEnqueueService.enqueueMessages({
      apiUrl,
      bodies,
      article,
      mediumId: details.mediumId,
      feedId: id,
      feedUrl: url,
      guildId,
      webhookId,
    });

    return deliveryStates;
  }
}
