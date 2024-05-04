/* eslint-disable max-len */
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
  StreamableFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import { GetFeedArticlesOutputDto } from "./dto/GetFeedArticlesOutput.dto";
import { GetFeedOutputDto } from "./dto/GetFeedOutput.dto";
import { UpdateFeedInputDto } from "./dto/update-feed-input.dto";
import { UpdateFeedOutputDto } from "./dto/UpdateFeedOutput.dto";
import { FeedsService } from "./feeds.service";
import { UserManagesFeedServerGuard } from "./guards/UserManagesFeedServer.guard";
import { GetFeedPipe } from "./pipes/GetFeed.pipe";
import { DetailedFeed } from "./types/detailed-feed.type";
import { SupportersService } from "../supporters/supporters.service";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import { HttpCacheInterceptor } from "../../common/interceptors/http-cache-interceptor";
import _ from "lodash";
import { CloneFeedInputDto } from "./dto/CloneFeedInput.dto";
import { CloneFeedOutputDto } from "./dto/CloneFeedOutput.dto";
import {
  ConverToUserFeedExceptionFilter,
  FeedExceptionFilter,
  UpdateFeedExceptionFilter,
} from "./filters";
import FlattenedJSON from "../../services/feed-fetcher/utils/FlattenedJSON";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import {
  WebhookInvalidException,
  WebhookMissingException,
  WebhooksDisabledException,
} from "./exceptions";
import { convertToFlatDiscordEmbeds } from "../../utils/convert-to-flat-discord-embed";
import { FEED_DISABLED_LEGACY_CODES } from "./constants";
import { LegacyFeedConversionService } from "../legacy-feed-conversion/legacy-feed-conversion.service";
import { randomUUID } from "crypto";
import { DiscordWebhook } from "../../common";
import { UserFeed } from "../user-feeds/entities";
import { CacheTTL } from "@nestjs/cache-manager";

@Controller("feeds")
@UseGuards(DiscordOAuth2Guard)
export class FeedsController {
  constructor(
    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly supportersService: SupportersService,
    private readonly webhooksService: DiscordWebhooksService,
    private readonly legacyFeedConversionService: LegacyFeedConversionService
  ) {}

  @Get(":feedId")
  @UseGuards(UserManagesFeedServerGuard)
  async getFeed(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed
  ): Promise<GetFeedOutputDto> {
    return GetFeedOutputDto.fromEntity(feed);
  }

  @Get(":feedId/user-feed")
  @UseGuards(UserManagesFeedServerGuard)
  @UseFilters(ConverToUserFeedExceptionFilter)
  async convert(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed,
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const result = await this.legacyFeedConversionService.convertToUserFeed(
      feed,
      {
        discordUserId,
      }
    );

    return {
      result: {
        id: (result as UserFeed)._id.toHexString(),
      },
    };
  }

