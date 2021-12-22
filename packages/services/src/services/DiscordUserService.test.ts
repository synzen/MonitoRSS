import 'reflect-metadata';
import DiscordUserService from './DiscordUserService';

describe('DiscordUserService', () => {
  let service: DiscordUserService;
  let supporterService = {
    findByDiscordId: jest.fn(),
  };
  let patronService = {
    findByDiscordId: jest.fn(),
    getGuildLimitFromDiscordId: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new DiscordUserService(supporterService as any, patronService as any);
  });

  describe('isSupporter', () => {
    it('returns true if the user is a supporter', async () => {
      supporterService.findByDiscordId.mockResolvedValue({} as any);

      const result = await service.isSupporter('test');

      expect(result).toBe(true);
    });
    it('returns true if the user is a active patron', async () => {
      supporterService.findByDiscordId.mockResolvedValue({
        patron: true,
      } as any);
      patronService.findByDiscordId.mockResolvedValue({} as any);

      const result = await service.isSupporter('test');

      expect(result).toBe(true);
    });
    it('returns false if user is not a supporter or a patron', async () => {
      const result = await service.isSupporter('test');

      expect(result).toBe(false);
    });
    it('returns false if the supporter is a patron but there is no valid patron', async () => {
      supporterService.findByDiscordId.mockResolvedValue({
        patron: true,
      });

      const result = await service.isSupporter('test');

      expect(result).toBe(false);
    });
  });
  describe('getSupporterGuilds', () => {
    it('returns the guilds that the user has backed', async () => {
      supporterService.findByDiscordId.mockResolvedValue({ guilds: ['test'] } as any);

      const result = await service.getSupporterGuilds('test');

      expect(result).toEqual(['test']);
    });

    it('returns an empty array if the user has no backed guilds', async () => {
      supporterService.findByDiscordId.mockResolvedValue({} as any);

      const result = await service.getSupporterGuilds('test');

      expect(result).toEqual([]);
    });
  });

  describe('getMaxSupporterGuildCount', () => {
    describe('when supporter is not found', () => {
      it('returns 1', async () => {
        supporterService.findByDiscordId.mockResolvedValue(null);

        const result = await service.getMaxSupporterGuildCount('test');

        expect(result).toEqual(1);
      });
    });
    describe('when supporter is found', () => {
      describe('when supporter is a patron', () => {
        it('returns the max guilds from patron service', async () => {
          supporterService.findByDiscordId.mockResolvedValue({
            patron: true,
          } as any);
          patronService.getGuildLimitFromDiscordId.mockResolvedValue(2);

          const result = await service.getMaxSupporterGuildCount('test');

          expect(result).toEqual(2);
        });
      });
      describe('when supporter is not a patron', () => {
        it('returns 1', async () => {
          supporterService.findByDiscordId.mockResolvedValue({
            patron: false,
          } as any);

          const result = await service.getMaxSupporterGuildCount('test');

          expect(result).toEqual(1);
        });
      });
    });
  });
});
