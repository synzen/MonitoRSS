import { createTestFeed } from '../../test/data/feeds.test-data';
import { UpdateFeedInputDto } from './dto/UpdateFeedInput.dto';
import { FeedsController } from './feeds.controller';
import { DetailedFeed } from './types/detailed-feed.type';
import { FeedStatus } from './types/FeedStatus.type';

describe('FeedsController', () => {
  const feedsService = {
    updateOne: jest.fn(),
    refresh: jest.fn(),
  };
  const feedFetcherService = {
    fetchFeed: jest.fn(),
  };
  const supportersService = {
    serverCanUseWebhooks: jest.fn(),
  };
  const webhooksService = {
    getWebhook: jest.fn(),
  };
  let controller: FeedsController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new FeedsController(
      feedsService as never,
      feedFetcherService as never,
      supportersService as never,
      webhooksService as never,
    );
  });

  describe('updateFeed', () => {
    const feed: DetailedFeed = {
      ...createTestFeed(),
      refreshRateSeconds: 10,
      status: FeedStatus.OK,
    };

    beforeEach(() => {
      feedsService.updateOne.mockResolvedValue(feed);
    });

    it('calls update with undefined filters if there are no filters', async () => {
      const updateDto: UpdateFeedInputDto = {};

      await controller.updateFeed(feed, updateDto);

      expect(feedsService.updateOne).toHaveBeenCalledWith(
        feed._id,
        expect.objectContaining({
          filters: undefined,
        }),
      );
    });

    it('calls update with the filters array converted to an object', async () => {
      const updateDto: UpdateFeedInputDto = {
        filters: [
          {
            category: 'title',
            value: 'title',
          },
          {
            category: 'title',
            value: 'title2',
          },
          {
            category: 'description',
            value: 'desc',
          },
        ],
      };

      await controller.updateFeed(feed, updateDto);

      expect(feedsService.updateOne).toHaveBeenCalledWith(
        feed._id,
        expect.objectContaining({
          filters: { title: ['title', 'title2'], description: ['desc'] },
        }),
      );
    });
  });
});