  @Delete(":feedId")
  @UseGuards(UserManagesFeedServerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeed(@Param("feedId", GetFeedPipe) feed: DetailedFeed) {
    await this.feedsService.removeFeed(feed._id.toHexString());
  }

  @Get(":feedId/refresh")
  @UseGuards(UserManagesFeedServerGuard)
  @UseFilters(FeedExceptionFilter)
  async refreshFeed(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed
  ): Promise<GetFeedOutputDto> {
    const updatedFeed = await this.feedsService.refresh(feed._id);

    return GetFeedOutputDto.fromEntity(updatedFeed);
  }

  @Post(":feedId/clone")
  @UseGuards(UserManagesFeedServerGuard)
  async cloneFeed(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed,
    @Body(TransformValidationPipe) cloneFeedInput: CloneFeedInputDto
  ): Promise<CloneFeedOutputDto> {
    const { targetFeedIds, properties } = cloneFeedInput;

    if (
      !(await this.feedsService.allFeedsBelongToGuild(
        targetFeedIds,
        feed.guild
      ))
    ) {
      throw new BadRequestException(
        "Some feeds do not belong to the source guild"
      );
    }

    const clonedFeeds = await this.feedsService.cloneFeed(
      feed,
      targetFeedIds,
      properties
    );

    return CloneFeedOutputDto.fromEntity(clonedFeeds);
  }

  @Patch(":feedId")
  @UseGuards(UserManagesFeedServerGuard)
  @UseFilters(UpdateFeedExceptionFilter)
  async updateFeed(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed,
    @Body(TransformValidationPipe) updateFeedInput: UpdateFeedInputDto
  ): Promise<UpdateFeedOutputDto> {
    let foundWebhook: DiscordWebhook | null = null;

    if (updateFeedInput.webhook?.id) {
      if (!(await this.supportersService.serverCanUseWebhooks(feed.guild))) {
        throw new WebhooksDisabledException(
          "This server does not have webhooks enabled"
        );
      }

      foundWebhook = await this.webhooksService.getWebhook(
        updateFeedInput.webhook.id
      );

      if (!foundWebhook) {
        throw new WebhookMissingException("Webhook not found");
      }

      if (!foundWebhook.token) {
        throw new WebhookInvalidException();
      }
    }

    let filtersUpdate: Record<string, string[]> | undefined = undefined;

    if (updateFeedInput.filters) {
      const inputFilters = _.uniqBy(
        updateFeedInput.filters,
        (data) => data.category + data.value
      ).map((data) => ({
        category: data.category,
        value: data.value.trim(),
      }));

      filtersUpdate = {};

      for (const { category, value } of inputFilters) {
        if (!filtersUpdate[category]) {
          filtersUpdate[category] = [];
        }

        filtersUpdate[category].push(value);
      }
    }

    const updatedFeed = await this.feedsService.updateOne(feed._id, {
      title: updateFeedInput.title,
      text: updateFeedInput.text,
      filters: filtersUpdate,
      webhook: {
        id: updateFeedInput.webhook?.id,
        name: updateFeedInput.webhook?.name,
        iconUrl: updateFeedInput.webhook?.iconUrl,
        token: foundWebhook?.token,
      },
      embeds: convertToFlatDiscordEmbeds(updateFeedInput.embeds)?.map((e) => ({
        ...e,
        fields: e.fields?.map((f) => ({
          id: randomUUID(),
          ...f,
        })),
      })),
      checkDates: updateFeedInput.checkDates,
      imgLinksExistence: updateFeedInput.imgLinksExistence,
      imgPreviews: updateFeedInput.imgPreviews,
      formatTables: updateFeedInput.formatTables,
      checkTitles: updateFeedInput.checkTitles,
      splitMessage: updateFeedInput.splitMessage,
      ncomparisons: updateFeedInput.ncomparisons,
      pcomparisons: updateFeedInput.pcomparisons,
      ...(updateFeedInput.channelId && {
        channelId: updateFeedInput.channelId,
      }),
    });

    if (
      (updateFeedInput.text || updateFeedInput.embeds) &&
      updatedFeed.disabled === FEED_DISABLED_LEGACY_CODES.BAD_FORMAT
    ) {
      await this.feedsService.enableFeed(updatedFeed._id.toHexString());
    }

    return GetFeedOutputDto.fromEntity(updatedFeed);
  }

  @Get("/:feedId/articles")
  @UseGuards(UserManagesFeedServerGuard)
  @UseFilters(new FeedExceptionFilter())
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60 * 5)
  async getFeedArticles(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed
  ): Promise<GetFeedArticlesOutputDto> {
    const { articles } = await this.feedFetcherService.fetchFeed(feed.url, {
      formatTables: feed.formatTables,
      imgLinksExistence: feed.imgLinksExistence,
      imgPreviews: feed.imgPreviews,
      fetchOptions: {
        useServiceApi: feed.isFeedv2 || false,
        useServiceApiCache: true,
      },
    });

    return {
      result: articles.map((a) => a.toJSON()),
    };
  }

  @Get("/:feedId/articles/dump")
  @UseGuards(UserManagesFeedServerGuard)
  @UseFilters(new FeedExceptionFilter())
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60 * 5)
  async getFeedArticlesDump(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed
  ): Promise<StreamableFile> {
    const inputStream = await this.feedFetcherService.fetchFeedStream(feed.url);

    const { articleList } = await this.feedFetcherService.parseFeed(
      inputStream
    );

    let textOutput = "";

    for (let i = 0; i < articleList.length; ++i) {
      const article = articleList[i];
      textOutput +=
        new FlattenedJSON(article, feed, {
          dateFallback: false,
          timeFallback: false,
          dateFormat: "ddd, D MMMM YYYY, h:mm A z",
          formatTables: false,
          imgLinksExistence: true,
          imgPreviews: true,
          timezone: "UTC",
        }).text + "\r\n\r\n";
    }

    textOutput = textOutput.trim();
    const buffer = Buffer.from(textOutput);

    return new StreamableFile(buffer, {
      disposition: "attachment; filename=dump.txt",
    });
  }

  @Get("/:feedId/articles/raw-dump")
  @UseGuards(UserManagesFeedServerGuard)
  @UseFilters(new FeedExceptionFilter())
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60 * 5)
  async getFeedArticlesRawDump(
    @Param("feedId", GetFeedPipe) feed: DetailedFeed
  ): Promise<StreamableFile> {
    const inputStream = await this.feedFetcherService.fetchFeedStream(feed.url);

    const { articleList } = await this.feedFetcherService.parseFeed(
      inputStream
    );

    const buffer = Buffer.from(JSON.stringify(articleList, null, 2));

    return new StreamableFile(buffer, {
      disposition: "attachment; filename=dump.txt",
    });
  }
}
