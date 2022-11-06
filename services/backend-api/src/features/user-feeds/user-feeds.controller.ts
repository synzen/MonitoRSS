import {
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
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";

import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { FeedExceptionFilter } from "../feeds/filters";
import {
  CreateUserFeedInputDto,
  CreateUserFeedOutputDto,
  GetUserFeedsInputDto,
  GetUserFeedsOutputDto,
  UpdateUserFeedInputDto,
  UpdateUserFeedOutputDto,
} from "./dto";
import { UserFeed } from "./entities";
import { GetUserFeedPipe } from "./pipes";
import { UserFeedsService } from "./user-feeds.service";

@Controller("user-feeds")
@UseGuards(DiscordOAuth2Guard)
export class UserFeedsController {
  constructor(private readonly userFeedsService: UserFeedsService) {}

  @Post()
  @UseFilters(FeedExceptionFilter)
  async createFeed(
    @Body(ValidationPipe) { title, url }: CreateUserFeedInputDto,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ): Promise<CreateUserFeedOutputDto> {
    const result = await this.userFeedsService.addFeed(
      {
        discordUserId,
      },
      {
        title,
        url,
      }
    );

    return {
      result: {
        id: result._id.toHexString(),
        title: result.title,
        url: result.url,
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
      count,
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
}
