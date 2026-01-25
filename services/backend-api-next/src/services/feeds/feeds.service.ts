import dayjs from "dayjs";
import type { IFeedRepository, IFeedWithFailRecord } from "../../repositories/interfaces/feed.types";
import type { IBannedFeed, IBannedFeedRepository } from "../../repositories/interfaces/banned-feed.types";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type { DiscordAuthService } from "../discord-auth/discord-auth.service";
import type { DiscordPermissionsService } from "../discord-permissions/discord-permissions.service";
import type { FeedSchedulingService } from "../feed-scheduling/feed-scheduling.service";
import { DiscordChannelType, type DiscordGuildChannel } from "../../shared/types/discord.types";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";
import {
  MissingChannelException,
  MissingChannelPermissionsException,
  UserMissingManageGuildException,
} from "../../shared/exceptions/feeds.exceptions";
import { SEND_CHANNEL_MESSAGE, VIEW_CHANNEL } from "../../shared/constants/discord-permissions";
import { FeedStatus, type DetailedFeed } from "./types";

export interface FeedsServiceDeps {
  feedRepository: IFeedRepository;
  bannedFeedRepository: IBannedFeedRepository;
  feedSchedulingService: FeedSchedulingService;
  discordApiService: DiscordApiService;
  discordAuthService: DiscordAuthService;
  discordPermissionsService: DiscordPermissionsService;
}

export class FeedsService {
  constructor(private readonly deps: FeedsServiceDeps) {}

  async canUseChannel(options: {
    channelId: string;
    userAccessToken: string;
    skipBotPermissionAssertions?: boolean;
  }): Promise<DiscordGuildChannel> {
    const { channelId, userAccessToken, skipBotPermissionAssertions } = options;
    let channel: DiscordGuildChannel;

    try {
      channel = await this.deps.discordApiService.getChannel(channelId);
    } catch (err) {
      if (err instanceof DiscordAPIError) {
        if (err.statusCode === 404) {
          throw new MissingChannelException();
        }

        if (err.statusCode === 403) {
          throw new MissingChannelPermissionsException();
        }
      }

      throw err;
    }

    const { isManager } = await this.deps.discordAuthService.userManagesGuild(
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
      !(await this.deps.discordPermissionsService.botHasPermissionInChannel(
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
    const feeds = await this.deps.feedRepository.aggregateWithFailRecords({
      guildId: serverId,
      search: options.search,
      skip: options.offset,
      limit: options.limit,
    });

    const refreshRates = await this.deps.feedSchedulingService.getRefreshRatesOfFeeds(
      feeds.map((feed) => ({
        id: feed.id,
        guild: feed.guild,
        url: feed.url,
      }))
    );

    return this.mapFeedsToDetailedFeeds(feeds, refreshRates);
  }

  async countServerFeeds(
    serverId: string,
    options?: {
      search?: string;
    }
  ): Promise<number> {
    return this.deps.feedRepository.countByGuild(serverId, options?.search);
  }

  async getBannedFeedDetails(url: string, guildId: string): Promise<IBannedFeed | null> {
    return this.deps.bannedFeedRepository.findByUrlForGuild(url, guildId);
  }

  private mapFeedsToDetailedFeeds(
    feeds: IFeedWithFailRecord[],
    refreshRates: number[]
  ): DetailedFeed[] {
    return feeds.map((feed, index) => {
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

      const { failRecord, ...feedWithoutFailRecord } = feed as IFeedWithFailRecord & { failRecord?: unknown };

      return {
        ...feedWithoutFailRecord,
        status: feedStatus,
        failReason: feed.failRecord?.reason,
        disabledReason,
        refreshRateSeconds: refreshRates[index]!,
      };
    });
  }

  private isValidFailRecord(
    failRecord: IFeedWithFailRecord["failRecord"] | null,
    requiredLifetimeHours = 18
  ): boolean {
    if (!failRecord) {
      return false;
    }

    const hoursDiff = dayjs().diff(dayjs(failRecord.failedAt), "hours");

    return hoursDiff >= requiredLifetimeHours;
  }
}
