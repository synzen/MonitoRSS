import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";

import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import {
  CreateDiscordChannelConnectionOutputDto,
  CreateDiscordWebhookConnectionOutputDto,
} from "../feed-connections/dto";
import { FeedConnectionType } from "../feeds/constants";
import { FeedExceptionFilter } from "../feeds/filters";
import { SupportersService } from "../supporters/supporters.service";
import {
  CreateUserFeedInputDto,
  GetUserFeedArticlesInputDto,
  GetUserFeedDailyLimitOutputDto,
  GetUserFeedOutputDto,
  GetUserFeedsInputDto,
  GetUserFeedsOutputDto,
  UpdateUserFeedInputDto,
  UpdateUserFeedOutputDto,
} from "./dto";
import { GetUserFeedArticlesOutputDto } from "./dto/get-user-feed-articles-output.dto";
import { UserFeed } from "./entities";
import { RetryUserFeedFilter } from "./filters";
import { GetUserFeedPipe } from "./pipes";
import { GetFeedArticlesInput } from "./types";
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

  @Get("/:feedId")
  async getFeed(
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ): Promise<GetUserFeedOutputDto> {
    return await this.formatFeedForResponse(feed, feed.user.discordUserId);
  }

  @Post("/:feedId/get-articles")
  @HttpCode(HttpStatus.OK)
  async getFeedArticles(
    @Body(TransformValidationPipe)
    { limit, random, filters }: GetUserFeedArticlesInputDto,
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ): Promise<GetUserFeedArticlesOutputDto> {
    const input: GetFeedArticlesInput = {
      limit,
      url: feed.url,
      random,
      filters,
    };

    const { articles, requestStatus, filterStatuses, selectedProperties } =
      await this.userFeedsService.getFeedArticles(input);

    return {
      result: {
        articles,
        requestStatus,
        filterStatuses,
        selectedProperties,
      },
    };
  }

  @Get("/:feedId/retry")
  @UseFilters(RetryUserFeedFilter, FeedExceptionFilter)
  async retryFailedFeed(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ): Promise<GetUserFeedOutputDto> {
    const updatedFeed = (await this.userFeedsService.retryFailedFeed(
      feed._id.toHexString()
    )) as UserFeed;

    return this.formatFeedForResponse(updatedFeed, discordUserId);
  }

  @Get("/:feedId/daily-limit")
  async getDailyLimit(
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ): Promise<GetUserFeedDailyLimitOutputDto> {
    const limit = await this.userFeedsService.getFeedDailyLimit(
      feed._id.toHexString()
    );

    if (!limit) {
      throw new NotFoundException("No limits found for feed");
    }

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
    @Param("feedId", GetUserFeedPipe) feed: UserFeed,
    @Body(ValidationPipe) { title, url, disabledCode }: UpdateUserFeedInputDto
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
      }
    )) as UserFeed;

    return this.formatFeedForResponse(updated, feed.user.discordUserId);
  }

  @Get()
  async getFeeds(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @NestedQuery(TransformValidationPipe)
    { limit, offset, search }: GetUserFeedsInputDto
  ): Promise<GetUserFeedsOutputDto> {
    const [feeds, count] = await Promise.all([
      this.userFeedsService.getFeedsByUser({
        userId: discordUserId,
        limit,
        offset,
        search,
      }),
      this.userFeedsService.getFeedCountByUser({
        userId: discordUserId,
        search,
      }),
    ]);

    return {
      results: feeds.map((feed) => ({
        id: feed._id.toHexString(),
        title: feed.title,
        url: feed.url,
        healthStatus: feed.healthStatus,
        disabledCode: feed.disabledCode,
      })),
      total: count,
    };
  }

  @Delete("/:feedId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeed(@Param("feedId", GetUserFeedPipe) feed: UserFeed) {
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
        details: con.details,
        filters: con.filters,
      }));

    const discordWebhookConnections: CreateDiscordWebhookConnectionOutputDto[] =
      feed.connections.discordWebhooks.map((con) => ({
        id: con.id.toHexString(),
        name: con.name,
        key: FeedConnectionType.DiscordWebhook,
        details: con.details,
        filters: con.filters,
      }));

    const { refreshRateSeconds } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

    return {
      result: {
        id: feed._id.toHexString(),
        title: feed.title,
        url: feed.url,
        connections: [
          ...discordChannelConnections,
          ...discordWebhookConnections,
        ],
        disabledCode: feed.disabledCode,
        healthStatus: feed.healthStatus,
        createdAt: feed.createdAt.toISOString(),
        updatedAt: feed.updatedAt.toISOString(),
        refreshRateSeconds,
      },
    };
  }
}
