import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { CustomPlaceholderDto, CustomRateLimitDto } from "../../common";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import {
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
  SendTestArticleResult,
  SendTestDiscordChannelArticleInput,
} from "../../services/feed-handler/types";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordChannelType,
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
      placeholderLimits?:
        | DiscordChannelConnection["details"]["placeholderLimits"]
        | null;
      channel?: {
        id: string;
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
}

@Injectable()
export class FeedConnectionsDiscordChannelsService {
  constructor(
    private readonly feedsService: FeedsService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly supportersService: SupportersService
  ) {}

  async createDiscordChannelConnection({
    feedId,
    name,
    channelId,
    userAccessToken,
  }: {
    feedId: string;
    name: string;
    channelId: string;
    userAccessToken: string;
  }): Promise<DiscordChannelConnection> {
    const { channel, type } = await this.assertDiscordChannelCanBeUsed(
      userAccessToken,
      channelId
    );

    const connectionId = new Types.ObjectId();

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
              channel: {
                id: channelId,
                type,
                guildId: channel.guild_id,
              },
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
    let channelId = connection.details.channel.id;
    let type: FeedConnectionDiscordChannelType | undefined;
    let guildId = connection.details.channel.guildId;

    if (newChannelId) {
      const channel = await this.assertDiscordChannelCanBeUsed(
        userAccessToken,
        newChannelId
      );

      channelId = newChannelId;
      type = channel.type;
      guildId = channel.channel.guild_id;
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
              channel: {
                id: channelId,
                type,
                guildId,
              },
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
        channel: {
          id: connection.details.channel.id,
          type: connection.details.channel.type,
        },
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

    const payload = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          ...feedFormatOptions,
        },
      },
      article: articleId ? { id: articleId } : undefined,
      mediumDetails: {
        channel: {
          id: connection.details.channel.id,
        },
        guildId: connection.details.channel.guildId,
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
}
