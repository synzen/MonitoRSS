/* eslint-disable max-len */
import { PatronStatus } from './entities/patron.entity';
import { SupporterModel } from './entities/supporter.entity';
import { SupportersService } from './supporters.service';
import dayjs from 'dayjs';
import { PatronsService } from './patrons.service';
import { ConfigService } from '@nestjs/config';

describe('SupportersService', () => {
  let supportersService: SupportersService;
  const patronsService: PatronsService = {
    isValidPatron: jest.fn(),
    getMaxBenefitsFromPatrons: jest.fn(),
  } as never;
  const supporterModel: SupporterModel = {
    aggregate: jest.fn(),
  } as never;
  const configService: ConfigService = {
    get: jest.fn(),
  } as never;
  const defaultMaxFeeds = 5;

  beforeAll(async () => {
    supportersService = new SupportersService(
      supporterModel,
      configService,
      patronsService,
    );

    supportersService.defaultMaxFeeds = defaultMaxFeeds;
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'defaultMaxFeeds') {
        return defaultMaxFeeds;
      }
    });
  });

  describe('serverCanUseWebhooks', () => {
    it('returns true correctly', async () => {
      const serverId = 'server-id';
      jest.spyOn(supportersService, 'getBenefitsOfServers').mockResolvedValue([
        {
          hasSupporter: true,
          serverId,
          maxFeeds: 10,
          webhooks: true,
        },
      ]);

      const result = await supportersService.serverCanUseWebhooks(serverId);
      expect(result).toBe(true);
    });
    it('returns false if the benefits have webhooks false', async () => {
      const serverId = 'server-id';
      jest.spyOn(supportersService, 'getBenefitsOfServers').mockResolvedValue([
        {
          hasSupporter: false,
          serverId,
          maxFeeds: 10,
          webhooks: false,
        },
      ]);

      const result = await supportersService.serverCanUseWebhooks(serverId);
      expect(result).toBe(false);
    });
    it('returns false if the server has no benefits', async () => {
      const serverId = 'server-id';
      jest
        .spyOn(supportersService, 'getBenefitsOfServers')
        .mockResolvedValue([]);

      const result = await supportersService.serverCanUseWebhooks(serverId);
      expect(result).toBe(false);
    });
  });

  describe('getBenefitsFromSupporter', () => {
    const supporter = {
      maxFeeds: 10,
      maxGuilds: 5,
      lastCharge: new Date(),
      patrons: [],
    };
    const patronBenefits = {
      maxFeeds: 10,
      allowWebhooks: true,
      maxGuilds: 15,
    };

    beforeEach(() => {
      jest
        .spyOn(patronsService, 'getMaxBenefitsFromPatrons')
        .mockReturnValue(patronBenefits);
    });

    it('returns the correct benefits if it is not a valid supporter', () => {
      jest.spyOn(supportersService, 'isValidSupporter').mockReturnValue(false);

      const result = supportersService.getBenefitsFromSupporter(supporter);

      expect(result).toEqual({
        maxFeeds: defaultMaxFeeds,
        maxGuilds: 0,
        isSupporter: false,
        webhooks: false,
      });
    });

    describe('if valid supporter', () => {
      it('returns isSupporter true', () => {
        jest.spyOn(supportersService, 'isValidSupporter').mockReturnValue(true);

        const result = supportersService.getBenefitsFromSupporter(supporter);

        expect(result.isSupporter).toEqual(true);
      });

      it('returns webhooks true', () => {
        jest.spyOn(supportersService, 'isValidSupporter').mockReturnValue(true);

        const result = supportersService.getBenefitsFromSupporter(supporter);

        expect(result.webhooks).toEqual(true);
      });

      describe('maxFeeds', () => {
        it('returns the patron max feeds if patron max feeds is larger', () => {
          jest
            .spyOn(supportersService, 'isValidSupporter')
            .mockReturnValue(true);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxFeeds - 5,
          });

          expect(result.maxFeeds).toEqual(patronBenefits.maxFeeds);
        });

        it('returns the supporter max feeds if supporter max feeds is larger', () => {
          jest
            .spyOn(supportersService, 'isValidSupporter')
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
          };
          jest
            .spyOn(patronsService, 'getMaxBenefitsFromPatrons')
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxFeeds + 5,
          });

          expect(result.maxFeeds).toEqual(patronBenefits.maxFeeds + 5);
        });

        it('returns default max feeds if supporter max feeds does not exist and is larger than patron max feeds', () => {
          jest
            .spyOn(supportersService, 'isValidSupporter')
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: defaultMaxFeeds - 10,
            allowWebhooks: true,
            maxGuilds: 15,
          };
          jest
            .spyOn(patronsService, 'getMaxBenefitsFromPatrons')
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: undefined,
          });

          expect(result.maxFeeds).toEqual(defaultMaxFeeds);
        });
      });

      describe('maxGuilds', () => {
        it('returns the patron max guilds if patron max guilds is larger', () => {
          jest
            .spyOn(supportersService, 'isValidSupporter')
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 5,
            allowWebhooks: true,
            maxGuilds: 10,
          };
          jest
            .spyOn(patronsService, 'getMaxBenefitsFromPatrons')
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: patronBenefits.maxGuilds - 5,
          });

          expect(result.maxGuilds).toEqual(patronBenefits.maxGuilds);
        });

        it('returns the supporter max guilds if supporter max guilds is larger', () => {
          jest
            .spyOn(supportersService, 'isValidSupporter')
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
          };
          jest
            .spyOn(patronsService, 'getMaxBenefitsFromPatrons')
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: patronBenefits.maxGuilds + 5,
          });

          expect(result.maxGuilds).toEqual(patronBenefits.maxGuilds + 5);
        });

        it('returns default 1 if supporter max guilds does not exist and 1 is larger than patron max guilds', () => {
          jest
            .spyOn(supportersService, 'isValidSupporter')
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 0,
          };
          jest
            .spyOn(patronsService, 'getMaxBenefitsFromPatrons')
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: undefined,
          });

          expect(result.maxGuilds).toEqual(1);
        });
      });
    });
  });

  describe('isValidSupporter', () => {
    describe('when there are no patrons', () => {
      it('returns true if there is no expiration date', () => {
        const supporter = {
          patrons: [],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it('returns true if supporter is not expired yet', () => {
        const supporter = {
          patrons: [],
          expireAt: dayjs().add(1, 'month').toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it('returns false if supporter is expired', () => {
        const supporter = {
          patrons: [],
          expireAt: dayjs().subtract(1, 'month').toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(false);
      });
    });

    describe('when there are patrons', () => {
      it('returns true if some patron is a valid patron', () => {
        const supporter = {
          patrons: [
            {
              status: PatronStatus.ACTIVE,
              pledge: 1,
            },
            {
              status: PatronStatus.FORMER,
              pledge: 0,
            },
          ],
        };

        jest
          .spyOn(patronsService, 'isValidPatron')
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });
      it('returns false if all patrons are invalid', () => {
        const supporter = {
          patrons: [
            {
              status: PatronStatus.ACTIVE,
              pledge: 1,
            },
            {
              status: PatronStatus.FORMER,
              pledge: 0,
            },
          ],
        };

        jest.spyOn(patronsService, 'isValidPatron').mockReturnValue(false);

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(false);
      });
    });
  });
});
