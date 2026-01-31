import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseFilters,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { NestedFieldPipe } from "../../common/pipes/nested-field.pipe";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { FastifyReply, FastifyRequest } from "fastify";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";

import { ADD_DISCORD_CHANNEL_CONNECTION_ERROR_CODES } from "../feed-connections/filters";
import { FeedConnectionsDiscordChannelsService } from "../feed-connections/feed-connections-discord-channels.service";
import { FeedsService } from "../feeds/feeds.service";
import {
  FEED_EXCEPTION_FILTER_ERROR_CODES,
  FeedExceptionFilter,
  UpdateUserFeedsExceptionFilter,
} from "../feeds/filters";
import { UserFeedManagerType } from "../user-feed-management-invites/constants";
import {
  CreateUserFeedCloneInput,
  CreateUserFeedInputDto,
  GetUserFeedArticlePropertiesInputDto,
  GetUserFeedArticlePropertiesOutputDto,
  GetUserFeedArticlesInputDto,
  GetUserFeedDailyLimitOutputDto,
  GetUserFeedDeliveryLogsInputDto,
  GetUserFeedOutputDto,
  GetUserFeedsInputDto,
  GetUserFeedsOutputDto,
  SendTestArticleInputDto,
  UpdateUserFeedInputDto,
  UpdateUserFeedOutputDto,
  UpdateUserFeedsInput,
  UpdateUserFeedsOp,
} from "./dto";
import { CreateUserFeedDatePreviewInput } from "./dto/create-user-feed-date-preview-input.dto";
import { GetUserFeedArticlesOutputDto } from "./dto/get-user-feed-articles-output.dto";
import { UserFeed } from "./entities";
import {
  ManualRequestTooSoonException,
  UnsupportedBulkOpException,
} from "./exceptions";
import {
  GetUserFeedArticlesExceptionFilter,
  RETRY_USER_FEED_ERROR_CODES,
  SendTestArticleFilter,
} from "./filters";
import { GetUserFeedsPipe, GetUserFeedsPipeOutput } from "./pipes";
import { GetFeedArticlePropertiesInput, GetFeedArticlesInput } from "./types";
import { UserFeedsService } from "./user-feeds.service";
import { CopyUserFeedSettingsInputDto } from "./dto/copy-user-feed-settings-input.dto";
import { createMultipleExceptionsFilter } from "../../common/filters/multiple-exceptions.filter";
import { CreateUserFeedUrlValidationInputDto } from "./dto/create-user-feed-url-validation-input.dto";
import { UserFeedTargetFeedSelectionType } from "./constants/target-feed-selection-type.type";
import { UsersService } from "../users/users.service";
import { UpdateUserFeedExceptionFilter } from "../feeds/filters/update-user-feed-exception.filter";

@Controller("user-feeds")
@UseGuards(DiscordOAuth2Guard)
export class UserFeedsController {
  constructor(
    private readonly userFeedsService: UserFeedsService,
    private readonly usersService: UsersService,
    private readonly feedConnectionsService: FeedConnectionsDiscordChannelsService,
    private readonly feedsService: FeedsService
  ) {}

  @Post()
  @UseFilters(FeedExceptionFilter)
  async createFeed(
    @Body(ValidationPipe)
    dto: CreateUserFeedInputDto,
    @DiscordAccessToken()
    {
      discord: { id: discordUserId },
      access_token: userAccessToken,
    }: SessionAccessToken
  ): Promise<GetUserFeedOutputDto> {
    const result = await this.userFeedsService.addFeed(
      {
        discordUserId,
        userAccessToken,
      },
      dto
    );

    return this.userFeedsService.formatForHttpResponse(result, discordUserId);
  }

  @Post("deduplicate-feed-urls")
  async deduplicateFeedUrls(
    @Body(ValidationPipe)
    { urls }: { urls: string[] },
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const deduplicated = await this.userFeedsService.deduplicateFeedUrls(
      discordUserId,
      urls
    );

    return {
      result: {
        urls: deduplicated,
      },
    };
  }

