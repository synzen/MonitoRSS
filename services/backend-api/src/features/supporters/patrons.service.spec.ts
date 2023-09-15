import { PatronStatus } from "./entities/patron.entity";
import { PatronsService } from "./patrons.service";
import dayjs from "dayjs";

describe("PatronsService", () => {
  let patronsService: PatronsService;
  const defaultMaxFeeds = 5;
  const defaultMaxUserFeeds = 10;
  const configsService = {
    getOrThrow: jest.fn(),
  };

  beforeEach(async () => {
    patronsService = new PatronsService(configsService as never);
    patronsService.defaultMaxFeeds = defaultMaxFeeds;
    patronsService.defaultMaxUserFeeds = defaultMaxUserFeeds;
  });

  describe("getMaxBenefitsFromPatrons", () => {
    const samplePatron = {
      status: PatronStatus.ACTIVE,
      pledge: 10,
      pledgeLifetime: 100,
    };

    it("returns correctly when there are no valid patrons", () => {
      jest.spyOn(patronsService, "isValidPatron").mockReturnValue(false);

      expect(patronsService.getMaxBenefitsFromPatrons([samplePatron])).toEqual({
        maxFeeds: defaultMaxFeeds,
        maxUserFeeds: defaultMaxUserFeeds,
        maxGuilds: 0,
        allowWebhooks: false,
        refreshRateSeconds: undefined,
      });
    });

    it("returns the max feeds of all patron max feeds", () => {
      jest.spyOn(patronsService, "isValidPatron").mockReturnValue(true);
      jest
        .spyOn(patronsService, "getBenefitsFromPatron")
        .mockReturnValueOnce({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxGuilds: 1,
          allowWebhooks: true,
          refreshRateSeconds: 1,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        })
        .mockReturnValueOnce({
          maxFeeds: 10,
          maxUserFeeds: 10,
          maxGuilds: 1,
          allowWebhooks: true,
          refreshRateSeconds: 1,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        });

      expect(
        patronsService.getMaxBenefitsFromPatrons([samplePatron, samplePatron])
      ).toEqual(
        expect.objectContaining({
          maxFeeds: 10,
          maxUserFeeds: 10,
        })
      );
    });

    it("returns the max guilds of all patron max guilds", () => {
      jest.spyOn(patronsService, "isValidPatron").mockReturnValue(true);
      jest
        .spyOn(patronsService, "getBenefitsFromPatron")
        .mockReturnValueOnce({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxGuilds: 1,
          allowWebhooks: true,
          refreshRateSeconds: 1,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        })
        .mockReturnValueOnce({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxGuilds: 10,
          allowWebhooks: true,
          refreshRateSeconds: 1,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        });

      expect(
        patronsService.getMaxBenefitsFromPatrons([samplePatron, samplePatron])
      ).toEqual(
        expect.objectContaining({
          maxGuilds: 10,
        })
      );
    });
    it("returns the allow webhooks if at least one patron allow webhooks", () => {
      jest.spyOn(patronsService, "isValidPatron").mockReturnValue(true);
      jest
        .spyOn(patronsService, "getBenefitsFromPatron")
        .mockReturnValueOnce({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxGuilds: 1,
          allowWebhooks: true,
          refreshRateSeconds: 1,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        })
        .mockReturnValueOnce({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxGuilds: 1,
          allowWebhooks: false,
          refreshRateSeconds: 1,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        });

      expect(
        patronsService.getMaxBenefitsFromPatrons([samplePatron, samplePatron])
      ).toEqual(
        expect.objectContaining({
          allowWebhooks: true,
        })
      );
    });

    it("returns the first refresh rate of all patron refresh rates", () => {
      jest.spyOn(patronsService, "isValidPatron").mockReturnValue(true);
      jest
        .spyOn(patronsService, "getBenefitsFromPatron")
        .mockReturnValueOnce({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxGuilds: 1,
          allowWebhooks: true,
          refreshRateSeconds: 1,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        })
        .mockReturnValueOnce({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxGuilds: 1,
          allowWebhooks: true,
          refreshRateSeconds: 10,
          allowCustomPlaceholders: true,
          existsAndIsValid: true,
        });

      expect(
        patronsService.getMaxBenefitsFromPatrons([samplePatron, samplePatron])
      ).toEqual(
        expect.objectContaining({
          refreshRateSeconds: 1,
        })
      );
    });
  });

  describe("isValidPatron", () => {
    it("returns false when pledge is 0", () => {
      expect(
        patronsService.isValidPatron({
          status: PatronStatus.ACTIVE,
          pledge: 0,
        })
      ).toBe(false);
    });

    it("returns true if there is one patron that is active and has a nonzero pledge", () => {
      const patron = {
        status: PatronStatus.ACTIVE,
        pledge: 1,
      };

      const result = patronsService.isValidPatron(patron);

      expect(result).toBe(true);
    });

    it("returns true when declined, but last charge is within the past 4 days", () => {
      const supporter = {
        status: PatronStatus.DECLINED,
        pledge: 100,
        lastCharge: dayjs().subtract(2, "day").toDate(),
      };

      const result = patronsService.isValidPatron(supporter);

      expect(result).toBe(true);
    });

    it("returns false when they are a former patron", () => {
      const supporter = {
        status: PatronStatus.FORMER,
        pledge: 0,
      };

      const result = patronsService.isValidPatron(supporter);

      expect(result).toBe(false);
    });

    it("returns false when declined and last charge is >4 days ago", () => {
      const supporter = {
        status: PatronStatus.DECLINED,
        pledge: 100,
        lastCharge: dayjs().subtract(5, "day").toDate(),
      };

      const result = patronsService.isValidPatron(supporter);

      expect(result).toBe(false);
    });
  });

  describe("getBenefitsFromPatron", () => {
    it("returns the correct maxFeeds", () => {
      const patron = {
        pledgeLifetime: 1000,
        pledge: 100,
      };

      const maxFeeds = 10;
      jest
        .spyOn(patronsService, "getMaxFeedsFromPledge")
        .mockReturnValue(maxFeeds);

      const result = patronsService.getBenefitsFromPatron(patron);

      expect(result.maxFeeds).toBe(maxFeeds);
    });

    it("returns the correct maxGuilds", () => {
      const patron = {
        pledgeLifetime: 1000,
        pledge: 100,
      };

      const maxGuilds = 10;
      jest
        .spyOn(patronsService, "getMaxServersFromPledgeLifetime")
        .mockReturnValue(maxGuilds);

      const result = patronsService.getBenefitsFromPatron(patron);

      expect(result.maxGuilds).toBe(maxGuilds);
    });

    it("returns true for webhooks", () => {
      const patron = {
        pledgeLifetime: 1000,
        pledge: 100,
      };

      const result = patronsService.getBenefitsFromPatron(patron);

      expect(result.allowWebhooks).toBe(true);
    });
  });

  describe("getMaxFeedsFromPledge", () => {
    it("returns 140 when pledge is >= 2000", () => {
      expect(patronsService.getMaxFeedsFromPledge(2000)).toBe(140);
    });

    it("returns 105 when pledge >= 1500", () => {
      expect(patronsService.getMaxFeedsFromPledge(1500)).toBe(105);
    });

    it("returns 70 when pledge >= 1000", () => {
      expect(patronsService.getMaxFeedsFromPledge(1000)).toBe(70);
    });

    it("returns 35 when pledge >= 500", () => {
      expect(patronsService.getMaxFeedsFromPledge(500)).toBe(35);
    });

    it("returns 15 whenpledge >= 250", () => {
      expect(patronsService.getMaxFeedsFromPledge(250)).toBe(15);
    });

    it("returns defaultMaxFeeds when pledge < 250", () => {
      expect(patronsService.getMaxFeedsFromPledge(100)).toBe(defaultMaxFeeds);
    });
  });

  describe("getMaxServersFromPledgeLifetime", () => {
    it("returns 4 when lifetime pledge is >= 2500", () => {
      expect(patronsService.getMaxServersFromPledgeLifetime(2500)).toBe(4);
    });

    it("returns 3 when lifetime pledge is >= 1500", () => {
      expect(patronsService.getMaxServersFromPledgeLifetime(1500)).toBe(3);
    });

    it("returns 2 when lifetime pledge is >= 500", () => {
      expect(patronsService.getMaxServersFromPledgeLifetime(500)).toBe(2);
    });

    it("returns 1 when lifetime pledge is < 500", () => {
      expect(patronsService.getMaxServersFromPledgeLifetime(100)).toBe(1);
    });
  });

  describe("getRefreshRateSecondsFromPledge", () => {
    it("returns 2 if >= 500", () => {
      expect(patronsService.getRefreshRateSecondsFromPledge(500)).toBe(120);
    });

    it("returns undefined if <500", () => {
      expect(patronsService.getRefreshRateSecondsFromPledge(499)).toBe(
        undefined
      );
    });
  });
});
