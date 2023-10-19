import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  CustomPlaceholderDto,
  CustomRateLimitDto,
  DiscordGuildChannel,
  DiscordWebhook,
} from "../../common";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
  InsufficientSupporterLevelException,
  InvalidFilterExpressionException,
} from "../../common/exceptions";
import { DiscordPreviewEmbed } from "../../common/types/discord-preview-embed.type";
import {
  castDiscordContentForMedium,
  castDiscordEmbedsForMedium,
} from "../../common/utils";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import {
  CreateDiscordChannelPreviewInput,
  SendTestArticleResult,
  SendTestDiscordChannelArticleInput,
} from "../../services/feed-handler/types";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordChannelType,
  FeedConnectionDiscordWebhookType,
  FeedConnectionType,
} from "../feeds/constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { NoDiscordChannelPermissionOverwritesException } from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { CreateDiscordChannelConnectionCloneInputDto } from "./dto";
import {
  DiscordChannelPermissionsException,
  InvalidDiscordChannelException,
  MissingDiscordChannelException,
} from "./exceptions";
import { DiscordChannelType } from "../../common";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";

export interface UpdateDiscordChannelConnectionInput {
  accessToken: string;
  feed: {
    user: {
      discordUserId: string;
    };
  };
  updates: {
    filters?: DiscordChannelConnection["filters"] | null;
    name?: string;
    disabledCode?: FeedConnectionDisabledCode | null;
    splitOptions?: DiscordChannelConnection["splitOptions"] | null;
    mentions?: DiscordChannelConnection["mentions"] | null;
    rateLimits?: CustomRateLimitDto[] | null;
    customPlaceholders?: CustomPlaceholderDto[] | null;
    details?: {
      embeds?: DiscordChannelConnection["details"]["embeds"];
      formatter?: DiscordChannelConnection["details"]["formatter"] | null;
      componentRows?:
        | DiscordChannelConnection["details"]["componentRows"]
        | null;
      placeholderLimits?:
        | DiscordChannelConnection["details"]["placeholderLimits"]
        | null;
      channel?: {
        id: string;
      };
      webhook?: {
        id: string;
        name?: string;
        iconUrl?: string;
        threadId?: string;
      };
      content?: string;
      forumThreadTitle?: string;
      forumThreadTags?: {
        id: string;
        filters?: {
          expression: Record<string, unknown>;
        };
      }[];
      enablePlaceholderFallback?: boolean;
    };
  };
}

interface CreatePreviewInput {
  userFeed: UserFeed;
  connection: DiscordChannelConnection;
  splitOptions?: DiscordChannelConnection["splitOptions"] | null;
  content?: string;
  embeds?: DiscordPreviewEmbed[];
  feedFormatOptions: UserFeed["formatOptions"] | null;
  connectionFormatOptions?:
    | DiscordChannelConnection["details"]["formatter"]
    | null;
  articleId?: string;
  mentions?: DiscordChannelConnection["mentions"] | null;
  customPlaceholders?: CustomPlaceholderDto[] | null;
  placeholderLimits?:
    | DiscordChannelConnection["details"]["placeholderLimits"]
    | null;
  forumThreadTitle?: DiscordChannelConnection["details"]["forumThreadTitle"];
  forumThreadTags?: DiscordChannelConnection["details"]["forumThreadTags"];
  enablePlaceholderFallback?: boolean;
  componentRows?: DiscordChannelConnection["details"]["componentRows"] | null;
}

@Injectable()
export class FeedConnectionsDiscordChannelsService {
  constructor(
    private readonly feedsService: FeedsService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly supportersService: SupportersService,
    private readonly discordWebhooksService: DiscordWebhooksService,
    private readonly discordApiService: DiscordAPIService,
    private readonly discordAuthService: DiscordAuthService
  ) {}

