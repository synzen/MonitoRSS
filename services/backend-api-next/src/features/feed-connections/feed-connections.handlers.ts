import type { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ApiErrorCode } from "../../infra/error-handler";
import { FeedConnectionType } from "../../repositories/shared/enums";
import type { IFeedEmbed } from "../../repositories/interfaces/feed-embed.types";
import type { SendTestArticlePreviewInput } from "../../services/feed-connections-discord-channels/types";
import type {
  CreateConnectionParams,
  CreateDiscordChannelConnectionBody,
  ConnectionActionParams,
  SendConnectionTestArticleBody,
} from "./feed-connections.schemas";

export async function createDiscordChannelConnectionHandler(
  request: FastifyRequest<{
    Params: CreateConnectionParams;
    Body: CreateDiscordChannelConnectionBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const {
    userFeedRepository,
    feedConnectionsDiscordChannelsService,
    usersService,
    config,
  } = request.container;
  const { discordUserId, accessToken } = request;
  const { feedId } = request.params;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  const {
    name,
    channelId,
    webhook,
    applicationWebhook,
    threadCreationMethod,
    content,
    embeds,
    componentsV2,
    placeholderLimits,
    formatter,
  } = request.body;

  const connection =
    await feedConnectionsDiscordChannelsService.createDiscordChannelConnection({
      feed,
      name,
      channelId,
      webhook,
      applicationWebhook,
      userAccessToken: accessToken.access_token,
      userDiscordUserId: discordUserId,
      threadCreationMethod,
      templateData: {
        content,
        embeds: embeds as IFeedEmbed[] | undefined,
        componentsV2: componentsV2 ?? undefined,
        placeholderLimits,
        formatter: formatter || undefined,
      },
    });

  return reply.status(201).send({
    result: {
      id: connection.id,
      name: connection.name,
      key: FeedConnectionType.DiscordChannel,
      filters: connection.filters,
      details: {
        channel: connection.details.channel
          ? {
              id: connection.details.channel.id,
              guildId: connection.details.channel.guildId,
            }
          : undefined,
        webhook: connection.details.webhook
          ? {
              id: connection.details.webhook.id,
              guildId: connection.details.webhook.guildId,
            }
          : undefined,
        embeds: connection.details.embeds,
        content: connection.details.content,
      },
      splitOptions: connection.splitOptions,
    },
  });
}

export async function sendTestArticleHandler(
  request: FastifyRequest<{
    Params: ConnectionActionParams;
    Body: SendConnectionTestArticleBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const {
    userFeedRepository,
    feedConnectionsDiscordChannelsService,
    usersService,
    config,
  } = request.container;
  const { discordUserId } = request;
  const { feedId, connectionId } = request.params;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  const isOwner = feed.user.discordUserId === discordUserId;
  if (!isAdmin && !isOwner) {
    const invite = feed.shareManageOptions?.invites.find(
      (i) => i.discordUserId === discordUserId,
    );
    const allowedConnectionIds = invite?.connections?.map(
      (c) => c.connectionId,
    );

    if (
      allowedConnectionIds &&
      allowedConnectionIds.length > 0 &&
      !allowedConnectionIds.includes(connectionId)
    ) {
      throw new NotFoundError(ApiErrorCode.FEED_CONNECTION_NOT_FOUND);
    }
  }

  const connection = feed.connections.discordChannels.find(
    (c) => c.id === connectionId,
  );

  if (!connection) {
    throw new NotFoundError(ApiErrorCode.FEED_CONNECTION_NOT_FOUND);
  }

  const body = request.body;

  const result = await feedConnectionsDiscordChannelsService.sendTestArticle(
    feed,
    connection,
    {
      article: body.article,
      previewInput: {
        content: body.content,
        embeds: body.embeds,
        channelNewThreadTitle: body.channelNewThreadTitle,
        channelNewThreadExcludesPreview: body.channelNewThreadExcludesPreview,
        componentRows: body.componentRows as any,
        forumThreadTitle: body.forumThreadTitle,
        forumThreadTags: body.forumThreadTags as any,
        splitOptions: body.splitOptions ?? undefined,
        mentions: (body.mentions ??
          undefined) as SendTestArticlePreviewInput["mentions"],
        customPlaceholders:
          body.customPlaceholders as SendTestArticlePreviewInput["customPlaceholders"],
        externalProperties: body.externalProperties,
        placeholderLimits: body.placeholderLimits,
        connectionFormatOptions: body.connectionFormatOptions ?? undefined,
        feedFormatOptions: body.userFeedFormatOptions ?? undefined,
        enablePlaceholderFallback: body.enablePlaceholderFallback,
        componentsV2: body.componentsV2,
      },
    },
  );

  return reply.status(201).send({ result });
}
