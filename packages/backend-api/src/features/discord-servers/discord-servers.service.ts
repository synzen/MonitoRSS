import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FailRecord,
  FailRecordModel,
} from '../feeds/entities/fail-record.entity';
import { Feed, FeedModel } from '../feeds/entities/Feed.entity';
import { DetailedFeed, DetailedFeedStatus } from './types/DetailedFeed.type';

@Injectable()
export class DiscordServersService {
  constructor(
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    @InjectModel(FailRecord.name)
    private readonly failRecordModel: FailRecordModel,
  ) {}

  async getServerFeeds(
    serverId: string,
    options: {
      limit: number;
      offset: number;
    },
  ): Promise<DetailedFeed[]> {
    const feeds = await this.feedModel
      .find({ guild: serverId })
      .limit(options.limit)
      .skip(options.offset)
      .sort({ addedAt: -1 })
      .lean();

    return this.withFeedStatuses(feeds);
  }

  async countServerFeeds(serverId: string): Promise<number> {
    return this.feedModel.countDocuments({ serverId });
  }

  private async withFeedStatuses(feed: Feed[]) {
    const feedUrls = feed.map((feed) => feed.url);

    const failRecords = await this.failRecordModel.find({
      url: { $in: feedUrls },
    });

    const detailedFeeds = feed.map((feed) => ({
      ...feed,
      status: failRecords.some((record) => record._id === feed.url)
        ? DetailedFeedStatus.FAILED
        : DetailedFeedStatus.OK,
    }));

    return detailedFeeds;
  }
}
