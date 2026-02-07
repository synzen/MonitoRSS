import type { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ApiErrorCode } from "../../infra/error-handler";
import { FeedConnectionType } from "../../repositories/shared/enums";
import type { IFeedEmbed } from "../../repositories/interfaces/feed-embed.types";
import type {
  CreateConnectionParams,
  CreateDiscordChannelConnectionBody,
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
