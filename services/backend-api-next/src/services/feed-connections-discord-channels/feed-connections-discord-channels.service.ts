import { Types } from "mongoose";
import {
  FeedConnectionsDiscordChannelsServiceDeps,
  CreateDiscordChannelConnectionInput,
  UpdateDiscordChannelConnectionInput,
  CloneConnectionInput,
  CopySettingsInput,
  UserFeedTargetFeedSelectionType,
} from "./types";
import { CopyableSetting } from "./types";
import type { IDiscordChannelConnection } from "../../repositories/interfaces/feed-connection.types";
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";
import {
  MissingDiscordChannelException,
  DiscordChannelPermissionsException,
  InvalidFilterExpressionException,
  FeedConnectionNotFoundException,
  DiscordChannelMissingViewPermissionsException,
  InsufficientSupporterLevelException,
  DiscordWebhookInvalidTypeException,
  DiscordWebhookNonexistentException,
  DiscordWebhookMissingUserPermException,
  InvalidDiscordChannelException,
} from "../../shared/exceptions/feed-connections.exceptions";
import {
  DiscordChannelType,
  DiscordGuildChannel,
  DiscordWebhook,
} from "../../shared/types/discord.types";
import {
  FeedConnectionDiscordChannelType,
  FeedConnectionDiscordWebhookType,
  FeedConnectionType,
} from "../../repositories/shared/enums";
import { WebhookMissingPermissionsException } from "../../shared/exceptions/discord-webhooks.exceptions";
import { InvalidComponentsV2Exception } from "../../shared/exceptions/invalid-components-v2.exception";
import logger from "../../infra/logger";

export class FeedConnectionsDiscordChannelsService {
  constructor(
    private readonly deps: FeedConnectionsDiscordChannelsServiceDeps,
  ) {}

