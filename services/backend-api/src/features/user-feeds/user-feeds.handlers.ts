import type { FastifyRequest, FastifyReply } from "fastify";
import qs from "qs";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ApiErrorCode,
} from "../../infra/error-handler";
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import { UserFeedManagerStatus } from "../../repositories/shared/enums";
import { ManualRequestTooSoonException } from "../../shared/exceptions/user-feeds.exceptions";
import { formatDiscordChannelConnectionResponse } from "../feed-connections/feed-connections.handlers";
import type {
  CloneUserFeedBody,
  CopySettingsBody,
  CreateUserFeedBody,
  DatePreviewBody,
  DeduplicateFeedUrlsBody,
  DeliveryPreviewBody,
  GetArticlePropertiesBody,
  GetArticlesBody,
  GetDeliveryLogsQuery,
  GetFeedRequestsQuery,
  GetUserFeedParams,
  GetUserFeedsQuery,
  ValidateUrlBody,
  PreviewByUrlBody,
  UpdateUserFeedsBody,
  UpdateUserFeedBody,
  SendTestArticleBody,
} from "./user-feeds.schemas";
import { UpdateUserFeedsOp } from "./user-feeds.schemas";
import { UserFeedTargetFeedSelectionType } from "../../services/feed-connections-discord-channels/types";
import {
  getRequesterWorkspaceIds,
  hasFullFeedAccess,
  resolveFeedForRequester,
} from "../../shared/utils/feed-access";
import type {
  GetUserFeedsInputFilters,
  GetUserFeedsInputSortKey,
} from "../../services/user-feeds/types";

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
  const { userFeedsService, supportersService, curatedFeedRepository } =
    request.container;
  const { discordUserId, accessToken } = request;
  const { url, curatedFeedId, title, sourceFeedId, workspaceId } = request.body;

  if (!!url === !!curatedFeedId) {
    throw new BadRequestError(
      ApiErrorCode.INVALID_REQUEST,
      "Provide exactly one of 'url' or 'curatedFeedId'",
    );
  }

  let resolvedUrl = url;
  let resolvedTitle = title;

  if (curatedFeedId) {
    const curated = await curatedFeedRepository.findActiveById(curatedFeedId);

    if (!curated) {
      throw new NotFoundError(ApiErrorCode.CURATED_FEED_NOT_FOUND);
    }

    resolvedUrl = curated.url;
    resolvedTitle = title ?? curated.title;
  }

  const feed = await userFeedsService.addFeed(
    {
      discordUserId,
      userAccessToken: accessToken.access_token,
    },
    {
      url: resolvedUrl!,
      title: resolvedTitle,
      sourceFeedId,
      workspaceId,
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
    (con) => formatDiscordChannelConnectionResponse(con),
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
    isWorkspaceFeed: !!feed.workspaceId,
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
    // Workspace feeds use workspace membership for access, not per-user share invites,
    // so the sharing UI is never surfaced for them.
    shareManageOptions:
      isOwner && !feed.workspaceId ? feed.shareManageOptions : undefined,
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

/** @deprecated Kept for backwards compatibility. New clients should call POST /api/v1/curated-feeds/:id/preview instead. */
export async function previewFeedByUrlHandler(
  request: FastifyRequest<{ Body: PreviewByUrlBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { discordUserId } = request;

  const result = await userFeedsService.previewFeedByUrl(
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
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const existingCount = await userFeedRepository.countByIds(requestedFeedIds);

  if (existingCount !== requestedFeedIds.length) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);
  const myWorkspaceIds = await getRequesterWorkspaceIds(request, user);

  const authorizedFeedIds = isAdmin
    ? requestedFeedIds
    : await userFeedRepository.filterFeedIdsByOwnership(
        requestedFeedIds,
        discordUserId,
        myWorkspaceIds,
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
  const { supportersService } = request.container;
  const { discordUserId } = request;
  const { feedId } = request.params;

  const { feed } = await resolveFeedForRequester(request, feedId);

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
  const { userFeedsService, supportersService } = request.container;
  const { discordUserId } = request;
  const { feedId } = request.params;

  const { feed, user } = await resolveFeedForRequester(request, feedId);

  if (request.body.shareManageOptions && feed.workspaceId) {
    throw new ForbiddenError(ApiErrorCode.WORKSPACE_FEED_SHARING_DISABLED);
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
    { id: feedId, disabledCode: feed.disabledCode, user },
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
  const { userFeedsService } = request.container;
  const { discordUserId } = request;
  const { feedId } = request.params;

  const { feed, isAdmin } = await resolveFeedForRequester(request, feedId);

  // Any workspace member may delete a workspace feed. For a personal feed,
  // only the creator may delete it — a personal share-invite co-manager
  // resolves the feed via ownership but cannot delete it.
  if (!hasFullFeedAccess(feed, discordUserId, isAdmin)) {
    throw new ForbiddenError(ApiErrorCode.MISSING_SHARED_MANAGER_PERMISSIONS);
  }

  await userFeedsService.deleteFeedById(feedId);

  return reply.status(204).send();
}

export async function cloneUserFeedHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Body: CloneUserFeedBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { discordUserId, accessToken } = request;
  const { feedId } = request.params;

  const { user } = await resolveFeedForRequester(request, feedId);

  const { id } = await userFeedsService.clone(
    feedId,
    accessToken.access_token,
    { title: request.body?.title, url: request.body?.url },
    user,
  );

  return reply.status(201).send({ result: { id } });
}

export async function sendTestArticleHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Body: SendTestArticleBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { feedsService, feedConnectionsDiscordChannelsService } =
    request.container;
  const { discordUserId, accessToken } = request;
  const { feedId } = request.params;

  const { feed } = await resolveFeedForRequester(request, feedId);

  await feedsService.canUseChannel({
    channelId: request.body.channelId,
    userAccessToken: accessToken.access_token,
  });

  const result =
    await feedConnectionsDiscordChannelsService.sendTestArticleDirect(feed, {
      article: request.body.article,
      channelId: request.body.channelId,
      content: request.body.content,
      embeds: request.body.embeds,
      componentsV2: request.body.componentsV2 ?? undefined,
      placeholderLimits: request.body.placeholderLimits,
      webhook: request.body.webhook,
      threadId: request.body.threadId,
      channelNewThread: request.body.channelNewThread,
      userFeedFormatOptions: request.body.userFeedFormatOptions,
    });

  return reply.status(200).send({ result });
}

export async function getFeedRequestsHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Querystring: GetFeedRequestsQuery;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { feedId } = request.params;

  const { feed, user } = await resolveFeedForRequester(request, feedId);

  const result = await userFeedsService.getFeedRequests({
    feed,
    url: feed.url,
    query: request.query as Record<string, string>,
    user,
  });

  return reply.status(200).send(result);
}

export async function getDeliveryLogsHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Querystring: GetDeliveryLogsQuery;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { feedId } = request.params;

  const { feed } = await resolveFeedForRequester(request, feedId);

  const result = await userFeedsService.getDeliveryLogs(feed.id, {
    limit: request.query.limit ?? 25,
    skip: request.query.skip ?? 0,
  });

  return reply.status(200).send(result);
}

export async function datePreviewHandler(
  request: FastifyRequest<{ Params: GetUserFeedParams; Body: DatePreviewBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;

  const result = userFeedsService.getDatePreview({
    dateFormat: request.body.dateFormat,
    dateLocale: request.body.dateLocale,
    dateTimezone: request.body.dateTimezone,
  });

  return reply.status(200).send({
    result: {
      valid: result.valid,
      output: result.output,
    },
  });
}

export async function getArticlePropertiesHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Body: GetArticlePropertiesBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { feedId } = request.params;

  const { feed, user } = await resolveFeedForRequester(request, feedId);

  const { properties, requestStatus } =
    await userFeedsService.getFeedArticleProperties({
      url: feed.url,
      customPlaceholders: request.body.customPlaceholders as Parameters<
        typeof userFeedsService.getFeedArticleProperties
      >[0]["customPlaceholders"],
      feed,
      user,
    });

  return reply.status(200).send({
    result: {
      properties,
      requestStatus,
    },
  });
}

export async function getArticlesHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Body: GetArticlesBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { feedId } = request.params;

  const { feed, user } = await resolveFeedForRequester(request, feedId);

  const {
    limit,
    skip,
    random,
    filters,
    selectProperties,
    selectPropertyTypes,
    formatter: { externalProperties, ...formatter },
    includeHtmlInErrors,
  } = request.body;

  const {
    articles,
    response,
    requestStatus,
    filterStatuses,
    selectedProperties,
    totalArticles,
    externalContentErrors,
  } = await userFeedsService.getFeedArticles({
    limit: limit ?? 25,
    url: feed.url,
    feed,
    random,
    filters: filters as Parameters<
      typeof userFeedsService.getFeedArticles
    >[0]["filters"],
    discordUserId: feed.user.discordUserId,
    selectProperties,
    selectPropertyTypes,
    skip,
    includeHtmlInErrors,
    user,
    formatter: {
      ...formatter,
      externalProperties,
      options: {
        ...formatter.options,
        dateFormat: feed.formatOptions?.dateFormat,
        dateTimezone: feed.formatOptions?.dateTimezone,
        dateLocale: feed.formatOptions?.dateLocale,
      },
    } as Parameters<typeof userFeedsService.getFeedArticles>[0]["formatter"],
  });

  return reply.status(200).send({
    result: {
      articles,
      response,
      requestStatus,
      filterStatuses,
      selectedProperties,
      totalArticles,
      externalContentErrors,
    },
  });
}

