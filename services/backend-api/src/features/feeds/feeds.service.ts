import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Feed, FeedDocument, FeedModel } from "./entities/feed.entity";
import { DetailedFeed } from "./types/detailed-feed.type";
import { FilterQuery } from "mongoose";
import _ from "lodash";
import { FailRecord } from "./entities/fail-record.entity";
import { FeedStatus } from "./types/FeedStatus.type";
import dayjs from "dayjs";
import { FeedSchedulingService } from "./feed-scheduling.service";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import {
  MissingChannelException,
  MissingChannelPermissionsException,
  UserMissingManageGuildException,
} from "./exceptions";
import { BannedFeed, BannedFeedModel } from "./entities/banned-feed.entity";
import { DiscordChannelType } from "../../common";
import { DiscordPermissionsService } from "../discord-auth/discord-permissions.service";
import {
  SEND_CHANNEL_MESSAGE,
  VIEW_CHANNEL,
} from "../discord-auth/constants/permissions";

interface PopulatedFeed extends Feed {
  failRecord?: FailRecord;
}

@Injectable()
export class FeedsService {
  constructor(
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    @InjectModel(BannedFeed.name)
    private readonly bannedFeedModel: BannedFeedModel,
    private readonly feedSchedulingService: FeedSchedulingService,
    private readonly discordApiService: DiscordAPIService,
    private readonly discordAuthService: DiscordAuthService,
    private readonly discordPermissionsService: DiscordPermissionsService
  ) {}

  async canUseChannel({
    channelId,
    userAccessToken,
    skipBotPermissionAssertions,
  }: {
    channelId: string;
    userAccessToken: string;
    skipBotPermissionAssertions?: boolean;
  }) {
    let channel;

    try {
      channel = await this.discordApiService.getChannel(channelId);
    } catch (err) {
      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          throw new MissingChannelPermissionsException();
        }
      }

      throw err;
    }

    const { isManager } = await this.discordAuthService.userManagesGuild(
      userAccessToken,
      channel.guild_id
    );

    if (!isManager) {
      throw new UserMissingManageGuildException();
    }

    if (channel.type === DiscordChannelType.PUBLIC_THREAD) {
      return channel;
    }

    if (
      channel.permission_overwrites &&
      !skipBotPermissionAssertions &&
      !(await this.discordPermissionsService.botHasPermissionInChannel(
        channel,
        [SEND_CHANNEL_MESSAGE, VIEW_CHANNEL]
      ))
    ) {
      throw new MissingChannelPermissionsException();
    }

    return channel;
  }

  async getServerFeeds(
    serverId: string,
    options: {
      search?: string;
      limit: number;
      offset: number;
    }
  ): Promise<DetailedFeed[]> {
    const feeds = await this.findFeeds(
      {
        guild: serverId,
      },
      {
        search: options.search,
        limit: options.limit,
        skip: options.offset,
      }
    );

    return feeds;
  }

  async countServerFeeds(
    serverId: string,
    options?: {
      search?: string;
    }
  ): Promise<number> {
    const query: FilterQuery<Feed> = {
      guild: serverId,
    };

    if (options?.search) {
      query.$or = [
        {
          title: new RegExp(_.escapeRegExp(options.search), "i"),
        },
        {
          url: new RegExp(_.escapeRegExp(options.search), "i"),
        },
      ];
    }

    return this.feedModel.countDocuments(query);
  }

  private async findFeeds(
    filter: FilterQuery<FeedDocument>,
    options: {
      search?: string;
      limit: number;
      skip: number;
    }
  ): Promise<DetailedFeed[]> {
    const match = {
      ...filter,
    };

    if (options.search) {
      match.$or = [
        {
          title: new RegExp(_.escapeRegExp(options.search), "i"),
        },
        {
          url: new RegExp(_.escapeRegExp(options.search), "i"),
        },
      ];
    }

    const feeds: PopulatedFeed[] = await this.feedModel.aggregate([
      {
        $match: match,
      },
      {
        $sort: {
          addedAt: -1,
        },
      },
      {
        $skip: options.skip,
      },
      {
        $limit: options.limit,
      },
      {
        $lookup: {
          from: "fail_records",
          localField: "url",
          foreignField: "_id",
          as: "failRecord",
        },
      },
      {
        $addFields: {
          failRecord: {
            $first: "$failRecord",
          },
        },
      },
    ]);

    const refreshRates =
      await this.feedSchedulingService.getRefreshRatesOfFeeds(
        feeds.map((feed) => ({
          _id: feed._id.toHexString(),
          guild: feed.guild,
          url: feed.url,
        }))
      );

    const withStatuses = feeds.map((feed, index) => {
      let feedStatus: FeedStatus;

      if (this.isValidFailRecord(feed.failRecord || null)) {
        feedStatus = FeedStatus.FAILED;
      } else if (feed.failRecord) {
        feedStatus = FeedStatus.FAILING;
      } else if (feed.disabled === "CONVERTED_USER_FEED") {
        feedStatus = FeedStatus.CONVERTED_TO_USER;
      } else if (feed.disabled) {
        feedStatus = FeedStatus.DISABLED;
      } else {
        feedStatus = FeedStatus.OK;
      }

      let disabledReason = feed.disabled;

      if (feed.disabled === "DISABLED_FOR_PERSONAL_ROLLOUT") {
        disabledReason =
          "Deprecated for personal feeds. Must convert to personal feed to restore function.";
      }

      return {
        ...feed,
        status: feedStatus,
        failReason: feed.failRecord?.reason,
        disabledReason,
        refreshRateSeconds: refreshRates[index],
      };
    });

    withStatuses.forEach((feed) => {
      delete feed.failRecord;
    });

    return withStatuses;
  }

  async getBannedFeedDetails(url: string, guildId: string) {
    return this.bannedFeedModel.findOne({
      url: url,
      $or: [
        {
          guildIds: guildId,
        },
        {
          guildIds: {
            $size: 0,
          },
        },
      ],
    });
  }

  /**
   * See if a fail record should be valid and eligible for a refresh. If a fail record is invalid,
   * then it's still on cycle.
   *
   * @param failRecord The fail record to check
   * @param requiredLifetimeHours How long the fail record should be in the database to consider
   *  feeds as failures. Hardcoded as 18 for now to match the config until a separate service is
   *  ready to handle fail records.
   * @returns
   */
  private isValidFailRecord(
    failRecord: FailRecord | null,
    requiredLifetimeHours = 18
  ) {
    if (!failRecord) {
      return false;
    }

    const hoursDiff = dayjs().diff(dayjs(failRecord.failedAt), "hours");

    return hoursDiff >= requiredLifetimeHours;
  }
}
