import { createTestFeed } from '../../../test/data/feeds.test-data';
import { FeedStatus } from '../types/FeedStatus.type';
import { DetailedFeed } from '../types/detailed-feed.type';
import { GetFeedOutputDto } from './GetFeedOutput.dto';

describe('GetFeedOutputDto', () => {
  describe('fromEntity', () => {
    it('returns the formatted dto object', () => {
      const feed = createTestFeed();
      const feedWithRefreshRate: DetailedFeed = {
        ...feed,
        refreshRateSeconds: 10,
        status: FeedStatus.OK,
        webhook: {
          id: '1234',
        },
      };

      const result = GetFeedOutputDto.fromEntity(feedWithRefreshRate);

      expect(result).toEqual({
        result: {
          id: feed._id.toHexString(),
          channel: feed.channel,
          title: feed.title,
          status: feedWithRefreshRate.status,
          url: feed.url,
          createdAt: feed.addedAt.toISOString(),
          refreshRateSeconds: feedWithRefreshRate.refreshRateSeconds,
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
            id: feedWithRefreshRate.webhook?.id,
          },
        },
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
        description: ['c'],
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
        {
          category: 'description',
          value: 'c',
        },
      ]);
    });
  });
});
