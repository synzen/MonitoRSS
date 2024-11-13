import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  CustomPlaceholderDto,
  CustomRateLimitDto,
  DiscordGuildChannel,
  DiscordWebhook,
  ExternalPropertyDto,
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
import {
  CopyableSetting,
  CreateDiscordChannelConnectionCloneInputDto,
  CreateDiscordChannelConnectionCopyConnectionSettingsInputDto,
} from "./dto";
import {
  DiscordChannelPermissionsException,
  InvalidDiscordChannelException,
  MissingDiscordChannelException,
} from "./exceptions";
import { DiscordChannelType } from "../../common";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { castDiscordComponentRowsForMedium } from "../../common/utils";
import logger from "../../utils/logger";
import { WebhookMissingPermissionsException } from "../discord-webhooks/exceptions";
import { UserFeedConnectionEventsService } from "../user-feed-connection-events/user-feed-connection-events.service";
import { User, UserModel } from "../users/entities/user.entity";
import getFeedRequestLookupDetails from "../../utils/get-feed-request-lookup-details";
import { UsersService } from "../users/users.service";
import { ConfigService } from "@nestjs/config";

export interface UpdateDiscordChannelConnectionInput {
  accessToken: string;
  feed: {
    user: {
      discordUserId: string;
    };
    connections: UserFeed["connections"];
  };
  oldConnection: DiscordChannelConnection;
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
      applicationWebhook?: {
        channelId: string;
        name: string;
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
  externalProperties?: ExternalPropertyDto[] | null;
  placeholderLimits?:
    | DiscordChannelConnection["details"]["placeholderLimits"]
    | null;
  forumThreadTitle?: DiscordChannelConnection["details"]["forumThreadTitle"];
  forumThreadTags?: DiscordChannelConnection["details"]["forumThreadTags"];
  enablePlaceholderFallback?: boolean;
  componentRows?: DiscordChannelConnection["details"]["componentRows"] | null;
  includeCustomPlaceholderPreviews?: boolean;
}

@Injectable()
export class FeedConnectionsDiscordChannelsService {
  constructor(
    private readonly feedsService: FeedsService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    @InjectModel(User.name) private readonly userModel: UserModel,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly supportersService: SupportersService,
    private readonly discordWebhooksService: DiscordWebhooksService,
    private readonly discordApiService: DiscordAPIService,
    private readonly discordAuthService: DiscordAuthService,
    private readonly connectionEventsService: UserFeedConnectionEventsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService
  ) {}