  @Post("url-validation")
  @UseFilters(FeedExceptionFilter)
  async createFeedUrlValidation(
    @Body(ValidationPipe)
    { url }: CreateUserFeedUrlValidationInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const result = await this.userFeedsService.validateFeedUrl(
      {
        discordUserId,
      },
      {
        url,
      }
    );

    return {
      result,
    };
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
    @Param(
      "feedId",
      GetUserFeedsPipe({
        include: ["tags"],
      })
    )
    [{ feed }]: GetUserFeedsPipeOutput,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<GetUserFeedOutputDto> {
    return await this.userFeedsService.formatForHttpResponse(
      feed,
      discordUserId
    );
  }

  @Post("/:feedId/clone")
  @UseFilters(
    createMultipleExceptionsFilter(
      FEED_EXCEPTION_FILTER_ERROR_CODES,
      ADD_DISCORD_CHANNEL_CONNECTION_ERROR_CODES
    )
  )
  async createFeedClone(
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
    @DiscordAccessToken()
    { access_token }: SessionAccessToken,
    @Body(ValidationPipe)
    { title, url }: CreateUserFeedCloneInput
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

  @Post("/:feedId/test-send")
  @UseFilters(SendTestArticleFilter)
  async sendTestArticle(
    @Param(
      "feedId",
      GetUserFeedsPipe({
        userTypes: [
          UserFeedManagerType.Creator,
          UserFeedManagerType.SharedManager,
        ],
      })
    )
    [{ feed }]: GetUserFeedsPipeOutput,
    @Body(ValidationPipe)
    {
      article,
      channelId,
      content,
      embeds,
      componentsV2,
      placeholderLimits,
      webhook,
      threadId,
      userFeedFormatOptions,
    }: SendTestArticleInputDto,
    @DiscordAccessToken()
    { access_token }: SessionAccessToken
  ) {
    await this.feedsService.canUseChannel({
      channelId,
      userAccessToken: access_token,
    });

    const result = await this.feedConnectionsService.sendTestArticleDirect(
      feed,
      {
        article,
        channelId,
        content,
        embeds,
        componentsV2,
        placeholderLimits,
        webhook,
        threadId,
        userFeedFormatOptions,
      }
    );

    return {
      result,
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
    @Query() query: FastifyRequest["query"]
  ) {
    return this.userFeedsService.getFeedRequests({
      url: feed.url,
      query: query as Record<string, string>,
      feed,
    });
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

  @Post("/:feedId/delivery-preview")
  @HttpCode(HttpStatus.OK)
  async getDeliveryPreview(
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
    @Body(TransformValidationPipe)
    { skip, limit }: import("./dto").DeliveryPreviewInputDto
  ) {
    return this.userFeedsService.getDeliveryPreview({
      feed,
      skip: skip ?? 0,
      limit: limit ?? 10,
    });
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
      feed,
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
      selectPropertyTypes,
      skip,
      formatter: { externalProperties, ...formatter },
      includeHtmlInErrors,
    }: GetUserFeedArticlesInputDto,
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput
  ): Promise<GetUserFeedArticlesOutputDto> {
    const input: GetFeedArticlesInput = {
      limit,
      url: feed.url,
      feed,
      random,
      filters,
      discordUserId: feed.user.discordUserId,
      selectProperties,
      selectPropertyTypes,
      skip,
      includeHtmlInErrors,
      formatter: {
        ...formatter,
        externalProperties,
        options: {
          ...formatter.options,
          dateFormat: feed.formatOptions?.dateFormat,
          dateTimezone: feed.formatOptions?.dateTimezone,
          dateLocale: feed.formatOptions?.dateLocale,
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
      externalContentErrors,
    } = await this.userFeedsService.getFeedArticles(input);

    return {
      result: {
        articles,
        response,
        requestStatus,
        filterStatuses,
        selectedProperties,
        totalArticles,
        externalContentErrors,
      },
    };
  }

  @Post("/:feedId/manual-request")
  @UseFilters(
    createMultipleExceptionsFilter(
      RETRY_USER_FEED_ERROR_CODES,
      FEED_EXCEPTION_FILTER_ERROR_CODES
    )
  )
  async createManualRequest(
    @Res() res: FastifyReply,
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput
  ) {
    try {
      const {
        requestStatus,
        requestStatusCode,
        getArticlesRequestStatus,
        hasEnabledFeed,
      } = await this.userFeedsService.manuallyRequest(feed);

      return res.send({
        result: {
          requestStatus,
          requestStatusCode,
          getArticlesRequestStatus,
          hasEnabledFeed,
        },
      });
    } catch (err) {
      if (err instanceof ManualRequestTooSoonException) {
        return res.code(422).send({
          result: {
            minutesUntilNextRequest: Math.ceil(
              err.secondsUntilNextRequest / 60
            ),
          },
        });
      }

      throw err;
    }
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
  @UseFilters(UpdateUserFeedExceptionFilter)
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
      externalProperties,
    }: UpdateUserFeedInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<UpdateUserFeedOutputDto> {
    const updated = (await this.userFeedsService.updateFeedById(
      { id: feed._id.toHexString(), disabledCode: feed.disabledCode },
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
        externalProperties,
      }
    )) as UserFeed;

    return this.userFeedsService.formatForHttpResponse(updated, discordUserId);
  }

  @Post("/:feedId/copy-settings")
  @HttpCode(HttpStatus.NO_CONTENT)
  async copyFeedSettings(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedsPipe())
    [{ feed }]: GetUserFeedsPipeOutput,
    @Body(ValidationPipe)
    dto: CopyUserFeedSettingsInputDto
  ) {
    if (
      (!dto.targetFeedSelectionType ||
        dto.targetFeedSelectionType ===
          UserFeedTargetFeedSelectionType.Selected) &&
      !dto.targetFeedIds
    ) {
      throw new BadRequestException(
        "Target feed selection type is required when no target feed IDs are provided"
      );
    }

    await this.userFeedsService.copySettings({
      sourceFeed: feed,
      dto,
      discordUserId,
    });
  }

  @Get()
  async getFeeds(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @NestedQuery(TransformValidationPipe)
    dto: GetUserFeedsInputDto
  ): Promise<GetUserFeedsOutputDto> {
    const { _id: userId } = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );
    const [feeds, count] = await Promise.all([
      this.userFeedsService.getFeedsByUser(userId, discordUserId, dto),
      this.userFeedsService.getFeedCountByUser(userId, discordUserId, dto),
    ]);

    return {
      results: feeds.map((feed) => ({
        id: feed._id.toHexString(),
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
}
