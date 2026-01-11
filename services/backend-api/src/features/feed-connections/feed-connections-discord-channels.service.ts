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
  InvalidComponentsV2Exception,
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
import getFeedRequestLookupDetails from "../../utils/get-feed-request-lookup-details";
import { UsersService } from "../users/users.service";
import { ConfigService } from "@nestjs/config";
import { DiscordChannelMissingViewPermissionsException } from "./exceptions/discord-channel-missing-view-permissions.exception";
import { UserFeedTargetFeedSelectionType } from "../user-feeds/constants/target-feed-selection-type.type";
import { generateUserFeedOwnershipFilters } from "../user-feeds/utils/get-user-feed-ownership-filters.utils";
import { generateUserFeedSearchFilters } from "../user-feeds/utils/get-user-feed-search-filters.utils";

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
    threadCreationMethod?: "new-thread" | null;
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
      componentsV2?: DiscordChannelConnection["details"]["componentsV2"] | null;
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
      channelNewThreadTitle:
        | DiscordChannelConnection["details"]["channelNewThreadTitle"]
        | undefined;
      channelNewThreadExcludesPreview:
        | DiscordChannelConnection["details"]["channelNewThreadExcludesPreview"]
        | undefined;
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
  componentsV2?: DiscordChannelConnection["details"]["componentsV2"] | null;
  includeCustomPlaceholderPreviews?: boolean;
  channelNewThreadTitle?: DiscordChannelConnection["details"]["channelNewThreadTitle"];
  channelNewThreadExcludesPreview?:
    | DiscordChannelConnection["details"]["channelNewThreadExcludesPreview"];
}

