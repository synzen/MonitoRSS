import { Models } from '@monitorss/models';
import { inject, injectable } from 'inversify';
import { Config } from '../config-schema';
import SubscriptionService from './SubscriptionService';

export interface IGuildService {
  getFeedLimit(guildId: string): Promise<number>
}

@injectable()
export default class GuildService implements IGuildService {
  constructor(
    @inject('Config') private readonly config: Config,
    @inject(SubscriptionService) private subscriptionService: SubscriptionService,
    @inject('Models') private readonly models: Models,
  ) {}

  public async getFeedLimit(guildId: string): Promise<number> {
    const [maxFeedsInSubscription, maxFeedsAsSupporter] = await Promise.all([
      this.getFeedLimitFromSubscription(guildId),
      this.getFeedLimitFromSupporter(guildId),
    ]);

    return Math.max(
      maxFeedsAsSupporter,
      maxFeedsInSubscription,
    );
  }

  private async getFeedLimitFromSubscription(guildId: string) {
    const defaultMaxFeeds = this.config.defaultMaxFeeds;
    const subscription = await this.subscriptionService.getSubscriptionOfGuild(guildId);

    return (subscription?.extra_feeds || 0) + defaultMaxFeeds;
  }

  private async getFeedLimitFromSupporter(guildId: string) {
    const { defaultMaxFeeds } = this.config;
    const supporters = await this.models.Supporter.findWithGuild(guildId);

    const maxFeedsOfDifferentSupporters = await Promise.all(
      supporters.map(s => {
        if (!s.patron) {
          return s.maxFeeds ?? defaultMaxFeeds;
        }

        return this.getFeedLimitFromPatron(s._id);
      }),
    );
    
    return Math.max(...maxFeedsOfDifferentSupporters, defaultMaxFeeds);
  }

  private async getFeedLimitFromPatron(discordId: string): Promise<number> {
    const { defaultMaxFeeds } = this.config;
    const patrons = await this.models.Patron.findByDiscordId(discordId);
    const feedLimits = patrons.map((p) => this.getFeedLimitFromPatronPledge(p.pledge));

    return Math.max(...feedLimits, defaultMaxFeeds);
  }

  private getFeedLimitFromPatronPledge(pledge: number): number {
    const { defaultMaxFeeds } = this.config;

    if (pledge >= 2000) {
      return 140;
    }

    if (pledge >= 1500) {
      return 105;
    }

    if (pledge >= 1000) {
      return 70;
    }

    if (pledge >= 500) {
      return 35;
    }

    if (pledge >= 250) {
      return 15;
    }

    return defaultMaxFeeds;
  }
}