  async createDiscordChannelConnection({
    feedId,
    name,
    channelId,
    webhook: inputWebhook,
    userAccessToken,
    discordUserId,
  }: {
    feedId: string;
    name: string;
    channelId?: string;
    webhook?: {
      id: string;
      name?: string;
      iconUrl?: string;
      threadId?: string;
    };
    userAccessToken: string;
    discordUserId: string;
  }): Promise<DiscordChannelConnection> {
    const connectionId = new Types.ObjectId();
    let channelToAdd: DiscordChannelConnection["details"]["channel"];
    let webhookToAdd: DiscordChannelConnection["details"]["webhook"];

    if (channelId) {
      const { channel, type } = await this.assertDiscordChannelCanBeUsed(
        userAccessToken,
        channelId
      );

      channelToAdd = {
        id: channelId,
        type,
        guildId: channel.guild_id,
      };
    } else if (inputWebhook?.id) {
      const benefits = await this.supportersService.getBenefitsOfDiscordUser(
        discordUserId
      );

      if (!benefits.isSupporter) {
        throw new Error("User must be a supporter to add webhooks");
      }

      const { webhook, channel } = await this.assertDiscordWebhookCanBeUsed(
        inputWebhook.id,
        userAccessToken
      );

      let type: FeedConnectionDiscordWebhookType | undefined = undefined;

      if (inputWebhook.threadId) {
        const { channel: threadChannel } =
          await this.assertDiscordChannelCanBeUsed(
            userAccessToken,
            inputWebhook.threadId
          );

        if (threadChannel.type === DiscordChannelType.PUBLIC_THREAD) {
          type = FeedConnectionDiscordWebhookType.Thread;
        } else {
          throw new InvalidDiscordChannelException();
        }
      } else if (channel.type === DiscordChannelType.GUILD_FORUM) {
        type = FeedConnectionDiscordWebhookType.Forum;
      }

      webhookToAdd = {
        iconUrl: inputWebhook.iconUrl,
        id: inputWebhook.id,
        name: inputWebhook.name,
        token: webhook.token as string,
        threadId: inputWebhook.threadId,
        guildId: channel.guild_id,
        type,
      };
    } else {
      throw new Error("Must provide either channelId or webhookId");
    }

    const updated = await this.userFeedModel.findOneAndUpdate(
      {
        _id: feedId,
      },
      {
        $push: {
          "connections.discordChannels": {
            id: connectionId,
            name,
            details: {
              type: FeedConnectionType.DiscordChannel,
              channel: channelToAdd,
              webhook: webhookToAdd,
              embeds: [],
            },
          },
        },
      },
      {
        new: true,
      }
    );

    const createdConnection = updated?.connections.discordChannels.find(
      (connection) => connection.id.equals(connectionId)
    );

    if (!createdConnection) {
      throw new Error(
        "Connection was not successfuly created. Check insertion statement and schemas are correct."
      );
    }

    return createdConnection;
  }

  async cloneConnection(
    userFeed: UserFeed,
    connection: DiscordChannelConnection,
    {
      name,
      channelId: newChannelId,
    }: CreateDiscordChannelConnectionCloneInputDto,
    userAccessToken: string
  ) {
    const newId = new Types.ObjectId();
    let channelDetailsToUse: DiscordChannelConnection["details"]["channel"] =
      connection.details.channel;

    if (newChannelId) {
      const channel = await this.assertDiscordChannelCanBeUsed(
        userAccessToken,
        newChannelId
      );

      channelDetailsToUse = {
        id: newChannelId,
        type: channel.type,
        guildId: channel.channel.guild_id,
      };
    }

    await this.userFeedModel.findOneAndUpdate(
      {
        _id: userFeed._id,
      },
      {
        $push: {
          "connections.discordChannels": {
            ...connection,
            id: newId,
            name,
            details: {
              ...connection.details,
              channel: channelDetailsToUse,
            },
          },
        },
      }
    );

    return {
      id: newId,
    };
  }

