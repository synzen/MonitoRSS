import 'reflect-metadata';
import DiscordUserService from './DiscordUserService';

describe('DiscordUserService', () => {
  let service: DiscordUserService;
  let supporterService = {
    findByDiscordId: jest.fn(),
  };
  let patronService = {
    findByDiscordId: jest.fn(),
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
      patronService.findByDiscordId.mockResolvedValue({} as any);

      const result = await service.isSupporter('test');

      expect(result).toBe(true);
    });
    it('returns false if user is not a supporter or a patron', async () => {
      const result = await service.isSupporter('test');

      expect(result).toBe(false);
    });
  });
});
