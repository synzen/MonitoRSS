import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import dayjs from "dayjs";
import { PatronsService } from "../../src/services/patrons/patrons.service";
import { PatronStatus } from "../../src/repositories/shared/enums";
import type { Config } from "../../src/config";

describe("PatronsService", {concurrency: true}, () => {
  let patronsService: PatronsService;
  const defaultMaxFeeds = 5;
  const defaultMaxUserFeeds = 10;
  const mockConfig = {
    BACKEND_API_DEFAULT_MAX_FEEDS: defaultMaxFeeds,
    BACKEND_API_DEFAULT_MAX_USER_FEEDS: defaultMaxUserFeeds,
  } as Config;

  beforeEach(() => {
    patronsService = new PatronsService(mockConfig);
  });

  describe("getMaxBenefitsFromPatrons", () => {
    it("returns correctly when there are no valid patrons", () => {
      const invalidPatron = {
        id: "123",
        status: PatronStatus.FORMER,
        pledge: 0,
        pledgeLifetime: 100,
      };

      const result = patronsService.getMaxBenefitsFromPatrons([invalidPatron]);

      assert.strictEqual(result.maxFeeds, defaultMaxFeeds);
      assert.strictEqual(result.maxUserFeeds, defaultMaxUserFeeds);
      assert.strictEqual(result.maxGuilds, 0);
      assert.strictEqual(result.allowWebhooks, false);
      assert.strictEqual(result.refreshRateSeconds, undefined);
    });

    it("returns the max feeds of all patron max feeds", () => {
      const patronWithLowerPledge = {
        id: "1",
        status: PatronStatus.ACTIVE,
        pledge: 500,
        pledgeLifetime: 100,
      };
      const patronWithHigherPledge = {
        id: "2",
        status: PatronStatus.ACTIVE,
        pledge: 1000,
        pledgeLifetime: 100,
      };

      const result = patronsService.getMaxBenefitsFromPatrons([
        patronWithLowerPledge,
        patronWithHigherPledge,
      ]);

      assert.strictEqual(result.maxFeeds, 70);
      assert.strictEqual(result.maxUserFeeds, 70);
    });

    it("returns the max guilds of all patron max guilds", () => {
      const patronWithLowerLifetime = {
        id: "1",
        status: PatronStatus.ACTIVE,
        pledge: 500,
        pledgeLifetime: 100,
      };
      const patronWithHigherLifetime = {
        id: "2",
        status: PatronStatus.ACTIVE,
        pledge: 500,
        pledgeLifetime: 2500,
      };

      const result = patronsService.getMaxBenefitsFromPatrons([
        patronWithLowerLifetime,
        patronWithHigherLifetime,
      ]);

      assert.strictEqual(result.maxGuilds, 4);
    });

    it("returns allowWebhooks true when at least one valid patron exists", () => {
      const validPatron = {
        id: "1",
        status: PatronStatus.ACTIVE,
        pledge: 500,
        pledgeLifetime: 100,
      };

      const result = patronsService.getMaxBenefitsFromPatrons([validPatron]);

      assert.strictEqual(result.allowWebhooks, true);
    });

    it("returns the first defined refresh rate from patrons", () => {
      const patronWithRefreshRate = {
        id: "1",
        status: PatronStatus.ACTIVE,
        pledge: 500,
        pledgeLifetime: 100,
      };
      const patronWithoutRefreshRate = {
        id: "2",
        status: PatronStatus.ACTIVE,
        pledge: 250,
        pledgeLifetime: 100,
      };

      const result = patronsService.getMaxBenefitsFromPatrons([
        patronWithRefreshRate,
        patronWithoutRefreshRate,
      ]);

      assert.strictEqual(result.refreshRateSeconds, 120);
    });
  });

  describe("isValidPatron", () => {
    it("returns false when pledge is 0", () => {
      const result = patronsService.isValidPatron({
        status: PatronStatus.ACTIVE,
        pledge: 0,
      });

      assert.strictEqual(result, false);
    });

    it("returns true if there is one patron that is active and has a nonzero pledge", () => {
      const patron = {
        status: PatronStatus.ACTIVE,
        pledge: 1,
      };

      const result = patronsService.isValidPatron(patron);

      assert.strictEqual(result, true);
    });

    it("returns true when declined, but last charge is within the past 4 days", () => {
      const supporter = {
        status: PatronStatus.DECLINED,
        pledge: 100,
        lastCharge: dayjs().subtract(2, "day").toDate(),
      };

      const result = patronsService.isValidPatron(supporter);

      assert.strictEqual(result, true);
    });

    it("returns false when they are a former patron", () => {
      const supporter = {
        status: PatronStatus.FORMER,
        pledge: 0,
      };

      const result = patronsService.isValidPatron(supporter);

      assert.strictEqual(result, false);
    });

    it("returns false when declined and last charge is >4 days ago", () => {
      const supporter = {
        status: PatronStatus.DECLINED,
        pledge: 100,
        lastCharge: dayjs().subtract(5, "day").toDate(),
      };

      const result = patronsService.isValidPatron(supporter);

      assert.strictEqual(result, false);
    });
  });

  describe("getBenefitsFromPatron", () => {
    it("returns the correct maxFeeds", () => {
      const patron = {
        id: "123",
        pledgeLifetime: 1000,
        pledge: 1000,
      };

      const result = patronsService.getBenefitsFromPatron(patron);

      assert.strictEqual(result.maxFeeds, 70);
    });

    it("returns the correct maxGuilds", () => {
      const patron = {
        id: "123",
        pledgeLifetime: 2500,
        pledge: 100,
      };

      const result = patronsService.getBenefitsFromPatron(patron);

      assert.strictEqual(result.maxGuilds, 4);
    });

    it("returns true for webhooks", () => {
      const patron = {
        id: "123",
        pledgeLifetime: 1000,
        pledge: 100,
      };

      const result = patronsService.getBenefitsFromPatron(patron);

      assert.strictEqual(result.allowWebhooks, true);
    });
  });

  describe("getMaxFeedsFromPledge", () => {
    it("returns 140 when pledge is >= 2000", () => {
      assert.strictEqual(patronsService.getMaxFeedsFromPledge(2000), 140);
    });

    it("returns 105 when pledge >= 1500", () => {
      assert.strictEqual(patronsService.getMaxFeedsFromPledge(1500), 105);
    });

    it("returns 70 when pledge >= 1000", () => {
      assert.strictEqual(patronsService.getMaxFeedsFromPledge(1000), 70);
    });

    it("returns 35 when pledge >= 500", () => {
      assert.strictEqual(patronsService.getMaxFeedsFromPledge(500), 35);
    });

    it("returns 15 when pledge >= 250", () => {
      assert.strictEqual(patronsService.getMaxFeedsFromPledge(250), 15);
    });

    it("returns defaultMaxFeeds when pledge < 250", () => {
      assert.strictEqual(
        patronsService.getMaxFeedsFromPledge(100),
        defaultMaxFeeds
      );
    });
  });

  describe("getMaxUserFeedsFromPledge", () => {
    it("returns 140 when pledge >= 2000", () => {
      assert.strictEqual(
        patronsService.getMaxUserFeedsFromPledge("123", 2000),
        140
      );
    });

    it("returns 105 when pledge >= 1500", () => {
      assert.strictEqual(
        patronsService.getMaxUserFeedsFromPledge("123", 1500),
        105
      );
    });

    it("returns 70 when pledge >= 1000", () => {
      assert.strictEqual(
        patronsService.getMaxUserFeedsFromPledge("123", 1000),
        70
      );
    });

    it("returns 35 when pledge >= 500", () => {
      assert.strictEqual(
        patronsService.getMaxUserFeedsFromPledge("123", 500),
        35
      );
    });

    it("returns 15 when pledge >= 250", () => {
      assert.strictEqual(
        patronsService.getMaxUserFeedsFromPledge("123", 250),
        15
      );
    });

    it("returns 5 for legacy patron IDs with pledge >= 100", () => {
      const legacyPatronId = "72337020";
      assert.strictEqual(
        patronsService.getMaxUserFeedsFromPledge(legacyPatronId, 100),
        5
      );
    });

    it("returns defaultMaxUserFeeds for non-legacy with pledge < 250", () => {
      assert.strictEqual(
        patronsService.getMaxUserFeedsFromPledge("123", 100),
        defaultMaxUserFeeds
      );
    });
  });

  describe("getMaxServersFromPledgeLifetime", () => {
    it("returns 4 when lifetime pledge is >= 2500", () => {
      assert.strictEqual(patronsService.getMaxServersFromPledgeLifetime(2500), 4);
    });

    it("returns 3 when lifetime pledge is >= 1500", () => {
      assert.strictEqual(patronsService.getMaxServersFromPledgeLifetime(1500), 3);
    });

    it("returns 2 when lifetime pledge is >= 500", () => {
      assert.strictEqual(patronsService.getMaxServersFromPledgeLifetime(500), 2);
    });

    it("returns 1 when lifetime pledge is < 500", () => {
      assert.strictEqual(patronsService.getMaxServersFromPledgeLifetime(100), 1);
    });
  });

  describe("getRefreshRateSecondsFromPledge", () => {
    it("returns 120 if >= 500", () => {
      assert.strictEqual(patronsService.getRefreshRateSecondsFromPledge(500), 120);
    });

    it("returns undefined if <500", () => {
      assert.strictEqual(
        patronsService.getRefreshRateSecondsFromPledge(499),
        undefined
      );
    });
  });
});
