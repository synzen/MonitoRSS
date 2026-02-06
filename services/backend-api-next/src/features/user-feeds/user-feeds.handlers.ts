import type { FastifyRequest, FastifyReply } from "fastify";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ApiErrorCode,
} from "../../infra/error-handler";

dayjs.extend(utc);
dayjs.extend(timezone);
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import { CustomPlaceholderStepType } from "../../repositories/shared/enums";
import { UserFeedManagerStatus } from "../../repositories/shared/enums";
import { convertToNestedDiscordEmbed } from "../../shared/utils/convert-to-nested-discord-embed";
import type {
  CreateUserFeedBody,
  DeduplicateFeedUrlsBody,
  GetUserFeedParams,
  ValidateUrlBody,
  UpdateUserFeedsBody,
  UpdateUserFeedBody,
} from "./user-feeds.schemas";
import { UpdateUserFeedsOp } from "./user-feeds.schemas";

export async function deduplicateFeedUrlsHandler(
  request: FastifyRequest<{ Body: DeduplicateFeedUrlsBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { discordUserId } = request;

  const urls = await userFeedsService.deduplicateFeedUrls(
    discordUserId,
    request.body.urls,
  );

  return reply.status(200).send({ result: { urls } });
}

export async function createUserFeedHandler(
  request: FastifyRequest<{ Body: CreateUserFeedBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService, supportersService } = request.container;
  const { discordUserId, accessToken } = request;

  const feed = await userFeedsService.addFeed(
    {
      discordUserId,
      userAccessToken: accessToken.access_token,
    },
    {
      url: request.body.url,
      title: request.body.title,
      sourceFeedId: request.body.sourceFeedId,
    },
  );

  const formatted = await formatUserFeedResponse(
    feed,
    discordUserId,
    supportersService,
  );

  return reply.status(201).send({ result: formatted });
}

interface SupportersServiceForFormat {
  defaultRefreshRateSeconds: number;
  defaultSupporterRefreshRateSeconds: number;
  areSupportersEnabled(): Promise<boolean | undefined>;
  getBenefitsOfDiscordUser(
    discordUserId: string,
  ): Promise<{ refreshRateSeconds: number }>;
}

export async function formatUserFeedResponse(
  feed: IUserFeed,
  discordUserId: string,
  supportersService: SupportersServiceForFormat,
) {
  const discordChannelConnections = feed.connections.discordChannels.map(
    (con) => ({
      id: con.id,
      name: con.name,
      key: "discord-channel" as const,
      details: {
        ...con.details,
        embeds: convertToNestedDiscordEmbed(con.details.embeds),
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
    }),
  );

  const isOwner = feed.user.discordUserId === discordUserId;

  const userInviteId = feed.shareManageOptions?.invites?.find(
    (u) =>
      u.discordUserId === discordUserId &&
      u.status === UserFeedManagerStatus.Accepted,
  )?.id;

  const refreshRateOptions: Array<{
    rateSeconds: number;
    disabledCode?: string;
  }> = [
    { rateSeconds: supportersService.defaultRefreshRateSeconds },
    { rateSeconds: supportersService.defaultRefreshRateSeconds * 6 },
  ];

  if (await supportersService.areSupportersEnabled()) {
    const feedOwnerBenefits = await supportersService.getBenefitsOfDiscordUser(
      feed.user.discordUserId,
    );

    refreshRateOptions.unshift({
      rateSeconds: supportersService.defaultSupporterRefreshRateSeconds,
      disabledCode:
        feedOwnerBenefits.refreshRateSeconds >=
        supportersService.defaultRefreshRateSeconds
          ? "INSUFFICIENT_SUPPORTER_TIER"
          : undefined,
    });
  }

  return {
    id: feed.id,
    sharedAccessDetails: userInviteId ? { inviteId: userInviteId } : undefined,
    title: feed.title,
    url: feed.url,
    inputUrl: feed.inputUrl,
    connections: [...discordChannelConnections],
    disabledCode: feed.disabledCode,
    healthStatus: feed.healthStatus,
    passingComparisons: feed.passingComparisons,
    blockingComparisons: feed.blockingComparisons,
    externalProperties: feed.externalProperties,
    createdAt: feed.createdAt.toISOString(),
    updatedAt: feed.updatedAt.toISOString(),
    formatOptions: feed.formatOptions,
    dateCheckOptions: feed.dateCheckOptions,
    refreshRateSeconds:
      feed.refreshRateSeconds ||
      (
        await supportersService.getBenefitsOfDiscordUser(
          feed.user.discordUserId,
        )
      ).refreshRateSeconds,
    userRefreshRateSeconds: feed.userRefreshRateSeconds,
    shareManageOptions: isOwner ? feed.shareManageOptions : undefined,
    refreshRateOptions,
  };
}

export async function validateFeedUrlHandler(
  request: FastifyRequest<{ Body: ValidateUrlBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { discordUserId } = request;

  const result = await userFeedsService.validateFeedUrl(
    { discordUserId },
    { url: request.body.url },
  );

  return reply.status(200).send({ result });
}

export async function updateUserFeedsHandler(
  request: FastifyRequest<{ Body: UpdateUserFeedsBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService, userFeedRepository, usersService, config } =
    request.container;
  const { discordUserId } = request;
  const { op, data } = request.body;
  const requestedFeedIds = [...new Set(data.feeds.map((f) => f.id))];

  if (!userFeedRepository.areAllValidIds(requestedFeedIds)) {
    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  const existingCount = await userFeedRepository.countByIds(requestedFeedIds);

  if (existingCount !== requestedFeedIds.length) {
    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const authorizedFeedIds = isAdmin
    ? requestedFeedIds
    : await userFeedRepository.filterFeedIdsByOwnership(
        requestedFeedIds,
        discordUserId,
      );

  if (op === UpdateUserFeedsOp.BulkDelete) {
    const results = await userFeedsService.bulkDelete(authorizedFeedIds);
    return reply.status(200).send({ results });
  }

  if (op === UpdateUserFeedsOp.BulkDisable) {
    const results = await userFeedsService.bulkDisable(authorizedFeedIds);
    return reply.status(200).send({ results });
  }

  if (op === UpdateUserFeedsOp.BulkEnable) {
    const results = await userFeedsService.bulkEnable(authorizedFeedIds);
    return reply.status(200).send({ results });
  }

  throw new BadRequestError(ApiErrorCode.INVALID_REQUEST);
}

export async function getUserFeedHandler(
  request: FastifyRequest<{ Params: GetUserFeedParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedRepository, usersService, supportersService, config } =
    request.container;
  const { discordUserId } = request;
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

  const acceptedInvite = feed.shareManageOptions?.invites?.find(
    (inv) =>
      inv.discordUserId === discordUserId &&
      inv.status === UserFeedManagerStatus.Accepted,
  );

  if (acceptedInvite?.connections?.length) {
    const allowedConnectionIds = new Set(
      acceptedInvite.connections.map((c) => c.connectionId),
    );

    feed.connections.discordChannels = feed.connections.discordChannels.filter(
      (ch) => allowedConnectionIds.has(ch.id),
    );
  }

  const formatted = await formatUserFeedResponse(
    feed,
    discordUserId,
    supportersService,
  );

  return reply.status(200).send({ result: formatted });
}

export async function updateUserFeedHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Body: UpdateUserFeedBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const {
    userFeedRepository,
    userFeedsService,
    usersService,
    supportersService,
    config,
  } = request.container;
  const { discordUserId } = request;
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

  const dateTimezone = request.body.formatOptions?.dateTimezone;

  if (dateTimezone) {
    try {
      dayjs.tz(undefined, dateTimezone);
    } catch {
      throw new BadRequestError(
        ApiErrorCode.VALIDATION_FAILED,
        "Invalid timezone",
      );
    }
  }

  if (request.body.externalProperties) {
    const labels = request.body.externalProperties.map((p) => p.label);

    if (new Set(labels).size !== labels.length) {
      throw new BadRequestError(
        ApiErrorCode.VALIDATION_FAILED,
        "External properties must have unique labels",
      );
    }
  }

  const updated = await userFeedsService.updateFeedById(
    { id: feedId, disabledCode: feed.disabledCode },
    request.body as Parameters<typeof userFeedsService.updateFeedById>[1],
  );

  const acceptedInvite = updated!.shareManageOptions?.invites?.find(
    (inv) =>
      inv.discordUserId === discordUserId &&
      inv.status === UserFeedManagerStatus.Accepted,
  );

  if (acceptedInvite?.connections?.length) {
    const allowedConnectionIds = new Set(
      acceptedInvite.connections.map((c) => c.connectionId),
    );

    updated!.connections.discordChannels =
      updated!.connections.discordChannels.filter((ch) =>
        allowedConnectionIds.has(ch.id),
      );
  }

  const formatted = await formatUserFeedResponse(
    updated!,
    discordUserId,
    supportersService,
  );

  return reply.status(200).send({ result: formatted });
}

export async function deleteUserFeedHandler(
  request: FastifyRequest<{ Params: GetUserFeedParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedRepository, userFeedsService, usersService, config } =
    request.container;
  const { discordUserId } = request;
  const { feedId } = request.params;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndCreator(feedId, discordUserId);

  if (!feed) {
    if (!isAdmin) {
      const feedByOwnership = await userFeedRepository.findByIdAndOwnership(
        feedId,
        discordUserId,
      );

      if (feedByOwnership) {
        throw new ForbiddenError(
          ApiErrorCode.MISSING_SHARED_MANAGER_PERMISSIONS,
        );
      }
    }

    throw new NotFoundError(ApiErrorCode.FEED_NOT_FOUND);
  }

  await userFeedsService.deleteFeedById(feedId);

  return reply.status(204).send();
}
