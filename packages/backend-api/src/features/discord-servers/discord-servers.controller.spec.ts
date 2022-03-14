import { createTestFeed } from '../../test/data/feeds.test-data';
import { Feed } from '../feeds/entities/Feed.entity';
import { FeedStatus } from '../feeds/types/FeedStatus.type';
import { DiscordServersController } from './discord-servers.controller';
import { DiscordServersService } from './discord-servers.service';

describe('DiscordServersController', () => {
  let controller: DiscordServersController;
  let discordServersService: DiscordServersService;

  beforeEach(() => {
    discordServersService = {
      getServer: jest.fn(),
      getServerFeeds: jest.fn(),
      countServerFeeds: jest.fn(),
    } as never;

    controller = new DiscordServersController(discordServersService);
  });

  describe('getServerStatus', () => {
    it('should return the server status if server exists', async () => {
      jest
        .spyOn(discordServersService, 'getServer')
        .mockResolvedValue({} as never);
      const serverId = 'serverId';

      const result = await controller.getServerStatus(serverId);

      expect(result).toEqual({
        result: {
          authorized: true,
        },
      });
    });

    it('should return the server status if server does not exist', async () => {
      jest.spyOn(discordServersService, 'getServer').mockResolvedValue(null);
      const serverId = 'serverId';

      const result = await controller.getServerStatus(serverId);

      expect(result).toEqual({
        result: {
          authorized: false,
        },
      });
    });
  });

  describe('getServerFeeds', () => {
    it('returns the response correctly formatted', async () => {
      const mockFeeds: (Feed & { status: FeedStatus })[] = [
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
