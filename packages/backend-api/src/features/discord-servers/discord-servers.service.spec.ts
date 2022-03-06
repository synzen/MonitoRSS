import { HttpStatus } from '@nestjs/common';
import { DiscordAPIError } from '../../common/errors/DiscordAPIError';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../../utils/integration-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import { FeedsModule } from '../feeds/feeds.module';
import { FeedsService } from '../feeds/feeds.service';
import { DiscordServersService } from './discord-servers.service';

describe('DiscordServersService', () => {
  let service: DiscordServersService;
  const discordApiService = {
    executeBotRequest: jest.fn(),
  };
  const feedsService = {
    getServerFeeds: jest.fn(),
    countServerFeeds: jest.fn(),
  };

  beforeAll(async () => {
    jest.resetAllMocks();
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [DiscordServersService, DiscordAPIService],
      imports: [FeedsModule, MongooseTestModule.forRoot()],
    });

    uncompiledModule
      .overrideProvider(DiscordAPIService)
      .useValue(discordApiService)
      .overrideProvider(FeedsService)
      .useValue(feedsService);

    const { module } = await init();

    service = module.get<DiscordServersService>(DiscordServersService);
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getServerFeeds', () => {
    it('calls the feeds service correctly', async () => {
      const serverId = 'server-id';
      const options = {
        limit: 10,
        offset: 20,
      };
      await service.getServerFeeds(serverId, options);

      expect(feedsService.getServerFeeds).toHaveBeenCalledWith(
        serverId,
        options,
      );
    });
  });

  describe('countServerFeeds', () => {
    it('calls the feeds service correctly', async () => {
      const serverId = 'server-id';
      await service.countServerFeeds(serverId);

      expect(feedsService.countServerFeeds).toHaveBeenCalledWith(serverId, {
        search: undefined,
      });
    });

    it('calls the feed service with search correctly', async () => {
      const serverId = 'server-id';
      const options = {
        search: 'search',
      };
      await service.countServerFeeds(serverId, options);

      expect(feedsService.countServerFeeds).toHaveBeenCalledWith(serverId, {
        search: options.search,
      });
    });
  });

  describe('getServer', () => {
    it('returns the guild', async () => {
      const mockGuild = {
        id: 'server-1',
      };
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockResolvedValue(mockGuild);

      const guild = await service.getServer(mockGuild.id);

      expect(guild).toEqual(mockGuild);
    });

    it('returns null if the bot was forbidden', async () => {
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockRejectedValue(
          new DiscordAPIError('Forbidden', HttpStatus.FORBIDDEN),
        );

      const guild = await service.getServer('server-1');

      expect(guild).toBeNull();
    });
    it('returns null if 404 is returned', async () => {
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockRejectedValue(
          new DiscordAPIError('Not Found', HttpStatus.NOT_FOUND),
        );

      const guild = await service.getServer('server-1');

      expect(guild).toBeNull();
    });

    it('throws for an unhandled error', async () => {
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockRejectedValue(new Error('Unhandled error'));

      await expect(service.getServer('server-1')).rejects.toThrow();
    });
  });
});
