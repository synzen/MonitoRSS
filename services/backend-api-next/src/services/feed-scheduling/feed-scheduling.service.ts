import type { Config } from "../../config";
import type {
  IFeedSchedule,
  IFeedScheduleRepository,
} from "../../repositories/interfaces/feed-schedule.types";
import type { SupportersService } from "../supporters/supporters.service";
import type { FeedDetails } from "./types";

export interface FeedSchedulingServiceDeps {
  config: Config;
  supportersService: SupportersService;
  feedScheduleRepository: IFeedScheduleRepository;
}

export class FeedSchedulingService {
  readonly defaultRefreshRateSeconds: number;

  constructor(private readonly deps: FeedSchedulingServiceDeps) {
    this.defaultRefreshRateSeconds =
      deps.config.BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES * 60;
  }

  async getRefreshRatesOfFeeds(feeds: FeedDetails[]): Promise<number[]> {
    const serverIds = Array.from(new Set(feeds.map((feed) => feed.guild)));
    const [schedules, serverBenefits] = await Promise.all([
      this.deps.feedScheduleRepository.findAllExcludingDefault(),
      this.deps.supportersService.getBenefitsOfServers(serverIds),
    ]);

    return feeds.map((feed) => {
      const feedServerBenefits = serverBenefits.find(
        (serverBenefit) => serverBenefit.serverId === feed.guild,
      );

      if (!feedServerBenefits) {
        return this.defaultRefreshRateSeconds;
      }

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
    schedules: IFeedSchedule[],
  ): number {
    for (const schedule of schedules) {
      if (schedule.feeds?.includes(feed.id)) {
        return schedule.refreshRateMinutes * 60;
      }

      const someKeywordMatch = schedule.keywords?.some((word) =>
        feed.url.includes(word),
      );

      if (someKeywordMatch) {
        return schedule.refreshRateMinutes * 60;
      }
    }

    return this.defaultRefreshRateSeconds;
  }
}
