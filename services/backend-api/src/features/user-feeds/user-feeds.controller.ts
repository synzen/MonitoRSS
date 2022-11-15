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
  GetUserFeedDailyLimitOutputDto,
  GetUserFeedOutputDto,
  GetUserFeedsInputDto,
  GetUserFeedsOutputDto,
  UpdateUserFeedInputDto,
  UpdateUserFeedOutputDto,
} from "./dto";
import { UserFeed } from "./entities";
import { RetryUserFeedFilter } from "./filters";
import { GetUserFeedPipe } from "./pipes";
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
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ): Promise<GetUserFeedOutputDto> {
    if (feed.user.discordUserId !== discordUserId) {
      throw new NotFoundException();
    }

    return await this.formatFeedForResponse(feed, discordUserId);
  }

  @Get("/:feedId/retry")
  @UseFilters(RetryUserFeedFilter, FeedExceptionFilter)
  async retryFailedFeed(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ): Promise<GetUserFeedOutputDto> {
    if (feed.user.discordUserId !== discordUserId) {
      throw new NotFoundException();
    }

    const updatedFeed = (await this.userFeedsService.retryFailedFeed(
      feed._id.toHexString()
    )) as UserFeed;

    return this.formatFeedForResponse(updatedFeed, discordUserId);
  }

  @Get("/:feedId/daily-limit")
  async getDailyLimit(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ): Promise<GetUserFeedDailyLimitOutputDto> {
    if (feed.user.discordUserId !== discordUserId) {
      throw new NotFoundException();
    }

    const limit = await this.userFeedsService.getFeedDailyLimit(
      feed._id.toHexString()
    );

    if (!limit) {
      throw new NotFoundException();
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
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedPipe) feed: UserFeed,
    @Body(ValidationPipe) { title, url }: UpdateUserFeedInputDto
  ): Promise<UpdateUserFeedOutputDto> {
    if (feed.user.discordUserId !== discordUserId) {
      throw new ForbiddenException();
    }

    const updated = (await this.userFeedsService.updateFeedById(
      feed._id.toHexString(),
      {
        title,
        url,
      }
    )) as UserFeed;

    return {
      result: {
        id: updated._id.toHexString(),
        title: updated.title,
        url: updated.url,
      },
    };
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
      })),
      total: count,
    };
  }

  @Delete("/:feedId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeed(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Param("feedId", GetUserFeedPipe) feed: UserFeed
  ) {
    if (feed.user.discordUserId !== discordUserId) {
      throw new ForbiddenException();
    }

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