export async function deliveryPreviewHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Body: DeliveryPreviewBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { discordUserId } = request;
  const { feedId } = request.params;

  const { feed, user } = await resolveFeedForRequester(request, feedId);

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

  const result = await userFeedsService.getDeliveryPreview({
    feed,
    skip: request.body.skip ?? 0,
    limit: request.body.limit ?? 10,
    user,
  });

  return reply.status(200).send(result);
}

export async function getDailyLimitHandler(
  request: FastifyRequest<{ Params: GetUserFeedParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { feedId } = request.params;

  const { feed } = await resolveFeedForRequester(request, feedId);

  const { progress, max } = await userFeedsService.getFeedDailyLimit(feed);

  return reply.status(200).send({ result: { current: progress, max } });
}

export async function manualRequestHandler(
  request: FastifyRequest<{ Params: GetUserFeedParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { feedId } = request.params;

  const { feed } = await resolveFeedForRequester(request, feedId);

  try {
    const {
      requestStatus,
      requestStatusCode,
      getArticlesRequestStatus,
      hasEnabledFeed,
    } = await userFeedsService.manuallyRequest(feed);

    return reply.status(200).send({
      result: {
        requestStatus,
        requestStatusCode,
        getArticlesRequestStatus,
        hasEnabledFeed,
      },
    });
  } catch (err) {
    if (err instanceof ManualRequestTooSoonException) {
      return reply.status(422).send({
        result: {
          minutesUntilNextRequest: Math.ceil(
            (err.secondsUntilNextRequest ?? 0) / 60,
          ),
        },
      });
    }

    throw err;
  }
}

function parseFilters(raw: unknown): GetUserFeedsInputFilters | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const filters: GetUserFeedsInputFilters = {};
  const obj = raw as Record<string, unknown>;

  if (typeof obj.disabledCodes === "string") {
    filters.disabledCodes = obj.disabledCodes.split(",").map((v) => {
      const trimmed = v.trim();
      return trimmed === "" ? null : (trimmed as never);
    });
  }

  if (typeof obj.connectionDisabledCodes === "string") {
    filters.connectionDisabledCodes = obj.connectionDisabledCodes
      .split(",")
      .map((v) => {
        const trimmed = v.trim();
        return trimmed === "" ? null : trimmed;
      });
  }

  if (
    typeof obj.computedStatuses === "string" &&
    obj.computedStatuses.trim() !== ""
  ) {
    filters.computedStatuses = obj.computedStatuses
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "") as never;
  }

  if (typeof obj.ownedByUser === "string") {
    filters.ownedByUser = obj.ownedByUser === "true";
  }

  if (typeof obj.hasConnections === "string") {
    filters.hasConnections = obj.hasConnections === "true";
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

export async function getUserFeedsHandler(
  request: FastifyRequest<{ Querystring: GetUserFeedsQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService, usersService, workspacesService } = request.container;
  const { discordUserId } = request;
  const { workspaceId } = request.query;

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);

  if (workspaceId) {
    // Verify membership before scoping to the workspace. Non-members (or unknown
    // workspaces) get 404 WORKSPACE_NOT_FOUND — no existence leak.
    await workspacesService.getWorkspaceForMember(workspaceId, user.id);
  }

  const rawQuery = request.url.split("?")[1] || "";
  const parsed = qs.parse(rawQuery);
  const filters = parseFilters(parsed.filters);

  const input = {
    limit: request.query.limit,
    offset: request.query.offset,
    search: request.query.search,
    sort: (request.query.sort || undefined) as
      | GetUserFeedsInputSortKey
      | undefined,
    filters,
    workspaceId,
  };

  const [feeds, count, feedsWithoutConnectionsCount] = await Promise.all([
    userFeedsService.getFeedsByUser(user.id, discordUserId, input),
    userFeedsService.getFeedCountByUser(user.id, discordUserId, input),
    userFeedsService.getFeedsWithoutConnectionsCount(
      user.id,
      discordUserId,
      workspaceId,
    ),
  ]);

  return reply.status(200).send({
    results: feeds.map((feed) => ({
      id: feed.id,
      title: feed.title,
      url: feed.url,
      inputUrl: feed.inputUrl,
      healthStatus: feed.healthStatus,
      disabledCode: feed.disabledCode,
      createdAt: feed.createdAt.toISOString(),
      computedStatus: feed.computedStatus,
      isLegacyFeed: false,
      ownedByUser: feed.ownedByUser,
      refreshRateSeconds: feed.refreshRateSeconds,
      connectionCount: feed.connectionCount,
    })),
    total: count,
    feedsWithoutConnections: feedsWithoutConnectionsCount,
  });
}

export async function copySettingsHandler(
  request: FastifyRequest<{
    Params: GetUserFeedParams;
    Body: CopySettingsBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const { discordUserId } = request;
  const { feedId } = request.params;

  const { feed } = await resolveFeedForRequester(request, feedId);

  const { targetFeedSelectionType, targetFeedIds } = request.body;

  if (
    (!targetFeedSelectionType ||
      targetFeedSelectionType === UserFeedTargetFeedSelectionType.Selected) &&
    !targetFeedIds?.length
  ) {
    throw new BadRequestError(ApiErrorCode.VALIDATION_FAILED);
  }

  await userFeedsService.copySettings({
    sourceFeed: feed,
    dto: {
      settings: request.body.settings,
      targetFeedIds: request.body.targetFeedIds,
      targetFeedSelectionType: request.body.targetFeedSelectionType,
      targetFeedSearch: request.body.targetFeedSearch,
      targetFeedExcludeIds: request.body.targetFeedExcludeIds,
    },
    discordUserId,
  });

  return reply.status(204).send();
}
