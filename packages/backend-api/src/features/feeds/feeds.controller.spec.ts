import { createTestFeed } from '../../test/data/feeds.test-data';
import { UpdateFeedInputDto } from './dto/update-feed-input.dto';
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

    describe('channelId', () => {
      it('should update the feed with the channelId', async () => {
        const input: UpdateFeedInputDto = {
          channelId: '123',
        };

        await controller.updateFeed(feed, input);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            channelId: input.channelId,
          }),
        );
      });
    });

    describe('title', () => {
      it('calls update with the title', async () => {
        const title = 'new-title';
        await controller.updateFeed(feed, {
          title,
        });

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            title,
          }),
        );
      });
    });

    describe('ncomparisons', () => {
      it('calls update with the ncomparisons', async () => {
        const ncomparisons = ['title'];
        await controller.updateFeed(feed, {
          ncomparisons,
        });

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            ncomparisons,
          }),
        );
      });
    });

    describe('pcomparisons', () => {
      it('calls update with the pcomparisons', async () => {
        const pcomparisons = ['title'];
        await controller.updateFeed(feed, {
          pcomparisons,
        });

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            pcomparisons,
          }),
        );
      });
    });

    describe('filters', () => {
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

      it('does not include duplicates', async () => {
        const updateDto: UpdateFeedInputDto = {
          filters: [
            {
              category: 'title',
              value: 'title',
            },
            {
              category: 'title',
              value: 'title',
            },
            {
              category: 'title',
              value: 'newtitle',
            },
          ],
        };

        await controller.updateFeed(feed, updateDto);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            filters: { title: ['title', 'newtitle'] },
          }),
        );
      });

      it('trims the values', async () => {
        const updateDto: UpdateFeedInputDto = {
          filters: [
            {
              category: 'title',
              value: 'title                          ',
            },
          ],
        };

        await controller.updateFeed(feed, updateDto);

        expect(feedsService.updateOne).toHaveBeenCalledWith(
          feed._id,
          expect.objectContaining({
            filters: { title: ['title'] },
          }),
        );
      });
    });
  });
});
