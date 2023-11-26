import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { convertToNestedDiscordEmbed } from "../../utils/convert-to-nested-discord-embed";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";

import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import {
  CreateDiscordChannelConnectionOutputDto,
  CreateDiscordWebhookConnectionOutputDto,
} from "../feed-connections/dto";
import { FeedConnectionType } from "../feeds/constants";
import {
  FeedExceptionFilter,
  UpdateUserFeedsExceptionFilter,
} from "../feeds/filters";
import { SupportersService } from "../supporters/supporters.service";
import {
  UserFeedManagerStatus,
  UserFeedManagerType,
} from "../user-feed-management-invites/constants";
import {
  CreateUserFeedCloneInput,
  CreateUserFeedInputDto,
  GetUserFeedArticlePropertiesInputDto,
  GetUserFeedArticlePropertiesOutputDto,
  GetUserFeedArticlesInputDto,
  GetUserFeedDailyLimitOutputDto,
  GetUserFeedOutputDto,
  GetUserFeedRequestsInputDto,
  GetUserFeedRequestsOutputDto,
  GetUserFeedsInputDto,
  GetUserFeedsOutputDto,
  UpdateUserFeedInputDto,
  UpdateUserFeedOutputDto,
  UpdateUserFeedsInput,
  UpdateUserFeedsOp,
} from "./dto";
import { GetUserFeedArticlesOutputDto } from "./dto/get-user-feed-articles-output.dto";
import { UserFeed } from "./entities";
import { UnsupportedBulkOpException } from "./exceptions";
import {
  GetUserFeedArticlesExceptionFilter,
  RetryUserFeedFilter,
} from "./filters";
import { RestoreLegacyUserFeedExceptionFilter } from "./filters/restore-legacy-user-feed-exception.filter";
import { GetUserFeedPipe } from "./pipes";
import { GetFeedArticlePropertiesInput, GetFeedArticlesInput } from "./types";
import { UserFeedsService } from "./user-feeds.service";

@Controller("user-feeds")
@UseGuards(DiscordOAuth2Guard)
export class UserFeedsController {
  constructor(
    private readonly userFeedsService: UserFeedsService,
    private readonly supportersService: SupportersService
  ) {}