interface CreateTemplatePreviewInput {
  userFeed: UserFeed;
  content?: string;
  embeds?: DiscordPreviewEmbed[];
  feedFormatOptions: UserFeed["formatOptions"] | null;
  connectionFormatOptions?:
    | DiscordChannelConnection["details"]["formatter"]
    | null;
  articleId?: string;
  placeholderLimits?:
    | DiscordChannelConnection["details"]["placeholderLimits"]
    | null;
  enablePlaceholderFallback?: boolean;
  componentsV2?: DiscordChannelConnection["details"]["componentsV2"] | null;
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
    threadCreationMethod,
    templateData,
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
    threadCreationMethod?: "new-thread";
    templateData?: {
      content?: string;
      embeds?: DiscordChannelConnection["details"]["embeds"];
      componentsV2?: DiscordChannelConnection["details"]["componentsV2"];
      placeholderLimits?: DiscordChannelConnection["details"]["placeholderLimits"];
      formatter?: DiscordChannelConnection["details"]["formatter"];
    };
  }): Promise<DiscordChannelConnection> {
    const connectionId = new Types.ObjectId();
    let channelToAdd: DiscordChannelConnection["details"]["channel"];
    let webhookToAdd: DiscordChannelConnection["details"]["webhook"];

    if (channelId) {
      const { channel, type, parentChannel } =
        await this.assertDiscordChannelCanBeUsed(
          userAccessToken,
          channelId,
          applicationWebhook ? true : false
        );

      channelToAdd = {
        id: channelId,
        type:
          threadCreationMethod === "new-thread"
            ? FeedConnectionDiscordChannelType.NewThread
            : type,
        guildId: channel.guild_id,
        parentChannelId: parentChannel?.id,
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
            applicationWebhook.channelId,
            true
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
        const { type: detectedType } = await this.assertDiscordChannelCanBeUsed(
          userAccessToken,
          threadId
        );

        if (detectedType === FeedConnectionDiscordChannelType.Thread) {
          type = FeedConnectionDiscordWebhookType.Thread;
        } else if (
          detectedType === FeedConnectionDiscordChannelType.ForumThread
        ) {
          type = FeedConnectionDiscordWebhookType.ForumThread;
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

    let validatedComponentsV2: DiscordChannelConnection["details"]["componentsV2"] =
      templateData?.componentsV2;

    if (templateData?.componentsV2) {
      const validationResult =
        await this.feedHandlerService.validateDiscordPayload({
          componentsV2: templateData.componentsV2,
        });

      if (!validationResult.valid) {
        throw new InvalidComponentsV2Exception(
          validationResult.errors.map(
            (e) => new InvalidComponentsV2Exception(e.message, e.path)
          )
        );
      }

      // Use the parsed payload which strips unknown fields
      // @ts-ignore
      validatedComponentsV2 = validationResult.data.componentsV2;
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
                embeds: templateData?.embeds || [],
                content: templateData?.content,
                componentsV2: validatedComponentsV2,
                placeholderLimits: templateData?.placeholderLimits,
                formatter: templateData?.formatter || undefined,
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

      await this.connectionEventsService.handleCreatedEvents([
        {
          feedId: feed._id.toHexString(),
          connectionId: createdConnection.id,
          creator: {
            discordUserId: userDiscordUserId,
          },
        },
      ]);

      return createdConnection;
    } catch (err) {
      if (webhookToAdd?.isApplicationOwned) {
        await this.cleanupWebhook(webhookToAdd.id);
      }

      throw err;
    }
  }

  async cloneConnection(
    connection: DiscordChannelConnection,
    {
      name,
      channelId: newChannelId,
      targetFeedIds,
      targetFeedSelectionType,
      targetFeedSearch,
    }: Omit<
      CreateDiscordChannelConnectionCloneInputDto,
      "targetFeedSelectionType"
    > & {
      targetFeedSelectionType: UserFeedTargetFeedSelectionType;
    },
    userAccessToken: string,
    userDiscordUserId: string
  ) {
    let channelDetailsToUse: DiscordChannelConnection["details"]["channel"] =
      connection.details.channel;

    if (newChannelId) {
      const channel = await this.assertDiscordChannelCanBeUsed(
        userAccessToken,
        newChannelId,
        connection.details.webhook?.id ? true : false
      );

      channelDetailsToUse = {
        id: newChannelId,
        type: channel.type,
        guildId: channel.channel.guild_id,
        parentChannelId: channel.parentChannel?.id,
      };
    }

    let newWebhookId: string | undefined = undefined;
    let newWebhookToken: string | undefined = undefined;

    if (connection.details.webhook?.isApplicationOwned) {
      const newWebhook = await this.getOrCreateApplicationWebhook({
        channelId: connection.details.webhook.channelId as string,
        webhook: {
          name: `monitorss-managed-connection`,
        },
      });

      newWebhookId = newWebhook.id;
      newWebhookToken = newWebhook.token as string;
    }

    const newConnectionIdsWithFeedIds: Array<[Types.ObjectId, Types.ObjectId]> =
      [];

    try {
      const feedQuery =
        targetFeedSelectionType === UserFeedTargetFeedSelectionType.Selected
          ? {
              _id: {
                $in: targetFeedIds?.map((id) => new Types.ObjectId(id)),
              },
            }
          : {
              $and: [
                generateUserFeedOwnershipFilters(userDiscordUserId) || {},
                {
                  ...(targetFeedSearch
                    ? { ...generateUserFeedSearchFilters(targetFeedSearch) }
                    : {}),
                },
              ],
            };

      const feedsToUpdate = await this.userFeedModel.find(feedQuery).cursor();
      const bulkWriteDocs: Parameters<typeof this.userFeedModel.bulkWrite>[0] =
        [];

      for await (const feed of feedsToUpdate) {
        const newConnectionId = new Types.ObjectId();
        newConnectionIdsWithFeedIds.push([newConnectionId, feed._id]);

        bulkWriteDocs.push({
          updateOne: {
            filter: {
              _id: feed._id,
            },
            update: {
              // @ts-ignore
              $push: {
                "connections.discordChannels": {
                  ...connection,
                  id: newConnectionId,
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
                      : null,
                  },
                },
              },
            },
          },
        });
      }

      await this.userFeedModel.bulkWrite(bulkWriteDocs);

      if (newConnectionIdsWithFeedIds.length) {
        await this.connectionEventsService.handleCreatedEvents(
          newConnectionIdsWithFeedIds.map(([connectionId, feedId]) => ({
            connectionId,
            creator: {
              discordUserId: userDiscordUserId,
            },
            feedId: feedId.toHexString(),
          }))
        );
      }
    } catch (err) {
      if (newWebhookId) {
        await this.cleanupWebhook(newWebhookId);
      }

      throw err;
    }

    return {
      ids: newConnectionIdsWithFeedIds.map(([connectionId]) => connectionId),
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

      if (properties.includes(CopyableSetting.ComponentsV2)) {
        currentConnection.details.componentsV2 =
          sourceConnection.details.componentsV2;
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
      const { channel, type, parentChannel } =
        await this.assertDiscordChannelCanBeUsed(
          accessToken,
          updates.details.channel.id
        );

      // @ts-ignore
      setRecordDetails["connections.discordChannels.$.details.channel"] = {
        id: updates.details.channel.id,
        guildId: channel.guild_id,
        type:
          updates.threadCreationMethod === "new-thread"
            ? FeedConnectionDiscordChannelType.NewThread
            : type,
        parentChannelId: parentChannel?.id,
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
            updates.details.applicationWebhook.channelId,
            true
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
        const { type: detectedType } = await this.assertDiscordChannelCanBeUsed(
          accessToken,
          threadId,
          true
        );

        if (detectedType === FeedConnectionDiscordChannelType.Thread) {
          type = FeedConnectionDiscordWebhookType.Thread;
        } else if (
          detectedType === FeedConnectionDiscordChannelType.ForumThread
        ) {
          type = FeedConnectionDiscordWebhookType.ForumThread;
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

    if (updates.details?.componentsV2) {
      const validationResult =
        await this.feedHandlerService.validateDiscordPayload({
          componentsV2: updates.details.componentsV2,
        });

      if (!validationResult.valid) {
        throw new InvalidComponentsV2Exception(
          validationResult.errors.map(
            (e) => new InvalidComponentsV2Exception(e.message, e.path)
          )
        );
      }

      // Use the parsed payload which strips unknown fields
      if (validationResult.data.componentsV2) {
        // @ts-ignore
        setRecordDetails["connections.discordChannels.$.details.componentsV2"] =
          validationResult.data.componentsV2;
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

    const user = await this.usersService.getOrCreateUserByDiscordId(
      userFeed.user.discordUserId
    );

    const requestLookupDetails = getFeedRequestLookupDetails({
      feed: userFeed,
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
      user,
    });

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
        requestLookupDetails: requestLookupDetails || undefined,
      },
      article: details?.article ? details.article : undefined,
      mediumDetails: {
        ...connection.details,
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
        formatter: {
          ...(previewInput?.connectionFormatOptions ||
            connection.details.formatter),
          connectionCreatedAt: connection.createdAt?.toISOString(),
        },
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
          previewInput?.componentRows
        ),
        componentsV2:
          previewInput?.content ||
          previewInput?.embeds?.length ||
          previewInput?.componentsV2 === null
            ? undefined
            : previewInput?.componentsV2 || connection.details.componentsV2,
        channelNewThreadTitle:
          previewInput?.channelNewThreadTitle ||
          connection.details.channelNewThreadTitle,
        channelNewThreadExcludesPreview:
          previewInput?.channelNewThreadExcludesPreview ??
          connection.details.channelNewThreadExcludesPreview,
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
    componentsV2,
    includeCustomPlaceholderPreviews,
    externalProperties,
    channelNewThreadTitle,
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
        channelNewThreadTitle,
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
        formatter: {
          ...connectionFormatOptions,
          connectionCreatedAt: connection.createdAt?.toISOString(),
        },
        splitOptions: splitOptions?.isEnabled ? splitOptions : undefined,
        mentions: mentions,
        customPlaceholders,
        placeholderLimits,
        enablePlaceholderFallback: enablePlaceholderFallback,
        components: castDiscordComponentRowsForMedium(componentRows),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        componentsV2: (componentsV2 as any) ?? undefined,
      },
    } as const;

    return this.feedHandlerService.createPreview({
      details: payload,
    });
  }

  async createTemplatePreview({
    userFeed,
    content,
    embeds,
    feedFormatOptions,
    connectionFormatOptions,
    articleId,
    placeholderLimits,
    enablePlaceholderFallback,
    componentsV2,
  }: CreateTemplatePreviewInput) {
    const user = await this.usersService.getOrCreateUserByDiscordId(
      userFeed.user.discordUserId
    );

    const payload: CreateDiscordChannelPreviewInput["details"] = {
      type: "discord",
      includeCustomPlaceholderPreviews: false,
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
        externalProperties: undefined,
      },
      article: articleId ? { id: articleId } : undefined,
      mediumDetails: {
        channel: undefined,
        webhook: undefined,
        guildId: "",
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
        formatter: {
          ...connectionFormatOptions,
          connectionCreatedAt: new Date().toISOString(),
        },
        splitOptions: undefined,
        mentions: undefined,
        customPlaceholders: undefined,
        placeholderLimits,
        enablePlaceholderFallback: enablePlaceholderFallback,
        components: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        componentsV2: (componentsV2 as any) ?? undefined,
      },
    };

    return this.feedHandlerService.createPreview({
      details: payload,
    });
  }

  private async assertDiscordChannelCanBeUsed(
    accessToken: string,
    channelId: string,
    skipBotPermissionAssertions = false
  ) {
    try {
      let parentChannel: DiscordGuildChannel | undefined = undefined;
      const channel = await this.feedsService.canUseChannel({
        channelId,
        userAccessToken: accessToken,
        skipBotPermissionAssertions,
      });

      let type: FeedConnectionDiscordChannelType | undefined = undefined;

      if (channel.type === DiscordChannelType.GUILD_FORUM) {
        type = FeedConnectionDiscordChannelType.Forum;
      } else if (
        channel.type === DiscordChannelType.PUBLIC_THREAD ||
        channel.type === DiscordChannelType.ANNOUNCEMENT_THREAD
      ) {
        type = FeedConnectionDiscordChannelType.Thread;

        const parentChannelId = channel.parent_id;

        if (parentChannelId) {
          parentChannel = await this.discordApiService.getChannel(
            parentChannelId
          );

          if (parentChannel.type === DiscordChannelType.GUILD_FORUM) {
            type = FeedConnectionDiscordChannelType.ForumThread;
          }
        }
      }

      return {
        channel,
        parentChannel,
        type,
      };
    } catch (err) {
      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingDiscordChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          if (skipBotPermissionAssertions) {
            // triggers a permission error around just viewing. Required for getting discord channels.
            throw new DiscordChannelMissingViewPermissionsException();
          } else {
            // triggers a permission error around viewing AND sending messages in the channel
            throw new DiscordChannelPermissionsException();
          }
        }
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
        !(
          await this.discordAuthService.userManagesGuild(
            accessToken,
            webhook.guild_id
          )
        ).isManager
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

  async sendTestArticleDirect(
    userFeed: UserFeed,
    input: {
      article: {
        id: string;
      };
      channelId: string;
      content?: string;
      embeds?: DiscordPreviewEmbed[];
      componentsV2?: Array<Record<string, unknown>>;
      placeholderLimits?: {
        placeholder: string;
        characterCount: number;
        appendString?: string;
      }[];
      webhook?: {
        name: string;
        iconUrl?: string;
      } | null;
      threadId?: string;
      userFeedFormatOptions?: UserFeed["formatOptions"] | null;
    }
  ): Promise<SendTestArticleResult> {
    const user = await this.usersService.getOrCreateUserByDiscordId(
      userFeed.user.discordUserId
    );

    const requestLookupDetails = getFeedRequestLookupDetails({
      feed: userFeed,
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
      user,
    });

    const cleanedEmbeds = input.embeds
      ? input.embeds.map((e) => ({
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

    const { isSupporter } =
      await this.supportersService.getBenefitsOfDiscordUser(
        userFeed.user.discordUserId
      );

    let webhookDetails:
      | SendTestDiscordChannelArticleInput["details"]["mediumDetails"]["webhook"]
      | undefined;

    if (input.webhook && isSupporter) {
      const webhook = await this.getOrCreateApplicationWebhook({
        channelId: input.threadId || input.channelId,
        webhook: { name: `test-send-${userFeed._id}` },
      });

      webhookDetails = {
        id: webhook.id,
        token: webhook.token as string,
        name: input.webhook.name,
        iconUrl: input.webhook.iconUrl,
        threadId: input.threadId,
      };
    }

    const payload: SendTestDiscordChannelArticleInput["details"] = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          ...userFeed.formatOptions,
          ...input.userFeedFormatOptions,
          dateFormat:
            input.userFeedFormatOptions?.dateFormat ||
            userFeed.formatOptions?.dateFormat ||
            user?.preferences?.dateFormat,
          dateTimezone:
            input.userFeedFormatOptions?.dateTimezone ||
            userFeed.formatOptions?.dateTimezone ||
            user?.preferences?.dateTimezone,
          dateLocale:
            input.userFeedFormatOptions?.dateLocale ||
            userFeed.formatOptions?.dateLocale ||
            user?.preferences?.dateLocale,
        },
        externalProperties: userFeed.externalProperties,
        requestLookupDetails: requestLookupDetails || undefined,
      },
      article: input.article,
      mediumDetails: {
        components: [],
        channel: webhookDetails
          ? undefined
          : {
              id: input.threadId || input.channelId,
            },
        webhook: webhookDetails,
        content: castDiscordContentForMedium(input.content),
        embeds: castDiscordEmbedsForMedium(cleanedEmbeds || []),
        placeholderLimits: input.placeholderLimits,
        componentsV2:
          input.content || input.embeds?.length
            ? undefined
            : (input.componentsV2 as SendTestDiscordChannelArticleInput["details"]["mediumDetails"]["componentsV2"]),
        formatter: {
          connectionCreatedAt: new Date().toISOString(),
        },
      },
    } as const;

    return this.feedHandlerService.sendTestArticle({
      details: payload,
    });
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
