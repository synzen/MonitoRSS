import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
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
import {
  DiscordServerProfile,
  DiscordServerProfileFeature,
  DiscordServerProfileModel,
} from './entities/discord-server-profile.entity';
import { DiscordGuildChannel } from '../../common';
import { FeedFeature } from '../feeds/entities/feed.entity';
import { FeedSubscriberFeature } from '../feeds/entities/feed-subscriber.entity';
import { FeedFilteredFormatFeature } from '../feeds/entities/feed-filtered-format.entity';

const configValues: Record<string, unknown> = {
  defaultDateFormat: 'YYYY-MM-DD',
  defaultTimezone: 'UTC',
  defaultDateLanguage: 'en',
};

describe('DiscordServersService', () => {
  let service: DiscordServersService;
  let profileModel: DiscordServerProfileModel;
  const configService: ConfigService = {
    get: jest.fn(),
  } as never;
  const discordApiService = {
    executeBotRequest: jest.fn(),
  };
  const feedsService = {
    getServerFeeds: jest.fn(),
    countServerFeeds: jest.fn(),
  };

  beforeAll(async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      return configValues[key];
    });
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [DiscordServersService, DiscordAPIService],
      imports: [
        FeedsModule,
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([
          DiscordServerProfileFeature,
          FeedFeature,
          FeedSubscriberFeature,
          FeedFilteredFormatFeature,
        ]),
      ],
    });

    uncompiledModule
      .overrideProvider(DiscordAPIService)
      .useValue(discordApiService)
      .overrideProvider(FeedsService)
      .useValue(feedsService)
      .overrideProvider(ConfigService)
      .useValue(configService);

    const { module } = await init();

    service = module.get<DiscordServersService>(DiscordServersService);
    profileModel = module.get<DiscordServerProfileModel>(
      getModelToken(DiscordServerProfile.name),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await profileModel.deleteMany();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBackup', () => {
    const guildId = 'mock-guild-id';
    const mockProfile = {
      id: guildId,
      data: 'foo',
    };
    const mockFeeds = [
      {
        _id: '1',
      },
      {
        _id: '2',
      },
    ];
    const mockFilteredFormats = [
      {
        _id: 'filtered-format-id',
      },
    ];
    const mockSubscribers = [
      {
        _id: 'subscriber-id',
      },
    ];
    let feedModelFind: jest.SpyInstance;
    let filteredFormatModelFind: jest.SpyInstance;
    let subscriberModelFind: jest.SpyInstance;

    beforeEach(() => {
      jest
        .spyOn(service, 'getServerProfile')
        .mockResolvedValue(mockProfile as never);
      feedModelFind = jest.spyOn(service['feedModel'], 'find').mockReturnValue({
        lean: async () => [
          {
            _id: '1',
          },
          {
            _id: '2',
          },
        ],
      } as never);

      subscriberModelFind = jest
        .spyOn(service['feedSubscriberModel'], 'find')
        .mockReturnValue({
          lean: async () => [
            {
              _id: 'subscriber-id',
            },
          ],
        } as never);

      filteredFormatModelFind = jest
        .spyOn(service['feedFilteredFormatModel'], 'find')
        .mockReturnValue({
          lean: async () => [
            {
              _id: 'filtered-format-id',
            },
          ],
        } as never);
    });

    it('calls the correct queries', async () => {
      const guildId = 'mock-guild-id';

      await service.createBackup(guildId);

      expect(feedModelFind).toHaveBeenCalledWith({
        guild: guildId,
      });

      expect(filteredFormatModelFind).toHaveBeenCalledWith({
        feed: {
          $in: ['1', '2'],
        },
      });
      expect(subscriberModelFind).toHaveBeenCalledWith({
        feed: {
          $in: ['1', '2'],
        },
      });
    });

    it('returns the correct data', () => {
      const guildId = 'mock-guild-id';

      const result = service.createBackup(guildId);

      expect(result).resolves.toEqual({
        backupVersion: '1',
        profile: {
          ...mockProfile,
          _id: guildId,
        },
        feeds: mockFeeds,
        filteredFormats: mockFilteredFormats,
        subscribers: mockSubscribers,
      });
    });
  });

  describe('getServerProfile', () => {
    const serverId = 'server-id';

    it('returns the profile if it exists', async () => {
      const created = await profileModel.create({
        _id: serverId,
        dateFormat: 'date-format',
        dateLanguage: 'date-language',
        timezone: 'timezone',
      });
      const profile = await service.getServerProfile(serverId);

      expect(profile).toEqual({
        dateFormat: created.dateFormat,
        timezone: created.timezone,
        dateLanguage: created.dateLanguage,
      });
    });

    it('returns defaults if no profile is found', async () => {
      const profile = await service.getServerProfile(serverId);

      expect(profile).toEqual({
        dateFormat: configValues.defaultDateFormat,
        timezone: configValues.defaultTimezone,
        dateLanguage: configValues.defaultDateLanguage,
      });
    });

    it('returns defaults if only some fields are not found', async () => {
      const profile = await profileModel.create({
        _id: serverId,
        dateFormat: 'date-format',
        dateLanguage: 'date-language',
      });
      const returned = await service.getServerProfile(serverId);

      expect(returned).toEqual({
        dateFormat: profile.dateFormat,
        timezone: configValues.defaultTimezone,
        dateLanguage: profile.dateLanguage,
      });
    });
  });

  describe('updateServerProfile', () => {
    it.each(['dateFormat', 'timezone', 'dateLanguage'])(
      'updates %s',
      async (field) => {
        const serverId = 'server-id';
        const profile = await profileModel.create({
          _id: serverId,
          dateFormat: 'date-format',
          dateLanguage: 'date-language',
          timezone: 'timezone',
        });
        const newValue = 'new-value';
        const updated = await service.updateServerProfile(serverId, {
          [field]: newValue,
        });

        expect(updated).toEqual({
          dateFormat: profile.dateFormat,
          timezone: profile.timezone,
          dateLanguage: profile.dateLanguage,
          [field]: newValue,
        });
      },
    );

    it('updates all the fields', async () => {
      const serverId = 'server-id';
      await profileModel.create({
        _id: serverId,
        dateFormat: 'date-format',
        dateLanguage: 'date-language',
        timezone: 'timezone',
      });
      const updated = await service.updateServerProfile(serverId, {
        dateFormat: 'new-date-format',
        timezone: 'new-timezone',
        dateLanguage: 'new-date-language',
      });

      expect(updated).toEqual({
        dateFormat: 'new-date-format',
        timezone: 'new-timezone',
        dateLanguage: 'new-date-language',
      });
    });

    it('upserts the fields if necessary', async () => {
      const serverId = 'server-id';
      const updated = await service.updateServerProfile(serverId, {
        dateFormat: 'new-date-format',
        timezone: 'new-timezone',
        dateLanguage: 'new-date-language',
      });

      expect(updated).toEqual({
        dateFormat: 'new-date-format',
        timezone: 'new-timezone',
        dateLanguage: 'new-date-language',
      });
    });
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

  describe('getChannelsOfServer', () => {
    it('returns the channels from Discord', async () => {
      const serverId = 'server-id';
      const mockChannels: DiscordGuildChannel[] = [
        {
          id: 'channel-1',
          guild_id: serverId,
          permission_overwrites: [],
          name: 'channel-1',
        },
        {
          id: 'id-2',
          name: 'channel-2',
          guild_id: serverId,
          permission_overwrites: [],
        },
      ];
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockResolvedValue(mockChannels);

      const channels = await service.getChannelsOfServer(serverId);

      expect(channels).toEqual(mockChannels);
    });
  });

  describe('getRolesOfServer', () => {
    it('returns the roles from Discord', async () => {
      const serverId = 'server-id';
      const mockRoles = [
        {
          id: 'id-1',
          name: 'role-1',
        },
        {
          id: 'id-2',
          name: 'role-2',
        },
      ];
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockResolvedValue(mockRoles);

      const roles = await service.getRolesOfServer(serverId);

      expect(roles).toEqual(mockRoles);
    });
  });
});
