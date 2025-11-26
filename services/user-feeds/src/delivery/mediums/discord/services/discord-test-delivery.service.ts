import { Injectable } from "@nestjs/common";
import { Article } from "../../../../shared";
import {
  DiscordMessageApiPayload,
  TestDiscordDeliveryDetails,
} from "../../../types";
// eslint-disable-next-line max-len
import { DiscordSendArticleOperationType } from "../../../types/discord-send-article-operation.type";
import { DiscordPayloadBuilderService } from "./discord-payload-builder.service";
import { DiscordApiClientService } from "./discord-api-client.service";

export interface SendTestArticleResult {
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
export class DiscordTestDeliveryService {
  constructor(
    private readonly payloadBuilderService: DiscordPayloadBuilderService,
    private readonly apiClientService: DiscordApiClientService
  ) {}

  async deliverTestArticle(
    article: Article,
    details: TestDiscordDeliveryDetails
  ): Promise<SendTestArticleResult> {
    const { channel, webhook } = details.mediumDetails;
    const channelId = channel?.id;
    const isForum = channel?.type === "forum" || webhook?.type === "forum";

    if (isForum) {
      return this.deliverTestArticleToForum(article, details);
    } else if (webhook) {
      return this.deliverTestArticleToWebhook(article, details);
    } else if (channelId) {
      return this.deliverTestArticleToChannel(article, details);
    } else {
      throw new Error("No channel or webhook specified for Discord medium");
    }
  }

  private async deliverTestArticleToForum(
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
      },
      filterReferences,
    } = details;
    const channelId = channel?.id;

    const apiUrl = channelId
      ? this.apiClientService.getCreateChannelThreadUrl(channelId)
      : webhook
      ? this.apiClientService.getWebhookApiUrl(webhook.id, webhook.token)
      : undefined;

    if (!apiUrl) {
      throw new Error("No channel or webhook specified for Discord forum");
    }

    const threadNameContent = forumThreadTitle || "{{title}}";
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

    let bodies: DiscordMessageApiPayload[];
    let threadBody: Record<string, unknown>;

    if (channelId) {
      bodies = this.payloadBuilderService.generateApiPayloads(article, {
        embeds,
        content,
        splitOptions,
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

    const firstResponse = await this.apiClientService.sendRequest(apiUrl, {
      method: "POST",
      body: threadBody,
    });

    if (!firstResponse.success) {
      throw new Error(
        `Failed to create initial thread for forum channel ${channelId}: ` +
          `${firstResponse.detail}. Body: ${JSON.stringify(firstResponse.body)}`
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
      ? this.apiClientService.getChannelApiUrl(threadId)
      : this.apiClientService.getWebhookApiUrl(
          webhook?.id as string,
          webhook?.token as string,
          { threadId }
        );

    await Promise.all(
      bodies.slice(1).map((body) =>
        this.apiClientService.sendRequest(threadChannelUrl, {
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
  }

  private async deliverTestArticleToWebhook(
    article: Article,
    details: TestDiscordDeliveryDetails
  ): Promise<SendTestArticleResult> {
    const {
      mediumDetails: {
        webhook,
        embeds,
        content,
        splitOptions,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
      },
      filterReferences,
    } = details;

    if (!webhook) {
      throw new Error("No webhook specified");
    }

    const apiUrl = this.apiClientService.getWebhookApiUrl(
      webhook.id,
      webhook.token,
      { threadId: webhook.threadId }
    );

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
          content: webhook.name,
          limit: 256,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }),
        avatar_url: this.payloadBuilderService.generateApiTextPayload(article, {
          content: webhook.iconUrl,
          filterReferences,
          mentions,
          placeholderLimits,
          enablePlaceholderFallback,
          components,
        }),
      }));

    const results = await Promise.all(
      apiPayloads.map((payload) =>
        this.apiClientService.sendRequest(apiUrl, {
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
  }

  private async deliverTestArticleToChannel(
    article: Article,
    details: TestDiscordDeliveryDetails
  ): Promise<SendTestArticleResult> {
    const {
      mediumDetails: {
        channel,
        embeds,
        content,
        splitOptions,
        mentions,
        placeholderLimits,
        enablePlaceholderFallback,
        components,
        channelNewThreadTitle,
      },
      filterReferences,
    } = details;

    if (!channel) {
      throw new Error("No channel specified");
    }

    const channelId = channel.id;
    const shouldCreateThread = channel.type === "new-thread";
    let useChannelId = channelId;

    const apiPayloads = this.payloadBuilderService.generateApiPayloads(
      article,
      {
        embeds,
        content,
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
        const apiUrl = this.apiClientService.getChannelApiUrl(channelId);
        const firstResponse = await this.apiClientService.sendRequest(apiUrl, {
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
        const apiUrl =
          this.apiClientService.getCreateChannelThreadUrl(channelId);
        const firstResponse = await this.apiClientService.sendRequest(apiUrl, {
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

    const apiUrl = this.apiClientService.getChannelApiUrl(useChannelId);

    for (const payload of apiPayloads.slice(currentApiPayloadIndex)) {
      const result = await this.apiClientService.sendRequest(apiUrl, {
        method: "POST",
        body: payload,
      });
      apiPayloadResults.push(result);
    }

    return {
      apiPayload: apiPayloads[0] as Record<string, unknown>,
      result: {
        status: apiPayloadResults[0].status,
        state: apiPayloadResults[0].success ? "success" : "error",
        body: apiPayloadResults[0].body,
        message: apiPayloadResults[0].detail || "",
      },
    };
  }
}
