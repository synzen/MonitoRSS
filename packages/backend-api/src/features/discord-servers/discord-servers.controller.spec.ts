import { createTestFeed } from '../../test/data/feeds.test-data';
import { FeedStatus } from '../feeds/types/FeedStatus.type';
import { DiscordServersController } from './discord-servers.controller';
import { DiscordServersService } from './discord-servers.service';
import { DetailedFeed } from './types/DetailedFeed.type';

describe('DiscordServersController', () => {
  let controller: DiscordServersController;
  let discordServersService: DiscordServersService;

  beforeEach(() => {
    discordServersService = {
      getServerFeeds: jest.fn(),
      countServerFeeds: jest.fn(),
    } as never;

    controller = new DiscordServersController(discordServersService);
  });

  describe('getServerFeeds', () => {
    it('returns the response correctly formatted', async () => {
      const mockFeeds: DetailedFeed[] = [
        {
          ...createTestFeed(),
          status: FeedStatus.OK,
        },
        {
          ...createTestFeed(),
          status: FeedStatus.FAILED,
        },
      ];

      jest
        .spyOn(discordServersService, 'getServerFeeds')
        .mockResolvedValue(mockFeeds);

      jest
        .spyOn(discordServersService, 'countServerFeeds')
        .mockResolvedValue(mockFeeds.length);

      const response = await controller.getServerFeeds('server-1', {
        limit: 1,
        offset: 0,
      });

      expect(response).toEqual({
        results: mockFeeds.map((feed) => ({
          id: feed._id.toHexString(),
          channel: feed.channel,
          createdAt: feed.addedAt?.toISOString(),
          status: feed.status,
          title: feed.title,
          url: feed.url,
        })),
        total: mockFeeds.length,
      });
    });
  });
});
