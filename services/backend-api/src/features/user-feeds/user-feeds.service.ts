import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import {
  BannedFeedException,
  FeedLimitReachedException,
} from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedModel } from "./entities";
import _ from "lodash";
import { SupportersService } from "../supporters/supporters.service";
import {
  GetFeedArticlePropertiesInput,
  GetFeedArticlePropertiesOutput,
  GetFeedArticlesInput,
  GetFeedArticlesOutput,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "./types";
import { FeedNotFailedException } from "./exceptions/feed-not-failed.exception";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MessageBrokerQueue } from "../../common/constants/message-broker-queue.constants";
import { FeedFetcherApiService } from "../../services/feed-fetcher/feed-fetcher-api.service";

interface GetFeedsInput {
  userId: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface GetFeedsCountInput {
  userId: string;
  search?: string;
}

interface UpdateFeedInput {
  title?: string;
  url?: string;
  disabledCode?: UserFeedDisabledCode | null;
  passingComparisons?: string[];
  blockingComparisons?: string[];
}

@Injectable()
export class UserFeedsService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly supportersService: SupportersService,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly feedFetcherApiService: FeedFetcherApiService,
    private readonly amqpConnection: AmqpConnection
  ) {}

  async addFeed(
    {
      discordUserId,
    }: {
      discordUserId: string;
    },
    {
      title,
      url,
    }: {
      title: string;
      url: string;
    }
  ) {
    const { maxUserFeeds, maxDailyArticles } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const feedCount = await this.userFeedModel
      .where({
        "user.discordUserId": discordUserId,
      })
      .countDocuments();

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    await this.checkUrlIsValid(url);

    const created = await this.userFeedModel.create({
      title,
      url,
      user: {
        discordUserId,
      },
    });

    // Primarily used to set up the daily article limit for it to be fetched
    await this.feedHandlerService.initializeFeed(created._id.toHexString(), {
      maxDailyArticles,
    });

    return created;
  }

  async getFeedById(id: string) {
    return this.userFeedModel.findById(id).lean();
  }

  async getFeedsByUser({
    userId,
    limit = 10,
    offset = 0,
    search,
  }: GetFeedsInput) {
    const query = this.userFeedModel.find({
      "user.discordUserId": userId,
    });

    if (search) {
      query.where("title").find({
        $or: [
          {
            title: new RegExp(_.escapeRegExp(search), "i"),
          },
          {
            url: new RegExp(_.escapeRegExp(search), "i"),
          },
        ],
      });
    }

    if (limit) {
      query.limit(limit);
    }

    if (offset) {
      query.skip(offset);
    }

    return query
      .sort({
        createdAt: -1,
      })
      .lean();
  }

  async getFeedCountByUser({ userId, search }: GetFeedsCountInput) {
    const query = this.userFeedModel.where({
      "user.discordUserId": userId,
    });

    if (search) {
      query.where("title").find({
        $or: [
          {
            title: new RegExp(_.escapeRegExp(search), "i"),
          },
          {
            url: new RegExp(_.escapeRegExp(search), "i"),
          },
        ],
      });
    }

    return query.countDocuments();
  }

  async getFeedRequests({
    skip,
    limit,
    url,
  }: {
    skip: number;
    limit: number;
    url: string;
  }) {
    return this.feedFetcherApiService.getRequests({
      limit,
      skip,
      url,
    });
  }

  async updateFeedById(id: string, updates: UpdateFeedInput) {
    const query = this.userFeedModel.findByIdAndUpdate(
      id,
      {
        $unset: {
          ...(updates.disabledCode === null && {
            disabledCode: "",
          }),
        },
      },
      {
        new: true,
      }
    );

    if (updates.title) {
      query.set("title", updates.title);
    }

    if (updates.url) {
      await this.checkUrlIsValid(updates.url);
      query.set("url", updates.url);
    }

    if (updates.disabledCode) {
      query.set("disabledCode", updates.disabledCode);
    }

    if (updates.passingComparisons) {
      query.set("passingComparisons", updates.passingComparisons);
    }

    if (updates.blockingComparisons) {
      query.set("blockingComparisons", updates.blockingComparisons);
    }

    return query.lean();
  }

  async deleteFeedById(id: string) {
    await this.userFeedModel.findByIdAndDelete(id);
    this.amqpConnection.publish<{ data: { feed: { id: string } } }>(
      "",
      MessageBrokerQueue.FeedDeleted,
      { data: { feed: { id } } }
    );
  }

  async retryFailedFeed(feedId: string) {
    const feed = await this.userFeedModel.findById(feedId);

    if (!feed) {
      throw new Error(
        `Feed ${feedId} not found while attempting to retry failed feed`
      );
    }

    if (feed.healthStatus !== UserFeedHealthStatus.Failed) {
      throw new FeedNotFailedException(
        `Feed ${feedId} is not in a failed state, cannot retry it`
      );
    }

    await this.feedFetcherService.fetchFeed(feed.url, {
      fetchOptions: {
        useServiceApi: true,
        useServiceApiCache: false,
      },
    });

    return this.userFeedModel
      .findByIdAndUpdate(
        feedId,
        {
          healthStatus: UserFeedHealthStatus.Ok,
          $unset: {
            disabledCode: "",
          },
        },
        {
          new: true,
        }
      )
      .lean();
  }

  async getFeedDailyLimit(feedId: string) {
    const {
      results: { limits },
    } = await this.feedHandlerService.getRateLimits(feedId);

    return limits.find((limit) => limit.windowSeconds === 86400);
  }

  async getFeedArticles({
    limit,
    url,
    random,
    filters,
    selectProperties,
    skip,
    formatter,
  }: GetFeedArticlesInput): Promise<GetFeedArticlesOutput> {
    return this.feedHandlerService.getArticles({
      url,
      limit,
      random,
      filters,
      skip: skip || 0,
      selectProperties,
      formatter,
    });
  }

  async getFeedArticleProperties({
    url,
  }: GetFeedArticlePropertiesInput): Promise<GetFeedArticlePropertiesOutput> {
    const { articles, requestStatus } =
      await this.feedHandlerService.getArticles({
        url,
        limit: 10,
        random: false,
        skip: 0,
        selectProperties: ["*"],
        formatter: {
          options: {
            formatTables: false,
            stripImages: false,
            dateFormat: undefined,
          },
        },
      });

    const properties = Array.from(
      new Set(articles.map((article) => Object.keys(article)).flat())
    ).sort();

    return {
      requestStatus,
      properties,
    };
  }

  private async checkUrlIsValid(url: string) {
    await this.feedFetcherService.fetchFeed(url, {
      fetchOptions: {
        useServiceApi: true,
        useServiceApiCache: false,
      },
    });

    const bannedRecord = await this.feedsService.getBannedFeedDetails(url, "");

    if (bannedRecord) {
      throw new BannedFeedException();
    }
  }
}
