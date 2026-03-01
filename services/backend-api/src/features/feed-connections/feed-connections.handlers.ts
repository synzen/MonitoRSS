import type { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ApiErrorCode } from "../../infra/error-handler";
import {
  FeedConnectionType,
  FeedConnectionDisabledCode,
  CustomPlaceholderStepType,
} from "../../repositories/shared/enums";
import { CannotEnableAutoDisabledConnection } from "../../shared/exceptions/feed-connections.exceptions";
import type { IFeedEmbed } from "../../repositories/interfaces/feed-embed.types";
import type { IDiscordChannelConnection } from "../../repositories/interfaces/feed-connection.types";
import { convertToFlatDiscordEmbeds } from "../../shared/utils/convert-to-flat-discord-embeds";
import { convertToNestedDiscordEmbed } from "../../shared/utils/convert-to-nested-discord-embed";
import type {
  SendTestArticlePreviewInput,
  CopyableSetting,
  CreatePreviewFunctionInput,
  UpdateDiscordChannelConnectionDetailsInput,
} from "../../services/feed-connections-discord-channels/types";
import { UserFeedTargetFeedSelectionType } from "../../services/feed-connections-discord-channels/types";
import type {
  CreateConnectionParams,
  CreateDiscordChannelConnectionBody,
  ConnectionActionParams,
  SendConnectionTestArticleBody,
  CopyConnectionSettingsBody,
  CloneConnectionBody,
  CreatePreviewBody,
  CreateTemplatePreviewBody,
  UpdateDiscordChannelConnectionBody,
} from "./feed-connections.schemas";

export function formatDiscordChannelConnectionResponse(
  con: IDiscordChannelConnection,
) {
  return {
    id: con.id,
    name: con.name,
    key: FeedConnectionType.DiscordChannel as const,
    details: {
      ...con.details,
      embeds: convertToNestedDiscordEmbed(con.details.embeds),
      formatter: con.details.formatter ?? {},
      webhook: con.details.webhook
        ? {
            id: con.details.webhook.id,
            guildId: con.details.webhook.guildId,
            iconUrl: con.details.webhook.iconUrl,
            name: con.details.webhook.name,
            type: con.details.webhook.type,
            threadId: con.details.webhook.threadId,
            isApplicationOwned: con.details.webhook.isApplicationOwned,
            channelId: con.details.webhook.channelId,
          }
        : undefined,
      componentRows:
        con.details.componentRows?.map((r) => ({
          ...r,
          components: r.components || [],
        })) || [],
    },
    filters: con.filters,
    rateLimits: con.rateLimits,
    disabledCode: con.disabledCode,
    splitOptions: con.splitOptions,
    mentions: con.mentions,
    customPlaceholders: con.customPlaceholders?.map((c) => ({
      ...c,
      steps: c.steps.map((s) => {
        if (s.type === CustomPlaceholderStepType.Regex) {
          return {
            ...s,
            regexSearchFlags: s.regexSearchFlags || "gmi",
          };
        }
        return s;
      }),
    })),
  };
}

