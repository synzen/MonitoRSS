import { FeedFetcher } from '@monitorss/feed-fetcher';
import { Feed, ModelExports } from '@monitorss/models';
import { inject, injectable } from 'inversify';
import { Config } from '../config-schema';
import UserError from '../errors/UserError';
import SubscriptionService from './SubscriptionService';

export interface IGuildService {
  getFeedLimit(guildId: string): Promise<number>
}

interface FeedAdditionResult {
  url: string;
  error?: string;
}

@injectable()
export default class GuildService implements IGuildService {
  constructor(
    @inject('Config') private readonly config: Config,
    @inject(SubscriptionService) private subscriptionService: SubscriptionService,
    @inject('ModelExports') private readonly models: ModelExports,
  ) {}

  static errors = {
    EXCEEDED_FEED_LIMIT: 'You will exceed your feed limit',
    EXISTS_IN_CHANNEL: 'Already exists in this channel',
  };

  async verifyAndAddFeeds(guildId: string, channelId: string, urls: string[]) {
    const remaining = await this.getRemainingFeedCount(guildId);

    if (remaining <= 0 || urls.length > remaining) {
      throw new UserError(GuildService.errors.EXCEEDED_FEED_LIMIT);
    }

    const urlsInChannel = new Set((await this.models.Feed.findByField('channel', channelId))
      .map((f) => f.url));

    const saveResults = await Promise.allSettled(
      urls.map(async (url) => {
        if (urlsInChannel.has(url)) {
          throw new Error(GuildService.errors.EXISTS_IN_CHANNEL);
        }

        const toSave = await this.getFeedToSave(guildId, channelId, url);
        await this.models.Feed.insert(toSave);
        
        return url;
      }),
    );

    const addResults: FeedAdditionResult[] = saveResults
      .map((result, index) => {
        const url = urls[index];

        if (result.status === 'rejected') {
          return { url, error: result.reason.message  };
        }

        return { url };
      });

    return addResults;
  }

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

  private async getRemainingFeedCount(guildId: string) {
    const [ currentTotal, max ] = await Promise.all([
      this.models.Feed.countInGuild(guildId),
      this.getFeedLimit(guildId),
    ]);

    return max - currentTotal;
  }

  private async getFeedToSave(guildId: string, channelId: string, url: string): Promise<Feed> {
    const feedFetcher = new FeedFetcher();
    const { articleList } = await feedFetcher.fetchFeed(url);
    
    return {
      url,
      title: articleList[0]?.meta?.title || 'Untitled',
      channel: channelId,
      guild: guildId,
    };
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