  @Post()
  @UseFilters(FeedExceptionFilter)
  async createFeed(
    @Body(ValidationPipe) { title, url }: CreateUserFeedInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<GetUserFeedOutputDto> {
    const result = await this.userFeedsService.addFeed(
      {
        discordUserId,
      },
      {
        title,
        url,
      }
    );

    return this.formatFeedForResponse(result, discordUserId);
  }

  @Patch()
  @UseFilters(UpdateUserFeedsExceptionFilter)
  async updateFeeds(
    @Body(ValidationPipe) input: UpdateUserFeedsInput,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    if (input.op === UpdateUserFeedsOp.BulkDelete) {
      const results = await this.userFeedsService.bulkDelete(
        input.data.feeds.map((f) => f.id),
        discordUserId
      );

      return {
        results,
      };
    }

    if (input.op === UpdateUserFeedsOp.BulkDisable) {
      const results = await this.userFeedsService.bulkDisable(
        input.data.feeds.map((f) => f.id),
        discordUserId
      );

      return {
        results,
      };
    }

    if (input.op === UpdateUserFeedsOp.BulkEnable) {
      const results = await this.userFeedsService.bulkEnable(
        input.data.feeds.map((f) => f.id),
        discordUserId
      );

      return {
        results,
      };
    }

    throw new UnsupportedBulkOpException(
      `Unsupported bulk operation: ${input.op}`
    );
  }

  @Get("/:feedId")
  async getFeed(
    @Param("feedId", GetUserFeedPipe()) feed: UserFeed,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<GetUserFeedOutputDto> {
    return await this.formatFeedForResponse(feed, discordUserId);
  }

  @Post("/:feedId/clone")
  @UseFilters(FeedExceptionFilter)
  async createFeedClone(
    @Param("feedId", GetUserFeedPipe()) feed: UserFeed,
    @DiscordAccessToken()
    { access_token }: SessionAccessToken,
    @Body(ValidationPipe) { title, url }: CreateUserFeedCloneInput
  ) {
    const { id } = await this.userFeedsService.clone(
      feed._id.toHexString(),
      access_token,
      {
        title,
        url,
      }
    );

    return {
      result: {
        id,
      },
    };
  }

  @Get("/:feed/requests")
  async getFeedRequests(
    @Param("feed", GetUserFeedPipe()) feed: UserFeed,
    @NestedQuery(TransformValidationPipe)
    { limit, skip }: GetUserFeedRequestsInputDto
  ): Promise<GetUserFeedRequestsOutputDto> {
    const requests = await this.userFeedsService.getFeedRequests({
      url: feed.url,
      limit,
      skip,
    });

    return requests;
  }

  @Post("/:feedId/get-article-properties")
  @UseFilters(GetUserFeedArticlesExceptionFilter)
  async getArticleProperties(
    @Param("feedId", GetUserFeedPipe()) feed: UserFeed,
    @Body(TransformValidationPipe)
    { customPlaceholders }: GetUserFeedArticlePropertiesInputDto
  ): Promise<GetUserFeedArticlePropertiesOutputDto> {
    const input: GetFeedArticlePropertiesInput = {
      url: feed.url,
      customPlaceholders,
    };

    const { properties, requestStatus } =
      await this.userFeedsService.getFeedArticleProperties(input);

    return {
      result: {
        properties,
        requestStatus,
      },
    };
  }

  @Post("/:feedId/get-articles")
  @UseFilters(GetUserFeedArticlesExceptionFilter)
  @HttpCode(HttpStatus.OK)
  async getFeedArticles(
    @Body(TransformValidationPipe)
    {
      limit,
      random,
      filters,
      selectProperties,
      skip,
      formatter,
    }: GetUserFeedArticlesInputDto,
    @Param("feedId", GetUserFeedPipe()) feed: UserFeed
  ): Promise<GetUserFeedArticlesOutputDto> {
    const input: GetFeedArticlesInput = {
      limit,
      url: feed.url,
      random,
      filters,
      selectProperties,
      skip,
      formatter: {
        ...formatter,
        options: {
          ...formatter.options,
          dateFormat: feed.formatOptions?.dateFormat,
          dateTimezone: feed.formatOptions?.dateTimezone,
        },
      },
    };

    const {
      articles,
      requestStatus,
      filterStatuses,
      selectedProperties,
      totalArticles,
      response,
    } = await this.userFeedsService.getFeedArticles(input);

    return {
      result: {
        articles,
        response,
        requestStatus,
        filterStatuses,
        selectedProperties,
        totalArticles,
      },
    };
  }

  @Get("/:feedId/retry")
  @UseFilters(RetryUserFeedFilter, FeedExceptionFilter)
  async retryFailedFeed(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedPipe()) feed: UserFeed
  ): Promise<GetUserFeedOutputDto> {
    const updatedFeed = (await this.userFeedsService.retryFailedFeed(
      feed._id.toHexString()
    )) as UserFeed;

    return this.formatFeedForResponse(updatedFeed, discordUserId);
  }

  @Get("/:feedId/daily-limit")
  async getDailyLimit(
    @Param("feedId", GetUserFeedPipe()) feed: UserFeed
  ): Promise<GetUserFeedDailyLimitOutputDto> {
    const limit = await this.userFeedsService.getFeedDailyLimit(feed);

    return {
      result: {
        current: limit.progress,
        max: limit.max,
      },
    };
  }

  @Patch("/:feedId")
  @UseFilters(FeedExceptionFilter)
  async updateFeed(
    @Param("feedId", GetUserFeedPipe()) feed: UserFeed,
    @Body(ValidationPipe)
    {
      title,
      url,
      disabledCode,
      passingComparisons,
      blockingComparisons,
      formatOptions,
      dateCheckOptions,
      shareManageOptions,
      userRefreshRateSeconds,
    }: UpdateUserFeedInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<UpdateUserFeedOutputDto> {
    if (disabledCode && feed.disabledCode) {
      throw new ForbiddenException("Feed is already disabled");
    }

    const updated = (await this.userFeedsService.updateFeedById(
      feed._id.toHexString(),
      {
        title,
        url,
        disabledCode,
        passingComparisons,
        blockingComparisons,
        formatOptions,
        dateCheckOptions,
        shareManageOptions,
        userRefreshRateSeconds,
      }
    )) as UserFeed;

    return this.formatFeedForResponse(updated, discordUserId);
  }

  @Post("/:feedId/restore-to-legacy")
  @UseFilters(RestoreLegacyUserFeedExceptionFilter)
  async restoreToLegacy(@Param("feedId", GetUserFeedPipe()) feed: UserFeed) {
    if (!feed.legacyFeedId) {
      throw new BadRequestException("Feed is not related to a legacy feed");
    }

    await this.userFeedsService.restoreToLegacyFeed(feed);

    return {
      result: {
        status: "success",
      },
    };
  }

  @Get()
  async getFeeds(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @NestedQuery(TransformValidationPipe)
    dto: GetUserFeedsInputDto
  ): Promise<GetUserFeedsOutputDto> {
    const [feeds, count] = await Promise.all([
      this.userFeedsService.getFeedsByUser(discordUserId, dto),
      this.userFeedsService.getFeedCountByUser(discordUserId, dto),
    ]);

    return {
      results: feeds.map((feed) => ({
        id: feed._id.toHexString(),
        title: feed.title,
        url: feed.url,
        healthStatus: feed.healthStatus,
        disabledCode: feed.disabledCode,
        createdAt: feed.createdAt.toISOString(),
        computedStatus: feed.computedStatus,
        isLegacyFeed: !!feed.legacyFeedId,
        ownedByUser: feed.ownedByUser,
      })),
      total: count,
    };
  }

  @Delete("/:feedId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeed(
    @Param(
      "feedId",
      GetUserFeedPipe({
        userTypes: [UserFeedManagerType.Creator],
      })
    )
    feed: UserFeed
  ) {
    await this.userFeedsService.deleteFeedById(feed._id.toHexString());
  }

  private async formatFeedForResponse(
    feed: UserFeed,
    discordUserId: string
  ): Promise<GetUserFeedOutputDto> {
    const discordChannelConnections: CreateDiscordChannelConnectionOutputDto[] =
      feed.connections.discordChannels.map((con) => ({
        id: con.id.toHexString(),
        name: con.name,
        key: FeedConnectionType.DiscordChannel,
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
        },
        filters: con.filters,
        rateLimits: con.rateLimits,
        disabledCode: con.disabledCode,
        splitOptions: con.splitOptions,
        mentions: con.mentions,
        customPlaceholders: con.customPlaceholders,
      }));

    const discordWebhookConnections: CreateDiscordWebhookConnectionOutputDto[] =
      feed.connections.discordWebhooks.map((con) => ({
        id: con.id.toHexString(),
        name: con.name,
        key: FeedConnectionType.DiscordWebhook,
        details: {
          ...con.details,
          embeds: convertToNestedDiscordEmbed(con.details.embeds),
        },
        filters: con.filters,
        rateLimits: con.rateLimits,
        disabledCode: con.disabledCode,
        splitOptions: con.splitOptions,
        mentions: con.mentions,
        customPlaceholders: con.customPlaceholders,
      }));

    const benefits = await this.supportersService.getBenefitsOfDiscordUser(
      discordUserId
    );

    const isOwner = feed.user.discordUserId === discordUserId;

    const userInviteId = feed.shareManageOptions?.invites?.find(
      (u) =>
        u.discordUserId === discordUserId &&
        u.status === UserFeedManagerStatus.Accepted
    )?.id;

    return {
      result: {
        id: feed._id.toHexString(),
        allowLegacyReversion: feed.allowLegacyReversion,
        sharedAccessDetails: userInviteId
          ? {
              inviteId: userInviteId.toHexString(),
            }
          : undefined,
        title: feed.title,
        url: feed.url,
        isLegacyFeed: !!feed.legacyFeedId,
        connections: [
          ...discordChannelConnections,
          ...discordWebhookConnections,
        ],
        disabledCode: feed.disabledCode,
        healthStatus: feed.healthStatus,
        passingComparisons: feed.passingComparisons,
        blockingComparisons: feed.blockingComparisons,
        createdAt: feed.createdAt.toISOString(),
        updatedAt: feed.updatedAt.toISOString(),
        formatOptions: feed.formatOptions,
        dateCheckOptions: feed.dateCheckOptions,
        refreshRateSeconds:
          feed.refreshRateSeconds || benefits.refreshRateSeconds,
        userRefreshRateSeconds: feed.userRefreshRateSeconds,
        shareManageOptions: isOwner ? feed.shareManageOptions : undefined,
      },
    };
  }
}