  async createDiscordChannelConnection(
    input: CreateDiscordChannelConnectionInput,
  ): Promise<IDiscordChannelConnection> {
    const {
      feed,
      name,
      channelId,
      userAccessToken,
      userDiscordUserId,
      applicationWebhook,
      templateData,
      threadCreationMethod,
      webhook: inputWebhook,
    } = input;
    const connectionId = new Types.ObjectId();
    let channelToAdd: IDiscordChannelConnection["details"]["channel"];
    let webhookToAdd: IDiscordChannelConnection["details"]["webhook"];

    if (channelId) {
      const { channel, type, parentChannel } =
        await this.assertDiscordChannelCanBeUsed(
          userAccessToken,
          channelId,
          applicationWebhook ? true : false,
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
      const benefits =
        await this.deps.supportersService.getBenefitsOfDiscordUser(
          feed.user.discordUserId,
        );

      if (!benefits.isSupporter) {
        throw new InsufficientSupporterLevelException(
          "User must be a supporter to add webhooks",
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
          userAccessToken,
        ));
      } else if (applicationWebhook) {
        const { channel: fetchedChannel } =
          await this.assertDiscordChannelCanBeUsed(
            userAccessToken,
            applicationWebhook.channelId,
            true,
          );

        channel = fetchedChannel;
        webhook = await this.getOrCreateApplicationWebhook({
          channelId: channel.id,
          webhook: {
            name: `feed-${feed.id}-${connectionId}`,
          },
        });
      } else {
        throw new Error(
          "Missing input webhook or application webhook in webhook condition",
        );
      }

      if (!channel) {
        throw new MissingDiscordChannelException();
      }

      let type: FeedConnectionDiscordWebhookType | undefined = undefined;

      if (threadId) {
        const { type: detectedType } = await this.assertDiscordChannelCanBeUsed(
          userAccessToken,
          threadId,
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

    let validatedComponentsV2: IDiscordChannelConnection["details"]["componentsV2"] =
      templateData?.componentsV2;

    if (templateData?.componentsV2) {
      const validationResult =
        await this.deps.feedHandlerService.validateDiscordPayload({
          componentsV2: templateData.componentsV2,
        });

      if (!validationResult.valid) {
        throw new InvalidComponentsV2Exception(
          validationResult.errors.map(
            (e) => new InvalidComponentsV2Exception(e.message, e.path),
          ),
        );
      }

      // Use the parsed payload which strips unknown fields
      // @ts-ignore
      validatedComponentsV2 = validationResult.data.componentsV2;
    }

    try {
      const updated = await this.deps.userFeedRepository.findOneAndUpdate(
        {
          _id: new Types.ObjectId(feed.id),
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
        },
      );

      const createdConnection = updated?.connections.discordChannels.find(
        (connection) => connection.id === connectionId.toHexString(),
      );

      if (!createdConnection) {
        throw new Error(
          "Connection was not successfuly created. Check insertion statement and schemas are correct.",
        );
      }

      await this.deps.connectionEventsService.handleCreatedEvents([
        {
          feedId: feed.id,
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

  async updateDiscordChannelConnection(
    feedId: string,
    connectionId: string,
    {
      accessToken,
      feed,
      oldConnection,
      updates,
    }: UpdateDiscordChannelConnectionInput,
  ): Promise<IDiscordChannelConnection> {
    const setRecordDetails: Partial<IDiscordChannelConnection["details"]> =
      Object.entries(updates.details || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`connections.discordChannels.$.details.${key}`]: value,
        }),
        {},
      );

    let createdApplicationWebhookId: string | undefined = undefined;

    if (updates.details?.channel?.id) {
      const { channel, type, parentChannel } =
        await this.assertDiscordChannelCanBeUsed(
          accessToken,
          updates.details.channel.id,
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
      const benefits =
        await this.deps.supportersService.getBenefitsOfDiscordUser(
          feed.user.discordUserId,
        );

      if (!benefits.isSupporter) {
        throw new InsufficientSupporterLevelException(
          "User must be a supporter to add webhooks",
        );
      }

      let webhook: DiscordWebhook;
      let channel: DiscordGuildChannel;

      if (updates.details.webhook) {
        ({ webhook, channel } = await this.assertDiscordWebhookCanBeUsed(
          updates.details.webhook.id,
          accessToken,
        ));
      } else if (updates.details.applicationWebhook) {
        // When converting a regular webhook to application webhook
        const { channel: fetchedChannel } =
          await this.assertDiscordChannelCanBeUsed(
            accessToken,
            updates.details.applicationWebhook.channelId,
            true,
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
          "Missing input webhook or application webhook in webhook condition when updating connection",
        );
      }

      let type: FeedConnectionDiscordWebhookType | undefined = undefined;

      if (threadId) {
        const { type: detectedType } = await this.assertDiscordChannelCanBeUsed(
          accessToken,
          threadId,
          true,
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
      const { errors } = await this.deps.feedHandlerService.validateFilters({
        expression: updates.filters.expression,
      });

      if (errors.length) {
        throw new InvalidFilterExpressionException(
          errors.map(
            (message) => new InvalidFilterExpressionException(message),
          ),
        );
      }
    }

    if (updates.details?.componentsV2) {
      const validationResult =
        await this.deps.feedHandlerService.validateDiscordPayload({
          componentsV2: updates.details.componentsV2,
        });

      if (!validationResult.valid) {
        throw new InvalidComponentsV2Exception(
          validationResult.errors.map(
            (e) => new InvalidComponentsV2Exception(e.message, e.path),
          ),
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
      for (let i = 0; i < updates.customPlaceholders.length; ++i) {
        const placeholder = updates.customPlaceholders[i];
        if (!placeholder?.steps) {
          continue;
        }
        const steps = placeholder.steps;

        for (let j = 0; j < steps.length; ++j) {
          const step = steps[j];

          if (!step) {
            continue;
          }

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
      const updated = await this.deps.userFeedRepository.findOneAndUpdate(
        findQuery,
        updateQuery,
        {
          new: true,
        },
      );

      const updatedConnection = updated?.connections.discordChannels.find(
        (connection) => connection.id === connectionId,
      );

      if (!updatedConnection) {
        throw new Error(
          "Connection was not successfully updated." +
            " Check insertion statement and schemas are correct.",
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
            {
              error: err,
            },
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

  async deleteConnection(feedId: string, connectionId: string): Promise<void> {
    const feed = await this.deps.userFeedRepository.findById(feedId);

    if (!feed) {
      throw new FeedConnectionNotFoundException(`Feed ${feedId} not found`);
    }

    const connection = feed.connections.discordChannels.find(
      (c) => c.id === connectionId,
    );

    if (!connection) {
      throw new FeedConnectionNotFoundException(
        `Connection ${connectionId} not found in feed ${feedId}`,
      );
    }

    const result = await this.deps.userFeedRepository.updateById(feedId, {
      $pull: {
        "connections.discordChannels": { id: new Types.ObjectId(connectionId) },
      },
    });

    if (!result) {
      throw new Error(
        `Failed to delete connection ${connectionId} from feed ${feedId}`,
      );
    }

    await this.deps.connectionEventsService.handleDeletedEvent({
      feedId,
      deletedConnectionIds: [connectionId],
      shareManageOptions: feed.shareManageOptions,
    });

    if (connection.details.webhook?.isApplicationOwned) {
      await this.cleanupWebhook(connection.details.webhook.id);
    }
  }

  async cloneConnection(
    connection: IDiscordChannelConnection,
    input: CloneConnectionInput,
    userAccessToken: string,
    userDiscordUserId: string,
  ): Promise<{ ids: string[] }> {
    const {
      name,
      targetFeedIds,
      channelId: newChannelId,
      targetFeedSearch,
      targetFeedSelectionType,
    } = input;

    let channelDetailsToUse: IDiscordChannelConnection["details"]["channel"] =
      connection.details.channel;

    if (newChannelId) {
      const channel = await this.assertDiscordChannelCanBeUsed(
        userAccessToken,
        newChannelId,
        connection.details.webhook?.id ? true : false,
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

    const useSelectedFeeds =
      targetFeedSelectionType === UserFeedTargetFeedSelectionType.Selected ||
      (targetFeedIds && targetFeedIds.length > 0);

    const connectionData = {
      ...connection,
      name,
      details: {
        ...connection.details,
        channel: channelDetailsToUse,
        webhook: connection.details.webhook
          ? {
              ...connection.details.webhook,
              id: newWebhookId || connection.details.webhook.id,
              token: newWebhookToken || connection.details.webhook.token,
            }
          : null,
      },
    };

    try {
      const result = await this.deps.userFeedRepository.cloneConnectionToFeeds({
        targetFeedIds: useSelectedFeeds ? targetFeedIds : undefined,
        ownershipDiscordUserId: useSelectedFeeds
          ? undefined
          : userDiscordUserId,
        search: useSelectedFeeds ? undefined : targetFeedSearch,
        connectionData,
      });

      if (result.feedIdToConnectionId.length) {
        await this.deps.connectionEventsService.handleCreatedEvents(
          result.feedIdToConnectionId.map(({ feedId, connectionId }) => ({
            connectionId,
            creator: {
              discordUserId: userDiscordUserId,
            },
            feedId,
          })),
        );
      }

      return {
        ids: result.feedIdToConnectionId.map(
          ({ connectionId }) => connectionId,
        ),
      };
    } catch (err) {
      if (newWebhookId) {
        await this.cleanupWebhook(newWebhookId);
      }

      throw err;
    }
  }

  async copySettings(
    userFeed: IUserFeed,
    sourceConnection: IDiscordChannelConnection,
    { targetDiscordChannelConnectionIds, properties }: CopySettingsInput,
  ): Promise<void> {
    const foundFeed = await this.deps.userFeedRepository.findById(userFeed.id);

    if (!foundFeed) {
      throw new Error(`Could not find feed ${userFeed.id}`);
    }

    const relevantConnections = targetDiscordChannelConnectionIds.map((id) => {
      const connection = foundFeed?.connections.discordChannels.find(
        (c) => c.id === id,
      );

      if (!connection) {
        throw new Error(
          `Could not find connection ${id} on feed ${userFeed.id}`,
        );
      }

      return connection;
    });

    for (let i = 0; i < relevantConnections.length; ++i) {
      const currentConnection = relevantConnections[i];

      if (!currentConnection) {
        continue;
      }

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

    await this.deps.userFeedRepository.updateById(userFeed.id, {
      $set: {
        "connections.discordChannels": foundFeed.connections.discordChannels,
      },
    });
  }

  private async assertDiscordChannelCanBeUsed(
    accessToken: string,
    channelId: string,
    skipBotPermissionAssertions = false,
  ) {
    try {
      let parentChannel: DiscordGuildChannel | undefined = undefined;
      const channel = await this.deps.feedsService.canUseChannel({
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
          parentChannel =
            await this.deps.discordApiService.getChannel(parentChannelId);

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
        if (err.statusCode === 404) {
          throw new MissingDiscordChannelException();
        }

        if (err.statusCode === 403) {
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
    accessToken: string,
  ): Promise<{ webhook: DiscordWebhook; channel: DiscordGuildChannel }> {
    try {
      const webhook = await this.deps.discordWebhooksService.getWebhook(id);

      if (!webhook) {
        throw new DiscordWebhookNonexistentException(
          `Discord webohok ${id} does not exist`,
        );
      }

      if (!this.deps.discordWebhooksService.canBeUsedByBot(webhook)) {
        throw new DiscordWebhookInvalidTypeException(
          `Discord webhook ${id} is a different type and is not operable by bot to send messages`,
        );
      }

      if (
        !webhook.guild_id ||
        !(
          await this.deps.discordAuthService.userManagesGuild(
            accessToken,
            webhook.guild_id,
          )
        ).isManager
      ) {
        throw new DiscordWebhookMissingUserPermException(
          `User does not manage guild of webhook webhook ${id}`,
        );
      }

      const channel = await this.deps.discordApiService.getChannel(
        webhook.channel_id,
      );

      return { webhook, channel };
    } catch (err) {
      if (err instanceof DiscordAPIError && err.statusCode === 403) {
        throw new WebhookMissingPermissionsException();
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
        await this.deps.discordWebhooksService.getWebhooksOfChannel(channelId, {
          onlyApplicationOwned: true,
        });

      if (channelWebhooks[0]) {
        // Use an existing application-owned webhook if it exists
        return channelWebhooks[0];
      } else {
        // Otherwise create a new one
        return await this.deps.discordWebhooksService.createWebhook(channelId, {
          name,
        });
      }
    } catch (err) {
      if (err instanceof DiscordAPIError && err.statusCode === 403) {
        throw new WebhookMissingPermissionsException();
      }

      throw err;
    }
  }

  private async cleanupWebhook(webhookId: string) {
    const existingFeedUseCount =
      await this.deps.userFeedRepository.countByWebhookId(webhookId);

    if (existingFeedUseCount === 0) {
      await this.deps.discordWebhooksService.deleteWebhook(webhookId);

      return;
    }

    if (existingFeedUseCount > 1) {
      return;
    }

    const found =
      await this.deps.userFeedRepository.findOneByWebhookId(webhookId);

    if (!found) {
      return;
    }

    const connectionUseCount = found.connections.discordChannels.filter(
      (c) => c.details.webhook?.id === webhookId,
    ).length;

    if (connectionUseCount === 0) {
      await this.deps.discordWebhooksService.deleteWebhook(webhookId);
    }
  }
}
