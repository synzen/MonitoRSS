/* eslint-disable max-len */
import { PatronStatus } from "./entities/patron.entity";
import { SupporterModel } from "./entities/supporter.entity";
import { SupportersService } from "./supporters.service";
import dayjs from "dayjs";
import { PatronsService } from "./patrons.service";
import { ConfigService } from "@nestjs/config";
import { GuildSubscriptionsService } from "./guild-subscriptions.service";
import { UserFeedLimitOverrideModel } from "./entities/user-feed-limit-overrides.entity";

describe("SupportersService", () => {
  let supportersService: SupportersService;
  const patronsService: PatronsService = {
    isValidPatron: jest.fn(),
    getMaxBenefitsFromPatrons: jest.fn(),
  } as never;
  const supporterModel: SupporterModel = {
    aggregate: jest.fn(),
  } as never;
  const userFeedLimitOverrideModel: UserFeedLimitOverrideModel = {
    findOne: jest.fn(),
    find: jest.fn(),
  } as never;
  const configService: ConfigService = {
    getOrThrow: jest.fn(),
  } as never;
  const guildSubscriptionsService: GuildSubscriptionsService = {
    getAllSubscriptions: jest.fn(),
  } as never;
  const defaultMaxFeeds = 5;
  const defaultMaxUserFeeds = 6;
  const defaultRefreshRateSeconds = 60;

  beforeAll(async () => {
    supportersService = new SupportersService(
      supporterModel,
      userFeedLimitOverrideModel,
      configService,
      patronsService,
      guildSubscriptionsService
    );

    supportersService.defaultMaxFeeds = defaultMaxFeeds;
    supportersService.defaultMaxUserFeeds = defaultMaxUserFeeds;
    supportersService.defaultRefreshRateSeconds = defaultRefreshRateSeconds;
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(guildSubscriptionsService, "getAllSubscriptions")
      .mockResolvedValue([]);
  });

  describe("serverCanUseWebhooks", () => {
    it("returns true correctly", async () => {
      const serverId = "server-id";
      jest.spyOn(supportersService, "getBenefitsOfServers").mockResolvedValue([
        {
          hasSupporter: true,
          serverId,
          maxFeeds: 10,
          webhooks: true,
          refreshRateSeconds: undefined,
        },
      ]);

      const result = await supportersService.serverCanUseWebhooks(serverId);
      expect(result).toBe(true);
    });
    it("returns false if the benefits have webhooks false", async () => {
      const serverId = "server-id";
      jest.spyOn(supportersService, "getBenefitsOfServers").mockResolvedValue([
        {
          hasSupporter: false,
          serverId,
          maxFeeds: 10,
          webhooks: false,
          refreshRateSeconds: undefined,
        },
      ]);

      const result = await supportersService.serverCanUseWebhooks(serverId);
      expect(result).toBe(false);
    });
    it("returns false if the server has no benefits", async () => {
      const serverId = "server-id";
      jest
        .spyOn(supportersService, "getBenefitsOfServers")
        .mockResolvedValue([]);

      const result = await supportersService.serverCanUseWebhooks(serverId);
      expect(result).toBe(false);
    });
  });

  describe("getBenefitsFromSupporter", () => {
    const supporter = {
      maxFeeds: 10,
      maxGuilds: 5,
      lastCharge: new Date(),
      patrons: [],
      customers: [],
    };
    const patronBenefits = {
      maxFeeds: 10,
      maxUserFeeds: 10,
      allowWebhooks: true,
      maxGuilds: 15,
      refreshRateSeconds: 2,
    };

    beforeEach(() => {
      jest
        .spyOn(patronsService, "getMaxBenefitsFromPatrons")
        .mockReturnValue(patronBenefits);
    });

    it("returns the correct benefits if it is not a valid supporter", () => {
      jest.spyOn(supportersService, "isValidSupporter").mockReturnValue(false);

      const result = supportersService.getBenefitsFromSupporter(supporter);

      expect(result).toEqual({
        maxFeeds: defaultMaxFeeds,
        maxUserFeeds: defaultMaxUserFeeds,
        maxUserFeedsComposition: {
          base: defaultMaxUserFeeds,
          legacy: 0,
        },
        maxGuilds: 0,
        isSupporter: false,
        webhooks: false,
        refreshRateSeconds: defaultRefreshRateSeconds,
      });
    });

    describe("if valid supporter", () => {
      it("returns isSupporter true", () => {
        jest.spyOn(supportersService, "isValidSupporter").mockReturnValue(true);

        const result = supportersService.getBenefitsFromSupporter(supporter);

        expect(result.isSupporter).toEqual(true);
      });

      it("returns webhooks true", () => {
        jest.spyOn(supportersService, "isValidSupporter").mockReturnValue(true);

        const result = supportersService.getBenefitsFromSupporter(supporter);

        expect(result.webhooks).toEqual(true);
      });

      describe("maxFeeds", () => {
        it("returns the patron max feeds if patron max feeds is larger", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxFeeds - 5,
          });

          expect(result.maxFeeds).toEqual(patronBenefits.maxFeeds);
        });

        it("returns the patron max user feeds if patron max user feeds is larger", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxUserFeeds - 5,
          });

          expect(result.maxFeeds).toEqual(patronBenefits.maxUserFeeds);
        });

        it("returns the supporter max feeds if supporter max feeds is larger", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
            refreshRateSeconds: 2,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxFeeds + 5,
          });

          expect(result.maxFeeds).toEqual(patronBenefits.maxFeeds + 5);
        });

        it("returns the supporter max user feeds if supporter max user feeds is larger", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
            refreshRateSeconds: 2,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxUserFeeds: patronBenefits.maxUserFeeds + 5,
          });

          expect(result.maxUserFeeds).toEqual(patronBenefits.maxUserFeeds + 5);
        });

        it("returns default max feeds if supporter max feeds does not exist and is larger than patron max feeds", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: defaultMaxFeeds - 10,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
            refreshRateSeconds: 2,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: undefined,
          });

          expect(result.maxFeeds).toEqual(defaultMaxFeeds);
        });

        it("returns default max user feeds if supporter max user feeds does not exist and is larger than patron max user feeds", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: defaultMaxFeeds - 10,
            maxUserFeeds: defaultMaxUserFeeds - defaultMaxUserFeeds - 1,
            allowWebhooks: true,
            maxGuilds: 15,
            refreshRateSeconds: 2,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxUserFeeds: undefined,
          });

          expect(result.maxUserFeeds).toEqual(defaultMaxUserFeeds);
        });
      });

      describe("maxGuilds", () => {
        it("returns the patron max guilds if patron max guilds is larger", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 5,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 10,
            refreshRateSeconds: 2,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: patronBenefits.maxGuilds - 5,
          });

          expect(result.maxGuilds).toEqual(patronBenefits.maxGuilds);
        });

        it("returns the supporter max guilds if supporter max guilds is larger", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
            refreshRateSeconds: 2,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: patronBenefits.maxGuilds + 5,
          });

          expect(result.maxGuilds).toEqual(patronBenefits.maxGuilds + 5);
        });

        it("returns default 1 if supporter max guilds does not exist and 1 is larger than patron max guilds", () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 0,
            refreshRateSeconds: 2,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: undefined,
          });

          expect(result.maxGuilds).toEqual(1);
        });
      });

      describe("refreshRateSeconds", () => {
        it("returns patron refresh rate if supporter comes from patron rate exists", async () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 5,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 10,
            refreshRateSeconds: 1,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = await supportersService.getBenefitsFromSupporter({
            ...supporter,
            patrons: [
              {
                pledge: 500,
                pledgeLifetime: 100,
                status: PatronStatus.ACTIVE,
              },
            ],
          });

          expect(result.refreshRateSeconds).toEqual(
            patronBenefits.refreshRateSeconds
          );
        });

        it("returns default refresh rate if supporter is on slow rate", async () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
            refreshRateSeconds: 8,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = await supportersService.getBenefitsFromSupporter({
            ...supporter,
            patrons: [
              {
                pledge: 500,
                pledgeLifetime: 100,
                status: PatronStatus.ACTIVE,
              },
            ],
            slowRate: true,
          });

          expect(result.refreshRateSeconds).toEqual(defaultRefreshRateSeconds);
        });

        it("returns 120 if supporter does not have patrons and is not slow rate", async () => {
          jest
            .spyOn(supportersService, "isValidSupporter")
            .mockReturnValue(true);
          const patronBenefits = {
            maxFeeds: 10,
            maxUserFeeds: 10,
            allowWebhooks: true,
            maxGuilds: 15,
            refreshRateSeconds: undefined,
          };
          jest
            .spyOn(patronsService, "getMaxBenefitsFromPatrons")
            .mockReturnValue(patronBenefits);

          const result = await supportersService.getBenefitsFromSupporter({
            ...supporter,
            slowRate: false,
            patrons: [],
          });

          expect(result.refreshRateSeconds).toEqual(120);
        });
      });
    });
  });

  describe("isValidSupporter", () => {
    describe("when there are no patrons", () => {
      it("returns true if there is no expiration date", () => {
        const supporter = {
          patrons: [],
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it("returns true if supporter is not expired yet", () => {
        const supporter = {
          patrons: [],
          expireAt: dayjs().add(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });

      it("returns false if supporter is expired", () => {
        const supporter = {
          patrons: [],
          expireAt: dayjs().subtract(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(false);
      });
    });

    describe("when there are patrons", () => {
      it("returns true if some patron is a valid patron", () => {
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
          .spyOn(patronsService, "isValidPatron")
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(true);
      });
      it("returns false if all patrons are invalid", () => {
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

        jest.spyOn(patronsService, "isValidPatron").mockReturnValue(false);

        const result = supportersService.isValidSupporter(supporter);

        expect(result).toBe(false);
      });
    });
  });
});