export async function deleteDiscordChannelConnectionHandler(
  request: FastifyRequest<{
    Params: ConnectionActionParams;
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
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
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

  await feedConnectionsDiscordChannelsService.deleteConnection(
    feedId,
    connectionId,
  );

  return reply.status(204).send();
}

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
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
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
        embeds: convertToFlatDiscordEmbeds(embeds),
        componentsV2: componentsV2 ?? undefined,
        placeholderLimits,
        formatter: formatter || undefined,
      },
    });

  return reply.status(201).send({
    result: formatDiscordChannelConnectionResponse(connection),
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
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
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
        content: body.content ?? undefined,
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

export async function copyConnectionSettingsHandler(
  request: FastifyRequest<{
    Params: ConnectionActionParams;
    Body: CopyConnectionSettingsBody;
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
  const { feedId, connectionId } = request.params;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
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

  const { properties, targetDiscordChannelConnectionIds } = request.body;

  await feedConnectionsDiscordChannelsService.copySettings(feed, connection, {
    properties: properties as CopyableSetting[],
    targetDiscordChannelConnectionIds,
    accessToken: accessToken.access_token,
  });

  return reply.status(204).send();
}

export async function cloneConnectionHandler(
  request: FastifyRequest<{
    Params: ConnectionActionParams;
    Body: CloneConnectionBody;
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
  const { feedId, connectionId } = request.params;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
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

  const {
    name,
    channelId,
    targetFeedIds,
    targetFeedSelectionType,
    targetFeedSearch,
  } = request.body;

  const result = await feedConnectionsDiscordChannelsService.cloneConnection(
    connection,
    {
      name,
      channelId,
      targetFeedIds,
      targetFeedSelectionType:
        (targetFeedSelectionType as
          | UserFeedTargetFeedSelectionType
          | undefined) ?? UserFeedTargetFeedSelectionType.All,
      targetFeedSearch,
    },
    accessToken.access_token,
    discordUserId,
  );

  return reply.status(200).send({ result });
}

export async function createPreviewHandler(
  request: FastifyRequest<{
    Params: ConnectionActionParams;
    Body: CreatePreviewBody;
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
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
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

  const result = await feedConnectionsDiscordChannelsService.createPreview({
    userFeed: feed,
    connection,
    articleId: body.article?.id,
    content: body.content ?? undefined,
    embeds: body.embeds,
    channelNewThreadTitle: body.channelNewThreadTitle,
    channelNewThreadExcludesPreview: body.channelNewThreadExcludesPreview,
    componentRows:
      body.componentRows as CreatePreviewFunctionInput["componentRows"],
    forumThreadTitle: body.forumThreadTitle,
    forumThreadTags:
      body.forumThreadTags as CreatePreviewFunctionInput["forumThreadTags"],
    splitOptions: body.splitOptions ?? undefined,
    mentions: (body.mentions ??
      undefined) as CreatePreviewFunctionInput["mentions"],
    customPlaceholders:
      body.customPlaceholders as CreatePreviewFunctionInput["customPlaceholders"],
    externalProperties: body.externalProperties,
    placeholderLimits: body.placeholderLimits,
    connectionFormatOptions: body.connectionFormatOptions ?? undefined,
    feedFormatOptions: { ...feed.formatOptions, ...body.userFeedFormatOptions },
    enablePlaceholderFallback: body.enablePlaceholderFallback,
    includeCustomPlaceholderPreviews: body.includeCustomPlaceholderPreviews,
    componentsV2: body.componentsV2,
  });

  return reply.status(201).send({ result });
}

export async function createTemplatePreviewHandler(
  request: FastifyRequest<{
    Params: CreateConnectionParams;
    Body: CreateTemplatePreviewBody;
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
  const { feedId } = request.params;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const body = request.body;

  const result =
    await feedConnectionsDiscordChannelsService.createTemplatePreview({
      userFeed: feed,
      articleId: body.article.id,
      content: body.content,
      embeds: body.embeds,
      placeholderLimits: body.placeholderLimits,
      connectionFormatOptions: body.connectionFormatOptions ?? undefined,
      feedFormatOptions: {
        ...feed.formatOptions,
        ...body.userFeedFormatOptions,
      },
      enablePlaceholderFallback: body.enablePlaceholderFallback,
      componentsV2: body.componentsV2,
    });

  return reply.status(201).send({ result });
}

export async function updateDiscordChannelConnectionHandler(
  request: FastifyRequest<{
    Params: ConnectionActionParams;
    Body: UpdateDiscordChannelConnectionBody;
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
  const { feedId, connectionId } = request.params;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(feedId, discordUserId);

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
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

  let useDisabledCode: FeedConnectionDisabledCode | null | undefined =
    undefined;
  let useChannelId: string | undefined = body.channelId;
  let useApplicationWebhook: typeof body.applicationWebhook | undefined =
    undefined;

  if (connection.disabledCode) {
    if (connection.disabledCode === FeedConnectionDisabledCode.BadFormat) {
      if (body.disabledCode === null) {
        throw new CannotEnableAutoDisabledConnection();
      }
      if (
        body.content ||
        body.embeds?.length ||
        body.componentRows?.length ||
        body.componentsV2?.length
      ) {
        useDisabledCode = null;
      }
    } else if (connection.disabledCode === FeedConnectionDisabledCode.Manual) {
      if (body.disabledCode === null) {
        useDisabledCode = null;
      }
    } else if (
      connection.disabledCode === FeedConnectionDisabledCode.MissingPermissions
    ) {
      if (body.disabledCode === null) {
        if (connection.details.channel) {
          useChannelId = body.channelId || connection.details.channel.id;
          useDisabledCode = null;
        } else if (
          connection.details.webhook?.channelId &&
          connection.details.webhook.name
        ) {
          useApplicationWebhook = {
            channelId: connection.details.webhook.channelId,
            name: connection.details.webhook.name,
            iconUrl: connection.details.webhook.iconUrl,
            threadId: connection.details.webhook.threadId,
          };
          useDisabledCode = null;
        } else {
          throw new Error(
            "Unhandled case when attempting to enable connection due to missing permissions",
          );
        }
      }
    } else if (body.disabledCode === null) {
      throw new CannotEnableAutoDisabledConnection();
    }
  } else if (body.disabledCode === FeedConnectionDisabledCode.Manual) {
    useDisabledCode = FeedConnectionDisabledCode.Manual;
  }

  const details: UpdateDiscordChannelConnectionDetailsInput = {};

  if ("placeholderLimits" in body) {
    details.placeholderLimits = body.placeholderLimits;
  }

  if ("channelNewThreadTitle" in body) {
    details.channelNewThreadTitle = body.channelNewThreadTitle;
  }

  if ("channelNewThreadExcludesPreview" in body) {
    details.channelNewThreadExcludesPreview =
      body.channelNewThreadExcludesPreview;
  }

  if ("componentRows" in body) {
    details.componentRows = (body.componentRows as any) ?? undefined;
  }

  if ("componentsV2" in body) {
    details.componentsV2 = body.componentsV2 ?? undefined;
  }

  if ("embeds" in body) {
    details.embeds = convertToFlatDiscordEmbeds(body.embeds);
  }

  if ("content" in body) {
    details.content = body.content ?? undefined;
  }

  if ("formatter" in body) {
    details.formatter = body.formatter ?? undefined;
  }

  if ("forumThreadTitle" in body) {
    details.forumThreadTitle = body.forumThreadTitle;
  }

  if ("forumThreadTags" in body) {
    details.forumThreadTags = body.forumThreadTags;
  }

  if ("enablePlaceholderFallback" in body) {
    details.enablePlaceholderFallback = body.enablePlaceholderFallback;
  }

  if (useApplicationWebhook) {
    details.applicationWebhook = useApplicationWebhook;
  } else if ("applicationWebhook" in body) {
    details.applicationWebhook = body.applicationWebhook;
  } else if (useChannelId) {
    details.channel = { id: useChannelId };
  }

  const updatedConnection =
    await feedConnectionsDiscordChannelsService.updateDiscordChannelConnection(
      feedId,
      connectionId,
      {
        accessToken: accessToken.access_token,
        feed: {
          user: feed.user,
          connections: feed.connections,
        },
        oldConnection: connection,
        updates: {
          name: body.name,
          filters: body.filters,
          disabledCode: useDisabledCode,
          splitOptions: body.splitOptions,
          mentions: body.mentions as any,
          rateLimits: body.rateLimits,
          customPlaceholders: body.customPlaceholders as any,
          threadCreationMethod: body.threadCreationMethod,
          details,
        },
      },
    );

  return reply.status(200).send({
    result: formatDiscordChannelConnectionResponse(updatedConnection),
  });
}
