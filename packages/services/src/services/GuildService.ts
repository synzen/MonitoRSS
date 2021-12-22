import { FeedFetcher } from '@monitorss/feed-fetcher';
import { inject, injectable } from 'inversify';
import { Config } from '../config-schema';
import SubscriptionService from './SubscriptionService';
import normalizeUrl from 'normalize-url';
import ERROR_CODES from './constants/error-codes';
import FeedService from './FeedService';
import SupporterService from './SupporterService';
import PatronService from './PatronService';

export interface IGuildService {
  getFeedLimit(guildId: string): Promise<number>
}

@injectable()
export default class GuildService implements IGuildService {
  constructor(
    @inject('Config') private readonly config: Config,
    @inject(SubscriptionService) private subscriptionService: SubscriptionService,
    @inject(FeedService) private readonly feedService: FeedService,
    @inject(SupporterService) private readonly supporterService: SupporterService,
    @inject(PatronService) private readonly patronService: PatronService,
  ) {}

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

    const urlsInChannel = new Set((await this.feedService.find({
      channel: channelId,
    }))
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
          await this.feedService.insertOne(toSave);
          
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
      this.feedService.count({
        guild: guildId,
      }),
      this.getFeedLimit(guildId),
    ]);

    return max - currentTotal;
  }

  private async getFeedToSave(
    guildId: string,
    channelId: string,
    url: string,
  ) {
    const feedFetcher = new FeedFetcher();
    const { articleList } = await feedFetcher.fetchFeed(url);
    
    return {
      url,
      title: articleList[0]?.meta?.title as string || 'Untitled',
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
    const supporters = await this.supporterService.findWithGuild(guildId);

    const maxFeedsOfDifferentSupporters = await Promise.all(
      supporters.map(s => {
        if (!s.patron) {
          return s.maxFeeds ?? defaultMaxFeeds;
        }

        return this.patronService.getFeedLimitFromDiscordId(String(s._id));
      }),
    );
    
    return Math.max(...maxFeedsOfDifferentSupporters, defaultMaxFeeds);
  }
}
