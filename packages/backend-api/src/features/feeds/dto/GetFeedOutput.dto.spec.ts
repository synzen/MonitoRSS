import { createTestFeed } from '../../../test/data/feeds.test-data';
import { FeedStatus } from '../types/FeedStatus.type';
import { DetailedFeed } from '../types/detailed-feed.type';
import { GetFeedOutputDto } from './GetFeedOutput.dto';

const createDetailedFeed = (details?: Partial<DetailedFeed>): DetailedFeed => ({
  ...createTestFeed(),
  refreshRateSeconds: 10,
  status: FeedStatus.OK,
  ...details,
});

describe('GetFeedOutputDto', () => {
  describe('fromEntity', () => {
    it('returns the formatted dto object', () => {
      const feed = createDetailedFeed({
        webhook: {
          id: '1234',
        },
      });

      const result = GetFeedOutputDto.fromEntity(feed);

      expect(result).toEqual({
        result: {
          id: feed._id.toHexString(),
          channel: feed.channel,
          title: feed.title,
          status: feed.status,
          url: feed.url,
          createdAt: feed.addedAt.toISOString(),
          refreshRateSeconds: feed.refreshRateSeconds,
          text: feed.text || '',
          checkDates: feed.checkDates,
          checkTitles: feed.checkTitles,
          directSubscribers: feed.directSubscribers,
          disabled: feed.disabled,
          filters: [],
          formatTables: feed.formatTables,
          imgLinksExistence: feed.imgLinksExistence,
          imgPreviews: feed.imgPreviews,
          ncomparisons: feed.ncomparisons || [],
          pcomparisons: feed.pcomparisons || [],
          splitMessage: false,
          embeds: feed.embeds.map((embed) => ({
            title: embed.title,
            description: embed.description,
            url: embed.url,
            thumbnail: {
              url: embed.thumbnailURL,
            },
            author: {
              iconUrl: embed.authorIconURL,
              name: embed.authorName,
              url: embed.authorURL,
            },
            fields: embed.fields || [],
            color: embed.color,
            footer: {
              text: embed.footerText,
              iconUrl: embed.footerIconURL,
            },
            image: {
              url: embed.imageURL,
            },
            timestamp: embed.timestamp,
          })),
          webhook: {
            id: feed.webhook?.id,
          },
        },
      });
    });

    describe('splitMessage', () => {
      it('sets true correctly', () => {
        const testFeed = createDetailedFeed({
          split: {
            enabled: true,
          },
        });

        const result = GetFeedOutputDto.fromEntity(testFeed);

        expect(result.result.splitMessage).toBe(true);
      });

      it('sets false correctly', () => {
        const testFeed = createDetailedFeed({
          split: {
            enabled: false,
          },
        });

        const result = GetFeedOutputDto.fromEntity(testFeed);

        expect(result.result.splitMessage).toBe(false);
      });

      it('sets false correctly when split is undefined', () => {
        const testFeed = createDetailedFeed({
          split: undefined,
        });

        const result = GetFeedOutputDto.fromEntity(testFeed);

        expect(result.result.splitMessage).toBe(false);
      });
    });

    it('does not add the webhook object if there is no webhook object', () => {
      const feed = createTestFeed({});
      const feedWithRefreshRate: DetailedFeed = {
        ...feed,
        refreshRateSeconds: 10,
        status: FeedStatus.OK,
      };

      delete feedWithRefreshRate.webhook;

      const result = GetFeedOutputDto.fromEntity(feedWithRefreshRate);
      expect(result.result.webhook).toBeUndefined();
    });
    it('does not add the webhook object if there is no webhook id', () => {
      const feed = createTestFeed({});
      const feedWithRefreshRate: DetailedFeed = {
        ...feed,
        refreshRateSeconds: 10,
        status: FeedStatus.OK,
        webhook: {
          id: '',
        },
      };

      const result = GetFeedOutputDto.fromEntity(feedWithRefreshRate);
      expect(result.result.webhook).toBeUndefined();
    });
  });

  describe('getFeedFiltersDto', () => {
    it('returns an empty array if there are no filters', () => {
      const result = GetFeedOutputDto.getFeedFiltersDto();
      expect(result).toEqual([]);
    });

    it('returns all values in their own object', () => {
      const feedFilters = {
        title: ['a', 'b'],
      };

      const result = GetFeedOutputDto.getFeedFiltersDto(feedFilters);

      expect(result).toEqual([
        {
          category: 'title',
          value: 'a',
        },
        {
          category: 'title',
          value: 'b',
        },
      ]);
    });

    it('returns all values sorted by category', () => {
      const feedFilters = {
        title: ['a'],
        description: ['b'],
      };

      const result = GetFeedOutputDto.getFeedFiltersDto(feedFilters);

      expect(result).toEqual([
        {
          category: 'description',
          value: 'b',
        },
        {
          category: 'title',
          value: 'a',
        },
      ]);
    });
  });
});
