import { NotFoundException } from '@nestjs/common';
import { UserManagesFeedServerGuard } from './UserManagesFeedServer.guard';
import { FeedsService } from '../feeds.service';
import { DiscordAuthService } from '../../discord-auth/discord-auth.service';
import { FastifyRequest } from 'fastify';

describe('UserManagesFeedServerGuard', () => {
  let guard: UserManagesFeedServerGuard;
  let discordAuthService: DiscordAuthService;
  let feedsService: FeedsService;
  const feedId = 'feed-id';
  const request = {
    params: {
      feedId,
    },
  } as unknown as FastifyRequest;

  beforeEach(() => {
    discordAuthService = {} as never;

    feedsService = {
      getFeed: jest.fn(),
    } as never;

    jest.spyOn(feedsService, 'getFeed').mockResolvedValue({
      id: 'feed-id',
      guild: '123',
    } as never);

    guard = new UserManagesFeedServerGuard(feedsService, discordAuthService);
  });

  describe('getServerId', () => {
    it('throws not found exception if feed is not found', async () => {
      jest.spyOn(feedsService, 'getFeed').mockResolvedValue(null);

      await expect(guard.getServerId(request)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if feed id is missing from request params', async () => {
      await expect(
        guard.getServerId({ params: {} } as never),
      ).rejects.toThrow();
    });

    it('returns the feed guild', async () => {
      const guild = 'abc';
      jest.spyOn(feedsService, 'getFeed').mockResolvedValue({
        guild,
      } as never);

      await expect(guard.getServerId(request)).resolves.toEqual(guild);
    });
  });
});