  async createDiscordChannelConnection({
    feed,
    name,
    channelId,
    webhook: inputWebhook,
    applicationWebhook,
    userAccessToken,
    userDiscordUserId,
  }: {
    feed: UserFeed;
    name: string;
    channelId?: string;
    webhook?: {
      id: string;
      name?: string;
      iconUrl?: string;
      threadId?: string;
    };
    applicationWebhook?: {
      channelId: string;
      name: string;
      iconUrl?: string;
      threadId?: string;
    };
    userAccessToken: string;
    userDiscordUserId: string;
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
    } else if (inputWebhook?.id || applicationWebhook?.channelId) {
      const benefits = await this.supportersService.getBenefitsOfDiscordUser(
        feed.user.discordUserId
      );

      if (!benefits.isSupporter) {
        throw new InsufficientSupporterLevelException(
          "User must be a supporter to add webhooks"
        );
      }

      let webhook: DiscordWebhook;
      let channel: DiscordGuildChannel;
      const threadId = applicationWebhook?.threadId || inputWebhook?.threadId;
      const iconUrl = inputWebhook?.iconUrl || applicationWebhook?.iconUrl;
      const name = inputWebhook?.name || applicationWebhook?.name;

      if (inputWebhook) {
        ({ webhook, channel } = await this.assertDiscordWebhookCanBeUsed(
          inputWebhook.id,
          userAccessToken
        ));
      } else if (applicationWebhook) {
        const { channel: fetchedChannel } =
          await this.assertDiscordChannelCanBeUsed(
            userAccessToken,
            applicationWebhook.channelId
          );

        channel = fetchedChannel;
        webhook = await this.getOrCreateApplicationWebhook({
          channelId: channel.id,
          webhook: {
            name: `feed-${feed._id}-${connectionId}`,
          },
        });
      } else {
        throw new Error(
          "Missing input webhook or application webhook in webhook condition"
        );
      }

      if (!channel) {
        throw new MissingDiscordChannelException();
      }

      let type: FeedConnectionDiscordWebhookType | undefined = undefined;

      if (threadId) {
        const { channel: threadChannel } =
          await this.assertDiscordChannelCanBeUsed(userAccessToken, threadId);

        if (threadChannel.type === DiscordChannelType.PUBLIC_THREAD) {
          type = FeedConnectionDiscordWebhookType.Thread;
        } else {
          throw new InvalidDiscordChannelException();
        }
      } else if (channel.type === DiscordChannelType.GUILD_FORUM) {
        type = FeedConnectionDiscordWebhookType.Forum;
      }

      webhookToAdd = {
        iconUrl,
        id: webhook.id,
        name,
        token: webhook.token as string,
        threadId,
        guildId: channel.guild_id,
        channelId: channel.id,
        type,
        isApplicationOwned: !!applicationWebhook,
      };
    } else {
      throw new Error("Must provide either channelId or webhookId");
    }

    try {
      const updated = await this.userFeedModel.findOneAndUpdate(
        {
          _id: feed._id,
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

      await this.connectionEventsService.handleCreatedEvent({
        feed,
        connectionId: createdConnection.id,
        creator: {
          discordUserId: userDiscordUserId,
        },
      });

      return createdConnection;
    } catch (err) {
      if (webhookToAdd?.isApplicationOwned) {
        await this.cleanupWebhook(webhookToAdd.id);
      }

      throw err;
    }
  }

  async cloneConnection(
    userFeed: UserFeed,
    connection: DiscordChannelConnection,
    {
      name,
      channelId: newChannelId,
    }: CreateDiscordChannelConnectionCloneInputDto,
    userAccessToken: string,
    userDiscordUserId: string
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

    let newWebhookId: string | undefined = undefined;
    let newWebhookToken: string | undefined = undefined;

    if (connection.details.webhook?.isApplicationOwned) {
      const newWebhook = await this.getOrCreateApplicationWebhook({
        channelId: connection.details.webhook.channelId as string,
        webhook: {
          name: `feed-${userFeed._id}-${newId}`,
        },
      });

      newWebhookId = newWebhook.id;
      newWebhookToken = newWebhook.token as string;
    }

    try {
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
                webhook: connection.details.webhook
                  ? {
                      ...connection.details.webhook,
                      id: newWebhookId || connection.details.webhook.id,
                      token:
                        newWebhookToken || connection.details.webhook.token,
                    }
                  : undefined,
              },
            },
          },
        }
      );

