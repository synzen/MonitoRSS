import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { BannedFeedException } from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedModel } from "./entities";
import _ from "lodash";

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
}

@Injectable()
export class UserFeedsService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly discordAuthService: DiscordAuthService
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
    await this.checkUrlIsValid(url);

    const created = await this.userFeedModel.create({
      title,
      url,
      user: {
        discordUserId,
      },
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

  async updateFeedById(id: string, updates: UpdateFeedInput) {
    const query = this.userFeedModel.findByIdAndUpdate(
      id,
      {},
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

    return query.lean();
  }

  async deleteFeedById(id: string) {
    await this.userFeedModel.findByIdAndDelete(id);
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
