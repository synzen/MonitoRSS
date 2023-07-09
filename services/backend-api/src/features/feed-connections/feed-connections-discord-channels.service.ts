import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { DiscordChannelType } from "../../common";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { InvalidFilterExpressionException } from "../../common/exceptions";
import { DiscordPreviewEmbed } from "../../common/types/discord-preview-embed.type";
import {
  castDiscordContentForMedium,
  castDiscordEmbedsForMedium,
} from "../../common/utils";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import { SendTestArticleResult } from "../../services/feed-handler/types";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordChannelType,
  FeedConnectionType,
} from "../feeds/constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { NoDiscordChannelPermissionOverwritesException } from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import {
  DiscordChannelPermissionsException,
  InvalidDiscordChannelException,
  MissingDiscordChannelException,
} from "./exceptions";

export interface UpdateDiscordChannelConnectionInput {
  accessToken: string;
  updates: {
    filters?: DiscordChannelConnection["filters"] | null;
    name?: string;
    disabledCode?: FeedConnectionDisabledCode | null;
    splitOptions?: DiscordChannelConnection["splitOptions"] | null;
    mentions?: DiscordChannelConnection["mentions"] | null;
    details?: {
      embeds?: DiscordChannelConnection["details"]["embeds"];
      formatter?: DiscordChannelConnection["details"]["formatter"] | null;
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
}

@Injectable()
export class FeedConnectionsDiscordChannelsService {
  constructor(
    private readonly feedsService: FeedsService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly feedHandlerService: FeedHandlerService
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

  async updateDiscordChannelConnection(
    feedId: string,
    connectionId: string,
    { accessToken, updates }: UpdateDiscordChannelConnectionInput
  ): Promise<DiscordChannelConnection> {
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
    }
  ): Promise<SendTestArticleResult> {
    const payload = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          dateFormat: userFeed.formatOptions?.dateFormat,
        },
      },
      article: details?.article ? details.article : undefined,
      mediumDetails: {
        channel: {
          id: connection.details.channel.id,
          type: connection.details.channel.type,
        },
        forumThreadTitle: connection.details.forumThreadTitle,
        forumThreadTags: connection.details.forumThreadTags,
        content: castDiscordContentForMedium(connection.details.content),
        embeds: castDiscordEmbedsForMedium(connection.details.embeds),
        formatter: connection.details.formatter,
        splitOptions: connection.splitOptions,
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
  }: CreatePreviewInput) {
    const payload = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          dateFormat: feedFormatOptions?.dateFormat,
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
            fields:
              e.fields
                ?.map((f) => ({
                  name: f.name || "",
                  value: f.value || "",
                  inline: f.inline || false,
                }))
                .filter((v) => v.name) || [],
            footerIconURL: e.footer?.iconUrl || undefined,
            footerText: e.footer?.text || undefined,
            timestamp: e.timestamp || undefined,
          }))
        ),
        formatter: connectionFormatOptions || undefined,
        splitOptions: splitOptions?.isEnabled ? splitOptions : undefined,
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