      await this.connectionEventsService.handleCreatedEvent({
        feed: userFeed,
        connectionId: newId,
        creator: {
          discordUserId: userDiscordUserId,
        },
      });
    } catch (err) {
      if (newWebhookId) {
        await this.cleanupWebhook(newWebhookId);
      }

      throw err;
    }

    return {
      id: newId,
    };
  }

  async copySettings(
    userFeed: UserFeed,
    sourceConnection: DiscordChannelConnection,
    {
      properties,
      targetDiscordChannelConnectionIds,
    }: CreateDiscordChannelConnectionCopyConnectionSettingsInputDto
  ) {
    const foundFeed = await this.userFeedModel
      .findById(userFeed._id)
      .select("connections");

    if (!foundFeed) {
      throw new Error(`Could not find feed ${userFeed._id}`);
    }

    const relevantConnections = targetDiscordChannelConnectionIds.map((id) => {
      const connection = foundFeed?.connections.discordChannels.find((c) =>
        c.id.equals(id)
      );

      if (!connection) {
        throw new Error(
          `Could not find connection ${id} on feed ${userFeed._id}`
        );
      }

      return connection;
    });

    for (let i = 0; i < relevantConnections.length; ++i) {
      const currentConnection = relevantConnections[i];

      if (properties.includes(CopyableSetting.Embeds)) {
        currentConnection.details.embeds = sourceConnection.details.embeds;
      }

      if (
        currentConnection.details.webhook &&
        sourceConnection.details.webhook
      ) {
        if (properties.includes(CopyableSetting.WebhookName)) {
          currentConnection.details.webhook.name =
            sourceConnection.details.webhook.name;
        }

        if (properties.includes(CopyableSetting.WebhookIconUrl)) {
          currentConnection.details.webhook.iconUrl =
            sourceConnection.details.webhook.iconUrl;
        }

        if (properties.includes(CopyableSetting.WebhookThread)) {
          currentConnection.details.webhook.threadId =
            sourceConnection.details.webhook.threadId;
        }
      }

      if (properties.includes(CopyableSetting.PlaceholderLimits)) {
        currentConnection.details.placeholderLimits =
          sourceConnection.details.placeholderLimits;
      }

      if (properties.includes(CopyableSetting.Content)) {
        currentConnection.details.content = sourceConnection.details.content;
      }

      if (properties.includes(CopyableSetting.ContentFormatTables)) {
        currentConnection.details.formatter.disableImageLinkPreviews =
          sourceConnection.details.formatter.disableImageLinkPreviews;
      }

      if (properties.includes(CopyableSetting.ContentStripImages)) {
        currentConnection.details.formatter.formatTables =
          sourceConnection.details.formatter.formatTables;
      }

      if (
        properties.includes(CopyableSetting.ContentDisableImageLinkPreviews)
      ) {
        currentConnection.details.formatter.stripImages =
          sourceConnection.details.formatter.stripImages;
      }

      if (properties.includes(CopyableSetting.IgnoreNewLines)) {
        currentConnection.details.formatter.ignoreNewLines =
          sourceConnection.details.formatter.ignoreNewLines;
      }

      if (properties.includes(CopyableSetting.Components)) {
        currentConnection.details.componentRows =
          sourceConnection.details.componentRows;
      }

      if (properties.includes(CopyableSetting.ForumThreadTitle)) {
        currentConnection.details.forumThreadTitle =
          sourceConnection.details.forumThreadTitle;
      }

      if (properties.includes(CopyableSetting.ForumThreadTags)) {
        currentConnection.details.forumThreadTags =
          sourceConnection.details.forumThreadTags;
      }

      if (properties.includes(CopyableSetting.placeholderFallbackSetting)) {
        currentConnection.details.enablePlaceholderFallback =
          sourceConnection.details.enablePlaceholderFallback;
      }

      if (properties.includes(CopyableSetting.Filters)) {
        currentConnection.filters = sourceConnection.filters;
      }

      if (properties.includes(CopyableSetting.SplitOptions)) {
        currentConnection.splitOptions = sourceConnection.splitOptions;
      }

      if (properties.includes(CopyableSetting.CustomPlaceholders)) {
        currentConnection.customPlaceholders =
          sourceConnection.customPlaceholders;
      }

      if (properties.includes(CopyableSetting.DeliveryRateLimits)) {
        currentConnection.rateLimits = sourceConnection.rateLimits;
      }

      if (properties.includes(CopyableSetting.MessageMentions)) {
        currentConnection.mentions = sourceConnection.mentions;
      }

      if (
        properties.includes(CopyableSetting.Channel) &&
        sourceConnection.details.channel &&
        currentConnection.details.channel
      ) {
        currentConnection.details.channel = sourceConnection.details.channel;
      }
    }

    await foundFeed.save();
  }

  async updateDiscordChannelConnection(
    feedId: string,
    connectionId: string,
    {
      accessToken,
      feed,
      oldConnection,
      updates,
    }: UpdateDiscordChannelConnectionInput
  ): Promise<DiscordChannelConnection> {
    const setRecordDetails: Partial<DiscordChannelConnection["details"]> =
      Object.entries(updates.details || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`connections.discordChannels.$.details.${key}`]: value,
        }),
        {}
      );

    let createdApplicationWebhookId: string | undefined = undefined;

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
    } else if (
      updates.details?.webhook ||
      updates.details?.applicationWebhook
    ) {
      const threadId =
        updates.details.webhook?.threadId ||
        updates.details.applicationWebhook?.threadId;
      const name =
        updates.details.webhook?.name ||
        updates.details.applicationWebhook?.name;
      const iconUrl =
        updates.details.webhook?.iconUrl ||
        updates.details.applicationWebhook?.iconUrl;
      const benefits = await this.supportersService.getBenefitsOfDiscordUser(
        feed.user.discordUserId
      );

      if (!benefits.isSupporter) {
        throw new InsufficientSupporterLevelException(
          "User must be a supporter to add webhooks"
        );
      }

      let webhook: DiscordWebhook;
      let channel: DiscordGuildChannel;

      if (updates.details.webhook) {
        ({ webhook, channel } = await this.assertDiscordWebhookCanBeUsed(
          updates.details.webhook.id,
          accessToken
        ));
      } else if (updates.details.applicationWebhook) {
        // When converting a regular webhook to application webhook
        const { channel: fetchedChannel } =
          await this.assertDiscordChannelCanBeUsed(
            accessToken,
            updates.details.applicationWebhook.channelId
          );
        channel = fetchedChannel;

        webhook = await this.getOrCreateApplicationWebhook({
          channelId: channel.id,
          webhook: {
            name: `feed-${feedId}-${connectionId}`,
          },
        });

        createdApplicationWebhookId = webhook.id;
      } else {
        throw new Error(
          "Missing input webhook or application webhook in webhook condition when updating connection"
        );
      }

      let type: FeedConnectionDiscordWebhookType | undefined = undefined;

      if (threadId) {
        const { channel: threadChannel } =
          await this.assertDiscordChannelCanBeUsed(accessToken, threadId);

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
        iconUrl,
        id: webhook.id,
        name,
        token: webhook.token as string,
        guildId: channel.guild_id,
        type,
        threadId,
        channelId: channel.id,
        isApplicationOwned: !!updates.details.applicationWebhook,
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

    if (updates.customPlaceholders) {
      // There is a strange bug there the steps are only being saved with IDs
      for (let i = 0; i < updates.customPlaceholders.length; ++i) {
        const steps = updates.customPlaceholders[i].steps;

        for (let j = 0; j < steps.length; ++j) {
          const step = steps[j];

          if (step.id && Object.keys(step).length === 1) {
            logger.error(`Custom placeholder only has step ID`, {
              customPlaceholders: updates.customPlaceholders,
              findQuery,
            });
            throw new Error(`Custom placeholder only has step ID`);
          }
        }
      }
    }

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
          [`connections.discordChannels.$.disabledDetail`]: "",
        }),
        ...(updates.splitOptions === null && {
          [`connections.discordChannels.$.splitOptions`]: "",
        }),
      },
    };

    try {
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

      if (
        createdApplicationWebhookId &&
        oldConnection.details.webhook?.isApplicationOwned
      ) {
        try {
          // Changed webhooks, should attempt to cleanup old one
          await this.cleanupWebhook(oldConnection.details.webhook.id);
        } catch (err) {
          logger.error(
            `Failed to cleanup application webhook ${oldConnection.details.webhook.id} on feed ${feedId}, discord channel connection ${connectionId}  after update`,
            err
          );
        }
      }

      return updatedConnection;
    } catch (err) {
      if (createdApplicationWebhookId) {
        await this.cleanupWebhook(createdApplicationWebhookId);
      }

      throw err;
    }
  }

  async deleteConnection(feedId: string, connectionId: string) {
    const userFeed = await this.userFeedModel
      .findById(feedId)
      .select("connections")
      .lean();

    const connectionToDelete = userFeed?.connections.discordChannels.find((c) =>
      c.id.equals(connectionId)
    );

    if (!userFeed || !connectionToDelete) {
      throw new Error(
        `Connection ${connectionId} on feed ${feedId} does not exist to be deleted`
      );
    }

    const updated = await this.userFeedModel.findOneAndUpdate(
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

    if (!updated) {
      throw new Error(
        `Connection ${connectionId} on feed ${feedId} does not exist to be deleted`
      );
    }

    await this.connectionEventsService.handleDeletedEvent({
      feed: updated,
      deletedConnectionIds: [new Types.ObjectId(connectionId)],
    });

    try {
      if (connectionToDelete.details.webhook?.isApplicationOwned) {
        await this.cleanupWebhook(connectionToDelete.details.webhook.id);
      }
    } catch (err) {
      logger.error(
        `Failed to cleanup application webhook ${connectionToDelete.details.webhook?.id} on feed ${feedId}, discord channel connection ${connectionId} after connection deletion`,
        err
      );
    }
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
    let useExternalProperties =
      previewInput?.externalProperties || userFeed.externalProperties;
    const hasPremiumFeatures =
      previewInput?.customPlaceholders?.length ||
      previewInput?.externalProperties?.length;

    if (hasPremiumFeatures) {
      const { allowCustomPlaceholders, allowExternalProperties } =
        await this.supportersService.getBenefitsOfDiscordUser(
          userFeed.user.discordUserId
        );

      if (!allowCustomPlaceholders) {
        useCustomPlaceholders = [];
      }

      if (!allowExternalProperties) {
        useExternalProperties = [];
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

    const user = await this.userModel
      .findOne(
        {
          discordUserId: userFeed.user.discordUserId,
        },
        {
          preferences: 1,
        }
      )
      .lean();

    const payload: SendTestDiscordChannelArticleInput["details"] = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          ...userFeed.formatOptions,
          ...previewInput?.feedFormatOptions,
          dateFormat:
            previewInput?.feedFormatOptions?.dateFormat ||
            userFeed.formatOptions?.dateFormat ||
            user?.preferences?.dateFormat,
          dateTimezone:
            previewInput?.feedFormatOptions?.dateTimezone ||
            userFeed.formatOptions?.dateTimezone ||
            user?.preferences?.dateTimezone,
          dateLocale:
            previewInput?.feedFormatOptions?.dateLocale ||
            userFeed.formatOptions?.dateLocale ||
            user?.preferences?.dateLocale,
        },
        externalProperties: useExternalProperties,
        requestLookupDetails: userFeed.feedRequestLookupKey
          ? {
              key: userFeed.feedRequestLookupKey,
            }
          : undefined,
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
        components: castDiscordComponentRowsForMedium(
          previewInput?.componentRows || connection.details.componentRows
        ),
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
    includeCustomPlaceholderPreviews,
    externalProperties,
  }: CreatePreviewInput) {
    const user = await this.usersService.getOrCreateUserByDiscordId(
      userFeed.user.discordUserId
    );

    const payload: CreateDiscordChannelPreviewInput["details"] = {
      type: "discord",
      includeCustomPlaceholderPreviews,
      feed: {
        requestLookupDetails: getFeedRequestLookupDetails({
          feed: userFeed,
          user,
          decryptionKey: this.configService.get(
            "BACKEND_API_ENCRYPTION_KEY_HEX"
          ),
        }),
        url: userFeed.url,
        formatOptions: {
          ...feedFormatOptions,
          dateFormat:
            feedFormatOptions?.dateFormat || user?.preferences?.dateFormat,
          dateTimezone:
            feedFormatOptions?.dateTimezone || user?.preferences?.dateTimezone,
          dateLocale:
            feedFormatOptions?.dateLocale || user?.preferences?.dateLocale,
        },
        externalProperties,
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
        customPlaceholders,
        placeholderLimits,
        enablePlaceholderFallback: enablePlaceholderFallback,
        components: castDiscordComponentRowsForMedium(componentRows),
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
    try {
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

      const channel = await this.discordApiService.getChannel(
        webhook.channel_id
      );

      return { webhook, channel };
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        err.statusCode === HttpStatus.FORBIDDEN
      ) {
        throw new WebhookMissingPermissionsException(
          `Bot is missing permissions to retrieve webhook ${id} (likely manage webhooks permission)`
        );
      }

      throw err;
    }
  }

  private async getOrCreateApplicationWebhook({
    channelId,
    webhook: { name },
  }: {
    channelId: string;
    webhook: {
      name: string;
    };
  }) {
    try {
      const channelWebhooks =
        await this.discordWebhooksService.getWebhooksOfChannel(channelId, {
          onlyApplicationOwned: true,
        });

      if (channelWebhooks[0]) {
        // Use an existing application-owned webhook if it exists
        return channelWebhooks[0];
      } else {
        // Otherwise create a new one
        return await this.discordWebhooksService.createWebhook(channelId, {
          name,
        });
      }
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        err.statusCode === HttpStatus.FORBIDDEN
      ) {
        throw new WebhookMissingPermissionsException(
          `Bot is missing permissions to create webhook on channel ${channelId} (likely manage webhooks permission)`
        );
      }

      throw err;
    }
  }

  private async cleanupWebhook(webhookId: string) {
    const existingFeedUseCount = await this.userFeedModel.countDocuments({
      "connections.discordChannels.details.webhook.id": webhookId,
    });

    if (existingFeedUseCount === 0) {
      await this.discordWebhooksService.deleteWebhook(webhookId);

      return;
    }

    if (existingFeedUseCount > 1) {
      return;
    }

    const found = await this.userFeedModel.findOne({
      "connections.discordChannels.details.webhook.id": webhookId,
    });

    if (!found) {
      return;
    }

    const connectionUseCount = await found.connections.discordChannels.filter(
      (c) => c.details.webhook?.id === webhookId
    ).length;

    if (connectionUseCount === 0) {
      await this.discordWebhooksService.deleteWebhook(webhookId);
    }
  }
}