  async updateDiscordChannelConnection(
    feedId: string,
    connectionId: string,
    { accessToken, feed, updates }: UpdateDiscordChannelConnectionInput
  ): Promise<DiscordChannelConnection> {
    if (updates.customPlaceholders?.length) {
      const { allowCustomPlaceholders } =
        await this.supportersService.getBenefitsOfDiscordUser(
          feed.user.discordUserId
        );

      if (!allowCustomPlaceholders) {
        throw new InsufficientSupporterLevelException(
          "Must be a supporter of a sufficient tier to use custom placeholders."
        );
      }
    }

    const setRecordDetails: Partial<DiscordChannelConnection["details"]> =
      Object.entries(updates.details || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`connections.discordChannels.$.details.${key}`]: value,
        }),
        {}
      );

    if (updates.details?.channel?.id) {
      const { channel, type } = await this.assertDiscordChannelCanBeUsed(
        accessToken,
        updates.details.channel.id
      );

      // @ts-ignore
      setRecordDetails["connections.discordChannels.$.details.channel"] = {
        id: updates.details.channel.id,
        guildId: channel.guild_id,
        type,
      };
      // @ts-ignore
      setRecordDetails["connections.discordChannels.$.details.webhook"] = null;
    } else if (updates.details?.webhook) {
      const webhookDetails = updates.details.webhook;
      const benefits = await this.supportersService.getBenefitsOfDiscordUser(
        feed.user.discordUserId
      );

      if (!benefits.isSupporter) {
        throw new InsufficientSupporterLevelException(
          "User must be a supporter to add webhooks"
        );
      }

      const { webhook, channel } = await this.assertDiscordWebhookCanBeUsed(
        webhookDetails.id,
        accessToken
      );

      let type: FeedConnectionDiscordWebhookType | undefined = undefined;

      if (webhookDetails.threadId) {
        const { channel: threadChannel } =
          await this.assertDiscordChannelCanBeUsed(
            accessToken,
            webhookDetails.threadId
          );

        if (threadChannel.type === DiscordChannelType.PUBLIC_THREAD) {
          type = FeedConnectionDiscordWebhookType.Thread;
        } else {
          throw new InvalidDiscordChannelException();
        }
      } else if (channel.type === DiscordChannelType.GUILD_FORUM) {
        type = FeedConnectionDiscordWebhookType.Forum;
      }

      // @ts-ignore
      setRecordDetails["connections.discordChannels.$.details.webhook"] = {
        iconUrl: webhookDetails.iconUrl,
        id: webhookDetails.id,
        name: webhookDetails.name,
        token: webhook.token as string,
        guildId: channel.guild_id,
        type,
        threadId: webhookDetails.threadId,
      };
      // @ts-ignore
      setRecordDetails["connections.discordChannels.$.details.channel"] = null;
    }

    if (updates.filters) {
      const { errors } = await this.feedHandlerService.validateFilters({
        expression: updates.filters.expression,
      });

      if (errors.length) {
        throw new InvalidFilterExpressionException(
          errors.map((message) => new InvalidFilterExpressionException(message))
        );
      }
    }

    const findQuery = {
      _id: feedId,
      "connections.discordChannels.id": connectionId,
    };

    const updateQuery = {
      $set: {
        ...setRecordDetails,
        ...(updates.filters && {
          [`connections.discordChannels.$.filters`]: updates.filters,
        }),
        ...(updates.name && {
          [`connections.discordChannels.$.name`]: updates.name,
        }),
        ...(updates.disabledCode && {
          [`connections.discordChannels.$.disabledCode`]: updates.disabledCode,
        }),
        ...(updates.splitOptions && {
          [`connections.discordChannels.$.splitOptions`]: updates.splitOptions,
        }),
        ...(updates.mentions && {
          [`connections.discordChannels.$.mentions`]: updates.mentions,
        }),
        ...(updates.customPlaceholders && {
          [`connections.discordChannels.$.customPlaceholders`]:
            updates.customPlaceholders,
        }),
        ...(updates.rateLimits && {
          [`connections.discordChannels.$.rateLimits`]: updates.rateLimits,
        }),
      },
      $unset: {
        ...(updates.filters === null && {
          [`connections.discordChannels.$.filters`]: "",
        }),
        ...(updates.disabledCode === null && {
          [`connections.discordChannels.$.disabledCode`]: "",
        }),
        ...(updates.splitOptions === null && {
          [`connections.discordChannels.$.splitOptions`]: "",
        }),
      },
    };

    const updated = await this.userFeedModel.findOneAndUpdate(
      findQuery,
      updateQuery,
      {
        new: true,
      }
    );

    const updatedConnection = updated?.connections.discordChannels.find(
      (connection) => connection.id.equals(connectionId)
    );

    if (!updatedConnection) {
      throw new Error(
        "Connection was not successfully updated." +
          " Check insertion statement and schemas are correct."
      );
    }

    return updatedConnection;
  }

  async deleteConnection(feedId: string, connectionId: string) {
    await this.userFeedModel.updateOne(
      {
        _id: feedId,
      },
      {
        $pull: {
          "connections.discordChannels": {
            id: connectionId,
          },
        },
      }
    );
  }

  async sendTestArticle(
    userFeed: UserFeed,
    connection: DiscordChannelConnection,
    details?: {
      article?: {
        id: string;
      };
      previewInput?: CreatePreviewInput;
    }
  ): Promise<SendTestArticleResult> {
    const previewInput = details?.previewInput;

    let useCustomPlaceholders =
      previewInput?.customPlaceholders || connection.customPlaceholders;

    if (previewInput?.customPlaceholders?.length) {
      const { allowCustomPlaceholders } =
        await this.supportersService.getBenefitsOfDiscordUser(
          userFeed.user.discordUserId
        );

      if (!allowCustomPlaceholders) {
        useCustomPlaceholders = [];
      }
    }

    const cleanedPreviewEmbeds = previewInput?.embeds
      ? previewInput.embeds.map((e) => ({
          title: e.title || undefined,
          description: e.description || undefined,
          url: e.url || undefined,
          imageURL: e.image?.url || undefined,
          thumbnailURL: e.thumbnail?.url || undefined,
          authorIconURL: e.author?.iconUrl || undefined,
          authorName: e.author?.name || undefined,
          authorURL: e.author?.url || undefined,
          color: e.color || undefined,
          footerIconURL: e.footer?.iconUrl || undefined,
          footerText: e.footer?.text || undefined,
          timestamp: e.timestamp || undefined,
          fields:
            e.fields?.filter(
              (f): f is { name: string; value: string; inline?: boolean } =>
                !!f.name && !!f.value
            ) || [],
        }))
      : undefined;

    const payload: SendTestDiscordChannelArticleInput["details"] = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          ...userFeed.formatOptions,
          ...previewInput?.feedFormatOptions,
        },
      },
      article: details?.article ? details.article : undefined,
      mediumDetails: {
        channel: connection.details.channel
          ? {
              id: connection.details.channel.id,
              type: connection.details.channel.type,
            }
          : undefined,
        webhook: connection.details.webhook
          ? {
              id: connection.details.webhook.id,
              token: connection.details.webhook.token,
              name: connection.details.webhook.name,
              iconUrl: connection.details.webhook.iconUrl,
              type: connection.details.webhook.type,
              threadId: connection.details.webhook.threadId,
            }
          : undefined,
        forumThreadTitle:
          previewInput?.forumThreadTitle || connection.details.forumThreadTitle,
        forumThreadTags:
          previewInput?.forumThreadTags || connection.details.forumThreadTags,
        content: castDiscordContentForMedium(
          previewInput?.content ?? connection.details.content
        ),
        embeds: castDiscordEmbedsForMedium(
          cleanedPreviewEmbeds || connection.details.embeds
        ),
        formatter:
          previewInput?.connectionFormatOptions || connection.details.formatter,
        mentions: previewInput?.mentions || connection.mentions,
        customPlaceholders: useCustomPlaceholders,
        splitOptions: previewInput?.splitOptions?.isEnabled
          ? previewInput.splitOptions
          : connection.splitOptions?.isEnabled
          ? connection.splitOptions
          : undefined,
        placeholderLimits:
          previewInput?.placeholderLimits ||
          connection.details.placeholderLimits,
        enablePlaceholderFallback:
          previewInput?.enablePlaceholderFallback ??
          connection.details.enablePlaceholderFallback,
        componentRows:
          previewInput?.componentRows || connection.details.componentRows,
      },
    } as const;

    return this.feedHandlerService.sendTestArticle({
      details: payload,
    });
  }

  async createPreview({
    connection,
    userFeed,
    content,
    embeds,
    feedFormatOptions,
    connectionFormatOptions,
    splitOptions,
    articleId,
    mentions,
    placeholderLimits,
    enablePlaceholderFallback,
    customPlaceholders,
    componentRows,
  }: CreatePreviewInput) {
    let useCustomPlaceholders = customPlaceholders;

    if (customPlaceholders?.length) {
      const { allowCustomPlaceholders } =
        await this.supportersService.getBenefitsOfDiscordUser(
          userFeed.user.discordUserId
        );

      if (!allowCustomPlaceholders) {
        useCustomPlaceholders = [];
      }
    }

    const payload: CreateDiscordChannelPreviewInput["details"] = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          ...feedFormatOptions,
        },
      },
      article: articleId ? { id: articleId } : undefined,
      mediumDetails: {
        channel: connection.details.channel
          ? {
              id: connection.details.channel.id,
            }
          : undefined,
        webhook: connection.details.webhook
          ? {
              id: connection.details.webhook.id,
              token: connection.details.webhook.token,
              name: connection.details.webhook.name,
              iconUrl: connection.details.webhook.iconUrl,
            }
          : undefined,
        guildId:
          connection.details.channel?.guildId ||
          connection.details.webhook?.guildId ||
          "",
        content: castDiscordContentForMedium(content),
        embeds: castDiscordEmbedsForMedium(
          embeds?.map((e) => ({
            title: e.title || undefined,
            description: e.description || undefined,
            url: e.url || undefined,
            imageURL: e.image?.url || undefined,
            thumbnailURL: e.thumbnail?.url || undefined,
            authorIconURL: e.author?.iconUrl || undefined,
            authorName: e.author?.name || undefined,
            authorURL: e.author?.url || undefined,
            color: e.color || undefined,
            footerIconURL: e.footer?.iconUrl || undefined,
            footerText: e.footer?.text || undefined,
            timestamp: e.timestamp || undefined,
            fields:
              e.fields?.filter(
                (f): f is { name: string; value: string; inline?: boolean } =>
                  !!f.name && !!f.value
              ) || [],
          }))
        ),
        formatter: connectionFormatOptions || undefined,
        splitOptions: splitOptions?.isEnabled ? splitOptions : undefined,
        mentions: mentions,
        customPlaceholders: useCustomPlaceholders,
        placeholderLimits,
        enablePlaceholderFallback: enablePlaceholderFallback,
        componentRows,
      },
    } as const;

    return this.feedHandlerService.createPreview({
      details: payload,
    });
  }

  private async assertDiscordChannelCanBeUsed(
    accessToken: string,
    channelId: string
  ) {
    try {
      const channel = await this.feedsService.canUseChannel({
        channelId,
        userAccessToken: accessToken,
      });

      let type: FeedConnectionDiscordChannelType | undefined = undefined;

      if (channel.type === DiscordChannelType.GUILD_FORUM) {
        type = FeedConnectionDiscordChannelType.Forum;
      } else if (channel.type === DiscordChannelType.PUBLIC_THREAD) {
        type = FeedConnectionDiscordChannelType.Thread;
      }

      return {
        channel,
        type,
      };
    } catch (err) {
      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingDiscordChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          throw new DiscordChannelPermissionsException();
        }
      } else if (err instanceof NoDiscordChannelPermissionOverwritesException) {
        throw new InvalidDiscordChannelException();
      }

      throw err;
    }
  }

  private async assertDiscordWebhookCanBeUsed(
    id: string,
    accessToken: string
  ): Promise<{ webhook: DiscordWebhook; channel: DiscordGuildChannel }> {
    const webhook = await this.discordWebhooksService.getWebhook(id);

    if (!webhook) {
      throw new DiscordWebhookNonexistentException(
        `Discord webohok ${id} does not exist`
      );
    }

    if (!this.discordWebhooksService.canBeUsedByBot(webhook)) {
      throw new DiscordWebhookInvalidTypeException(
        `Discord webhook ${id} is a different type and is not operable by bot to send messages`
      );
    }

    if (
      !webhook.guild_id ||
      !(await this.discordAuthService.userManagesGuild(
        accessToken,
        webhook.guild_id
      ))
    ) {
      throw new DiscordWebhookMissingUserPermException(
        `User does not manage guild of webhook webhook ${id}`
      );
    }

    const channel = await this.discordApiService.getChannel(webhook.channel_id);

    return { webhook, channel };
  }
}
