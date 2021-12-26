import { inject, injectable } from 'inversify';
import { SubscriptionService } from '.';
import { Config } from '../config-schema';
import FailRecordService from './FailRecordService';
import PatronService from './PatronService';
import ScheduleService, { ScheduleOutput } from './ScheduleService';
import SupporterService from './SupporterService';

interface FeedInput {
  id: string
  url: string
  guildId: string
}

interface FeedSchedule {
  name: string
  refreshRateMinutes: number
}

@injectable()
export default class FeedSchedulingService {
  constructor(
    @inject(ScheduleService) private readonly scheduleService: ScheduleService,
    @inject(SubscriptionService) private readonly subscriptionService: SubscriptionService,
    @inject(SupporterService) private readonly supporterService: SupporterService,
    @inject(PatronService) private readonly patronService: PatronService,
    @inject(FailRecordService) private readonly failRecordService: FailRecordService,
    @inject('Config') private readonly config: Config,
  ) {}

  static COLLECTION_NAME = 'schedules' as const;

  /**
   * Determine the schedules of multiple feeds based on their url or id.
   *
   * @param feeds The feeds to determine the schedules for.
   * @returns The schedules of the feeds.
   */
  async determineSchedules(
    feeds: Array<FeedInput>,
  ): Promise<(FeedSchedule | null)[]> {
    const schedules = await this.scheduleService.findAll();

    const failedStatuses = await this.failRecordService.getFailedStatuses(feeds.map((f) => f.url));

    return Promise.all(feeds.map(async (feed, index) => {
      const failedStatus = failedStatuses[index];

      if (failedStatus) {
        return null;
      }

      return this.determineSchedule(schedules, feed);
    }));
  }

  private async determineSchedule(
    allSchedules: ScheduleOutput[],
    feed: FeedInput,
  ): Promise<FeedSchedule> {
    const {
      vipEnabled,
      vipRefreshRateMinutes,
      defaultRefreshRateMinutes,
    } = this.config;

    const { url, id } = feed;

    if (vipEnabled && !url.includes('feed43')) {
      const isVip = await this.hasVipSchedule(feed);

      if (isVip) {
        return {
          name: 'vip',
          refreshRateMinutes: vipRefreshRateMinutes,
        };
      }
    }

    const matchedSchedule = allSchedules.find(s =>  {
      const { keywords, feeds } = s;

      const matchedUrl = keywords.some(keyword => url.includes(keyword));
      const matchedId = feeds.some(feedId => feedId === id);

      return matchedUrl || matchedId;
    });

    if (matchedSchedule) {
      return {
        name: matchedSchedule.name,
        refreshRateMinutes: matchedSchedule.refreshRateMinutes,
      };
    }

    return {
      name: 'default',
      refreshRateMinutes: defaultRefreshRateMinutes,
    };
  }

  private async hasVipSchedule(feed: FeedInput): Promise<boolean> {
    const {
      vipRefreshRateMinutes,
    } = this.config;

    // Check subscriptions
    const subscription = await this.subscriptionService.getSubscriptionOfGuild(feed.guildId);

    if (subscription) {
      return !subscription.ignore_refresh_rate_benefit
        && subscription.refresh_rate <= vipRefreshRateMinutes * 60;
    }

    // Check supporter
    const supporter = await this.supporterService.findWithGuild(feed.guildId);

    const someSupporterIsNonPatron = supporter.some(s => !s.patron);

    if (someSupporterIsNonPatron) {
      return true;
    }

    // Check patrons
    const patronSupporterDiscordIds = supporter.filter(s => s.patron).map((s) => String(s._id));

    const validPatrons = await Promise.all(patronSupporterDiscordIds
      .map((id) => this.patronService.findByDiscordId(id)));

    return validPatrons.some((validPatron) => validPatron);
  }

}
