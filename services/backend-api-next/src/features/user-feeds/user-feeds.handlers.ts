import type { FastifyRequest, FastifyReply } from "fastify";
import { getAccessTokenFromRequest } from "../../infra/auth";
import { BadRequestError, ApiErrorCode } from "../../infra/error-handler";
import {
  FeedLimitReachedException,
  SourceFeedNotFoundException,
  BannedFeedException,
  FeedFetchTimeoutException,
  FeedParseException,
  FeedRequestException,
  FeedInvalidSslCertException,
  NoFeedOnHtmlPageException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedInternalErrorException,
  FeedNotFoundException,
  FeedTooLargeException,
} from "../../shared/exceptions/user-feeds.exceptions";
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import { CustomPlaceholderStepType } from "../../repositories/shared/enums";
import { UserFeedManagerStatus } from "../../repositories/shared/enums";
import type {
  CreateUserFeedBody,
  DeduplicateFeedUrlsBody,
} from "./user-feeds.schemas";

export async function deduplicateFeedUrlsHandler(
  request: FastifyRequest<{ Body: DeduplicateFeedUrlsBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedsService } = request.container;
  const token = getAccessTokenFromRequest(request);
  const discordUserId = token!.discord.id;

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
  const token = getAccessTokenFromRequest(request);
  const discordUserId = token!.discord.id;

  try {
    const feed = await userFeedsService.addFeed(
      {
        discordUserId,
        userAccessToken: token!.access_token,
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
  } catch (err) {
    if (err instanceof FeedLimitReachedException) {
      throw new BadRequestError(ApiErrorCode.FEED_LIMIT_REACHED);
    }
    if (err instanceof SourceFeedNotFoundException) {
      throw new BadRequestError(
        ApiErrorCode.ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND,
      );
    }
    if (err instanceof BannedFeedException) {
      throw new BadRequestError(ApiErrorCode.BANNED_FEED);
    }
    if (err instanceof FeedFetchTimeoutException) {
      throw new BadRequestError(ApiErrorCode.FEED_REQUEST_TIMEOUT);
    }
    if (err instanceof FeedParseException) {
      throw new BadRequestError(ApiErrorCode.ADD_FEED_PARSE_FAILED);
    }
    if (err instanceof FeedRequestException) {
      throw new BadRequestError(ApiErrorCode.FEED_FETCH_FAILED);
    }
    if (err instanceof FeedInvalidSslCertException) {
      throw new BadRequestError(ApiErrorCode.FEED_INVALID_SSL_CERT);
    }
    if (err instanceof NoFeedOnHtmlPageException) {
      throw new BadRequestError(ApiErrorCode.NO_FEED_IN_HTML_PAGE);
    }
    if (err instanceof FeedTooManyRequestsException) {
      throw new BadRequestError(ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS);
    }
    if (err instanceof FeedUnauthorizedException) {
      throw new BadRequestError(ApiErrorCode.FEED_REQUEST_UNAUTHORIZED);
    }
    if (err instanceof FeedForbiddenException) {
      throw new BadRequestError(ApiErrorCode.FEED_REQUEST_FORBIDDEN);
    }
    if (err instanceof FeedInternalErrorException) {
      throw new BadRequestError(ApiErrorCode.FEED_REQUEST_INTERNAL_ERROR);
    }
    if (err instanceof FeedNotFoundException) {
      throw new BadRequestError(ApiErrorCode.FEED_NOT_FOUND);
    }
    if (err instanceof FeedTooLargeException) {
      throw new BadRequestError(ApiErrorCode.FEED_TOO_LARGE);
    }

    throw err;
  }
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
        embeds: con.details.embeds,
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
