import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { BannedFeedException } from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedModel } from "./entities";

@Injectable()
export class UserFeedsService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly discordAuthService: DiscordAuthService
  ) {}

  async addFeed(
    userAccessToken: string,
    {
      title,
      url,
    }: {
      title: string;
      url: string;
    }
  ) {
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

    const user = await this.discordAuthService.getUser(userAccessToken);

    const created = await this.userFeedModel.create({
      title,
      url,
      user: {
        discordUserId: user.id,
      },
    });

    return created;
  }
}
