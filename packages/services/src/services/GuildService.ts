import { FeedFetcher } from '@monitorss/feed-fetcher';
import { Feed, ModelExports } from '@monitorss/models';
import { inject, injectable } from 'inversify';
import { Config } from '../config-schema';
import SubscriptionService from './SubscriptionService';
import normalizeUrl from 'normalize-url';
import ERROR_CODES from './constants/error-codes';

export interface IGuildService {
  getFeedLimit(guildId: string): Promise<number>
}

@injectable()
export default class GuildService implements IGuildService {
  constructor(
    @inject('Config') private readonly config: Config,
    @inject(SubscriptionService) private subscriptionService: SubscriptionService,
    @inject('ModelExports') private readonly models: ModelExports,
  ) {}

  async getFeeds(guildId: string) {
    return this.models.Feed.findByField('guild', guildId);
  }

  async removeFeed(feedId: string) {
    await this.models.Feed.removeById(feedId);
  }

  /**
   * Verify and add a set of feed URLs to a guild's channel.
   *
   * @param guildId The guild ID to add the feed to
   * @param channelId The channel ID in the guild to add the feed to
   * @param inputUrls The feed URLs to add
   * @returns Returns an array of results for each URL. If there was an error, the "error"
   * field of a result object will be populated. The possible errors are:
   * 
   * - `EXCEEDED_FEED_LIMIT`: The guild has reached its feed limit
   * - `EXISTS_IN_CHANNEL`: The feed already exists in the channel
   * - `INTERNAL`: An unknown error occurred. The internal error message may be surfaced up
   *    to the user.
   */
  async verifyAndAddFeeds(guildId: string, channelId: string, inputUrls: string[]) {
    const normalizedUrls = [...new Set(inputUrls.map(url => normalizeUrl(url)))];
    const remaining = await this.getRemainingFeedCount(guildId);

    if (remaining <= 0 || normalizedUrls.length > remaining) {
      return normalizedUrls.map((url) => ({
        url,
        error: ERROR_CODES.EXCEEDED_FEED_LIMIT,
        message: 'The feed limit will be exceeded for this guild.',
      }));
    }

    const urlsInChannel = new Set((await this.models.Feed.findByField('channel', channelId))
      .map((f) => f.url));

    return Promise.all(
      normalizedUrls.map(async (url) => {
        try {
          if (urlsInChannel.has(url)) {
            return {
              url,
              error: ERROR_CODES.EXISTS_IN_CHANNEL,
              message: 'The feed already exists in this channel',
            };
          }

          const toSave = await this.getFeedToSave(guildId, channelId, url);
          await this.models.Feed.insert(toSave);
          
          return {
            url,
          };
        } catch (err) {
          return {
            url,
            error: ERROR_CODES.INTERNAL,
            message: (err as Error).message,
          };
        }
      }),
    );
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
