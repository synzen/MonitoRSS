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
import { NestedFieldPipe } from "../../common/pipes/nested-field.pipe";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { convertToNestedDiscordEmbed } from "../../utils/convert-to-nested-discord-embed";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";

import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import {
  CreateDiscordChannelConnectionOutputDto,
  CreateDiscordWebhookConnectionOutputDto,
} from "../feed-connections/dto";
import { AddDiscordChannelConnectionFilter } from "../feed-connections/filters";
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
  GetUserFeedDeliveryLogsInputDto,
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
import { CreateUserFeedDatePreviewInput } from "./dto/create-user-feed-date-preview-input.dto";
import { GetUserFeedArticlesOutputDto } from "./dto/get-user-feed-articles-output.dto";
import { UserFeed } from "./entities";
import { UnsupportedBulkOpException } from "./exceptions";
import {
  GetUserFeedArticlesExceptionFilter,
  RetryUserFeedFilter,
} from "./filters";
import { RestoreLegacyUserFeedExceptionFilter } from "./filters/restore-legacy-user-feed-exception.filter";
import { GetUserFeedsPipe, GetUserFeedsPipeOutput } from "./pipes";
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
    @Body(
      NestedFieldPipe("data.feeds", {
        transform: (feedIds: Array<{ id: string }>) =>
          feedIds.map(({ id }) => id),
      }),
      GetUserFeedsPipe()
    )
    feeds: GetUserFeedsPipeOutput
  ) {
    const useFeedIds = feeds.map(({ feed }) => feed._id.toHexString());

    if (input.op === UpdateUserFeedsOp.BulkDelete) {
      const results = await this.userFeedsService.bulkDelete(useFeedIds);

      return {
        results,
      };
    }

    if (input.op === UpdateUserFeedsOp.BulkDisable) {
      const results = await this.userFeedsService.bulkDisable(useFeedIds);

      return {
        results,
      };
    }

    if (input.op === UpdateUserFeedsOp.BulkEnable) {
      const results = await this.userFeedsService.bulkEnable(useFeedIds);

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
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<GetUserFeedOutputDto> {
    return await this.formatFeedForResponse(feed, discordUserId);
  }

  @Post("/:feedId/clone")
  @UseFilters(FeedExceptionFilter, AddDiscordChannelConnectionFilter)
  async createFeedClone(
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
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

  @Post("/:feedId/date-preview")
  @UseFilters(FeedExceptionFilter)
  async createDatePreview(
    @Body(ValidationPipe)
    { dateFormat, dateLocale, dateTimezone }: CreateUserFeedDatePreviewInput
  ) {
    const result = await this.userFeedsService.getDatePreview({
      dateFormat,
      dateLocale,
      dateTimezone,
    });

    return {
      result: {
        valid: result.valid,
        output: result.output,
      },
    };
  }

  @Get("/:feed/requests")
  async getFeedRequests(
    @Param("feed", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
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

  @Get("/:feed/delivery-logs")
  async getFeedDeliveryLogs(
    @Param("feed", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
    @NestedQuery(TransformValidationPipe)
    { limit, skip }: GetUserFeedDeliveryLogsInputDto
  ) {
    const result = await this.userFeedsService.getDeliveryLogs(
      feed._id.toHexString(),
      {
        limit,
        skip,
      }
    );

    return result;
  }

  @Post("/:feedId/get-article-properties")
  @UseFilters(GetUserFeedArticlesExceptionFilter)
  async getArticleProperties(
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
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
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput
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
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput
  ): Promise<GetUserFeedOutputDto> {
    const updatedFeed = (await this.userFeedsService.retryFailedFeed(
      feed._id.toHexString()
    )) as UserFeed;

    return this.formatFeedForResponse(updatedFeed, discordUserId);
  }

  @Get("/:feedId/daily-limit")
  async getDailyLimit(
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput
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
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
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
  async restoreToLegacy(
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput
  ) {
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
      GetUserFeedsPipe({
        userTypes: [UserFeedManagerType.Creator],
      })
    )
    [{ feed }]: GetUserFeedsPipeOutput
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
        customPlaceholders: con.customPlaceholders?.map((c) => ({
          ...c,
          steps: c.steps.map((s) => ({
            ...s,
            regexSearchFlags: s.regexSearchFlags || "gmi", // default is set in user-feeds-service
          })),
        })),
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
          feed.refreshRateSeconds ||
          (
            await this.supportersService.getBenefitsOfDiscordUser(
              feed.user.discordUserId
            )
          ).refreshRateSeconds,
        userRefreshRateSeconds: feed.userRefreshRateSeconds,
        shareManageOptions: isOwner ? feed.shareManageOptions : undefined,
      },
    };
  }
}
