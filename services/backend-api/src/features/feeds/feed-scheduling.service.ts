import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { SupportersService } from "../supporters/supporters.service";
import {
  FeedSchedule,
  FeedScheduleModel,
} from "./entities/feed-schedule.entity";

interface FeedDetails {
  _id: string;
  url: string;
  guild: string;
}

@Injectable()
export class FeedSchedulingService {
  defaultRefreshRateSeconds: number;

  constructor(
    private readonly supportersService: SupportersService,
    private readonly configService: ConfigService,
    @InjectModel(FeedSchedule.name)
    private readonly feedScheduleModel: FeedScheduleModel
  ) {
    this.defaultRefreshRateSeconds =
      (this.configService.get(
        "BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES"
      ) as number) * 60;
  }

  async getAllSchedules(): Promise<FeedSchedule[]> {
    return this.feedScheduleModel.find({}).lean();
  }

  async findSchedulesOfRefreshRate(
    refreshRateSeconds: number
  ): Promise<FeedSchedule[]> {
    return this.feedScheduleModel
      .find({
        refreshRateMinutes: Math.round(refreshRateSeconds / 60),
      })
      .lean();
  }

  async findSchedulesNotMatchingRefreshRate(
    refreshRateSeconds: number
  ): Promise<FeedSchedule[]> {
    return this.feedScheduleModel.find({
      refreshRateMinutes: {
        $ne: Math.round(refreshRateSeconds / 60),
      },
    });
  }

  /**
   * Determine the refresh rate of the given feeds.
   *
   * @returns The refresh rate in seconds
   */
  async getRefreshRatesOfFeeds(feeds: FeedDetails[]) {
    const serverIds = Array.from(new Set(feeds.map((feed) => feed.guild)));
    const [schedules, serverBenefits] = await Promise.all([
      this.feedScheduleModel
        .find({
          name: {
            $ne: "default",
          },
        })
        .lean(),
      this.supportersService.getBenefitsOfServers(serverIds),
    ]);

    return feeds.map((feed) => {
      const feedServerBenefits = serverBenefits.find(
        (serverBenefit) => serverBenefit.serverId === feed.guild
      );

      if (!feedServerBenefits) {
        return this.defaultRefreshRateSeconds;
      }

      // Maintaining some legacy logic for now
      if (
        feedServerBenefits.hasSupporter &&
        feedServerBenefits.refreshRateSeconds !== undefined &&
        !feed.url.includes("feed43")
      ) {
        return feedServerBenefits.refreshRateSeconds;
      }

      return this.getRefreshRateOfFeedFromSchedules(feed, schedules);
    });
  }

  private getRefreshRateOfFeedFromSchedules(
    feed: FeedDetails,
    schedules: FeedSchedule[]
  ) {
    for (const schedule of schedules) {
      if (schedule?.feeds?.includes(feed._id)) {
        return schedule.refreshRateMinutes * 60;
      }

      const someKeywordMatch = schedule?.keywords?.some((word) =>
        feed.url.includes(word)
      );

      if (someKeywordMatch) {
        return schedule.refreshRateMinutes * 60;
      }
    }

    return this.defaultRefreshRateSeconds;
  }
}
