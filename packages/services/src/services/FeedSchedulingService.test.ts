import 'reflect-metadata';
import FeedSchedulingService from './FeedSchedulingService';

describe('FeedSchedulingService', () => {
  let service: FeedSchedulingService;
  const scheduleService = {
    findAll: jest.fn(),
  };
  const subscriptionService = {
    getSubscriptionOfGuild: jest.fn(),
  };
  const supporterService = {
    findWithGuild: jest.fn(),
  };
  const patronService = {
    findByDiscordId: jest.fn(),
  };
  const failRecordService = {
    getFailedStatuses: jest.fn(),
  };
  let config: {
    vipEnabled: boolean,
    vipRefreshRateMinutes: number,
    defaultRefreshRateMinutes: number,
  };


  beforeEach(() => {
    config = {
      vipEnabled: true,
      vipRefreshRateMinutes: 2,
      defaultRefreshRateMinutes: 10,
    };
    jest.resetAllMocks();
    service = new FeedSchedulingService(
      scheduleService as any,
      subscriptionService as any,
      supporterService as any,
      patronService as any,
      failRecordService as any,
      config as any,
    );
    scheduleService.findAll.mockResolvedValue([]);
    subscriptionService.getSubscriptionOfGuild.mockResolvedValue(null);
    supporterService.findWithGuild.mockResolvedValue([]);
    // Simulate all feeds are not failed
    failRecordService.getFailedStatuses.mockResolvedValue(new Array(100).fill(false));
  });
  describe('determineSchedules', () => {
    describe('when a feed url has failed', () => {
      it('returns null', async () => {
        const feed = {
          id: 'id',
          url: 'url',
          guildId: 'guildId',
        };
        failRecordService.getFailedStatuses.mockResolvedValue([true]);
        const result = await service.determineSchedules([feed]);
        expect(result).toEqual([null]);
      });
    });
    describe('when a feed is not a vip', () => {
      it('returns the correct schedule based on feed url keywords', async () => {
        const mockSchedules = [{
          name: 'google',
          refreshRateMinutes: 19,
          keywords: ['google'],
          feeds: [],
        }, {
          name: 'reddit',
          refreshRateMinutes: 20,
          keywords: ['reddit'],
          feeds: [],
        }];
        const feed = {
          url: 'https://reddit.com',
          id: 'feed-id',
          guildId: 'guild-id',
        };
        scheduleService.findAll.mockResolvedValue(mockSchedules);
        const schedules = await service.determineSchedules([feed]);
        expect(schedules).toEqual([{
          name: mockSchedules[1].name,
          refreshRateMinutes: mockSchedules[1].refreshRateMinutes,
        }]);
      });
      it('returns the correct schedule based on feed ids', async () => {
        const mockSchedules = [{
          name: 'google',
          refreshRateMinutes: 19,
          feeds: ['feed-id-1'],
          keywords: [],
        }, {
          name: 'reddit',
          refreshRateMinutes: 20,
          feeds: ['feed-id-2'],
          keywords: [],
        }];
        const feed = {
          url: 'https://yahoo.com',
          id: 'feed-id-1',
          guildId: 'guild-id',
        };
        scheduleService.findAll.mockResolvedValue(mockSchedules);
        const schedules = await service.determineSchedules([feed]);
        expect(schedules).toEqual([{
          name: mockSchedules[0].name,
          refreshRateMinutes: mockSchedules[0].refreshRateMinutes,
        }]);
      });
    });
    describe('when a feed has a subscripton attached', () => {
      it('returns the vip schedule for a feed if it applies', async () => {
        const feed = {
          id: 'feed-id',
          url: 'https://rssfeed.com',
          guildId: 'guild-id',
        };
        const subscription = {
          refresh_rate: 10,
          ignore_refresh_rate_benefit: false,
          guild_id: 'guild-id',
          extra_feeds: 10,
          expire_at: new Date().toISOString(),
        };
        subscriptionService.getSubscriptionOfGuild.mockResolvedValueOnce(subscription);
        const results = await service.determineSchedules([feed]);
        expect(results).toEqual([{
          name: 'vip',
          refreshRateMinutes: config.vipRefreshRateMinutes,
        }]);
      });
      it('does not return vip schedule if ignore refresh rate benefit is true', async () => {
        const feed = {
          id: 'feed-id',
          url: 'https://rssfeed.com',
          guildId: 'guild-id',
        };
        const subscription = {
          refresh_rate: 10,
          ignore_refresh_rate_benefit: true,
          guild_id: 'guild-id',
          extra_feeds: 10,
          expire_at: new Date().toISOString(),
        };
        subscriptionService.getSubscriptionOfGuild.mockResolvedValueOnce(subscription);
        const results = await service.determineSchedules([feed]);
        expect(results).toEqual(expect.not.arrayContaining([expect.objectContaining({
          name: 'vip',
        })]));
      });
      it(
        'it does not return vip if subscription refresh rate is higher than vip refresh rate'
        , async () => {
          const feed = {
            id: 'feed-id',
            url: 'https://rssfeed.com',
            guildId: 'guild-id',
          };
          const subscription = {
            refresh_rate: config.vipRefreshRateMinutes * 60 + 10,
            ignore_refresh_rate_benefit: false,
            guild_id: 'guild-id',
            extra_feeds: 10,
            expire_at: new Date().toISOString(),
          };
          subscriptionService.getSubscriptionOfGuild.mockResolvedValueOnce(subscription);
          const results = await service.determineSchedules([feed]);
          expect(results).toEqual(expect.not.arrayContaining([expect.objectContaining({
            name: 'vip',
          })]));
        });
      describe('when a feed has a supporter attached', () => {
        describe('when there are no patron supporters', () => {
          it('returns vip when valid supporters are found', async () => {
            const feed = {
              id: 'feed-id',
              url: 'https://rssfeed.com',
              guildId: 'guild-id',
            };
            supporterService.findWithGuild.mockResolvedValueOnce([{
              id: 'supporter-id',
              discord_id: 'discord-id',
              expire_at: new Date().toISOString(),
            }]);
            const results = await service.determineSchedules([feed]);
            expect(results).toEqual([{
              name: 'vip',
              refreshRateMinutes: config.vipRefreshRateMinutes,
            }]);
          });
          it('does not return vip when no valid supporters are found', async () => {
            const feed = {
              id: 'feed-id',
              url: 'https://rssfeed.com',
              guildId: 'guild-id',
            };
            supporterService.findWithGuild.mockResolvedValueOnce([]);
            const results = await service.determineSchedules([feed]);
            expect(results).toEqual(expect.not.arrayContaining([expect.objectContaining({
              name: 'vip',
            })]));
          });
        });
        describe('when there are patron supporters', () => {
          it(
            'returns vip when there is at least one supporter that is a valid patron'
            , async () => {
              const feed = {
                id: 'feed-id',
                url: 'https://rssfeed.com',
                guildId: 'guild-id',
              };
              supporterService.findWithGuild.mockResolvedValueOnce([{
                id: 'supporter-id',
                discord_id: 'discord-id',
                expire_at: new Date().toISOString(),
              }]);
              patronService.findByDiscordId.mockResolvedValueOnce({
                id: 'patron-id',
                expire_at: new Date().toISOString(),
              });
              const results = await service.determineSchedules([feed]);
              expect(results).toEqual([{
                name: 'vip',
                refreshRateMinutes: config.vipRefreshRateMinutes,
              }]);
            });
          it('does not return vip when there are no valid patrons for any supporter', async () => {
            const feed = {
              id: 'feed-id',
              url: 'https://rssfeed.com',
              guildId: 'guild-id',
            };
            supporterService.findWithGuild.mockResolvedValueOnce([{
              _id: 'supporter-id',
              discord_id: 'discord-id',
              expire_at: new Date().toISOString(),
              patron: true,
            }]);
            patronService.findByDiscordId.mockResolvedValue(null);
            const results = await service.determineSchedules([feed]);
            expect(results).toEqual(expect.not.arrayContaining([expect.objectContaining({
              name: 'vip',
            })]));
          });
        });
      });
    });
  });
});
