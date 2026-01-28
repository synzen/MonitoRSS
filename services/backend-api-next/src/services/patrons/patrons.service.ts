import dayjs from "dayjs";
import type { Config } from "../../config";
import { PatronStatus } from "../../repositories/shared/enums";
import type { PatronBenefits, PatronDetails } from "./types";

const LEGACY_PATREON_T1_IDS = new Set([
  "72337020",
  "35975808",
  "109183897",
  "58534",
  "77239951",
  "67367312",
]);

export class PatronsService {
  private readonly defaultMaxFeeds: number;
  private readonly defaultMaxUserFeeds: number;

  constructor(private readonly config: Config) {
    this.defaultMaxFeeds = config.BACKEND_API_DEFAULT_MAX_FEEDS;
    this.defaultMaxUserFeeds = config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;
  }

  getMaxBenefitsFromPatrons(patrons: PatronDetails[]): PatronBenefits {
    const allBenefits = patrons
      .filter((patron) => this.isValidPatron(patron))
      .map((patron) => this.getBenefitsFromPatron(patron));

    const maxPatreonPledge = Math.max(
      ...patrons.map((patron) => patron.pledgeOverride || patron.pledge),
      0,
    );

    if (allBenefits.length === 0) {
      return {
        existsAndIsValid: false,
        maxFeeds: this.defaultMaxFeeds,
        maxUserFeeds: this.defaultMaxUserFeeds,
        maxGuilds: 0,
        allowWebhooks: false,
        allowCustomPlaceholders: false,
        maxPatreonPledge,
      };
    }

    return {
      existsAndIsValid: true,
      maxFeeds: Math.max(...allBenefits.map((b) => b.maxFeeds)),
      maxUserFeeds: Math.max(...allBenefits.map((b) => b.maxUserFeeds)),
      maxGuilds: Math.max(...allBenefits.map((b) => b.maxGuilds)),
      allowWebhooks: allBenefits.some((b) => b.allowWebhooks),
      refreshRateSeconds: allBenefits.find(
        (b) => b.refreshRateSeconds !== undefined,
      )?.refreshRateSeconds,
      allowCustomPlaceholders: allBenefits.some(
        (b) => b.allowCustomPlaceholders,
      ),
      maxPatreonPledge,
    };
  }

  isValidPatron(patron: {
    status: PatronStatus;
    pledge: number;
    lastCharge?: Date;
  }): boolean {
    if (!patron.pledge) {
      return false;
    }

    if (patron.status === PatronStatus.ACTIVE) {
      return true;
    }

    if (patron.status === PatronStatus.DECLINED) {
      const lastChargeDate = dayjs(patron.lastCharge);

      if (!lastChargeDate.isValid()) {
        return false;
      }

      const oldestAllowableDate = dayjs().subtract(4, "days");

      return lastChargeDate.isAfter(oldestAllowableDate);
    }

    return false;
  }

  getBenefitsFromPatron(patron: {
    id: string;
    pledge: number;
    pledgeLifetime: number;
    pledgeOverride?: number;
  }): PatronBenefits {
    const pledge = patron.pledgeOverride ?? patron.pledge;

    return {
      existsAndIsValid: true,
      maxFeeds: this.getMaxFeedsFromPledge(pledge),
      maxUserFeeds: this.getMaxUserFeedsFromPledge(patron.id, pledge),
      maxGuilds: this.getMaxServersFromPledgeLifetime(patron.pledgeLifetime),
      allowWebhooks: true,
      refreshRateSeconds: this.getRefreshRateSecondsFromPledge(pledge),
      allowCustomPlaceholders: pledge >= 500,
      maxPatreonPledge: pledge,
    };
  }

  getMaxFeedsFromPledge(pledge: number): number {
    if (pledge >= 2000) {
      return 140;
    }
    if (pledge >= 1500) {
      return 105;
    }
    if (pledge >= 1000) {
      return 70;
    }
    if (pledge >= 500) {
      return 35;
    }
    if (pledge >= 250) {
      return 15;
    }

    return this.defaultMaxFeeds;
  }

  getMaxUserFeedsFromPledge(patreonId: string, pledge: number): number {
    if (pledge >= 2000) {
      return 140;
    }
    if (pledge >= 1500) {
      return 105;
    }
    if (pledge >= 1000) {
      return 70;
    }
    if (pledge >= 500) {
      return 35;
    }
    if (pledge >= 250) {
      return 15;
    }
    if (LEGACY_PATREON_T1_IDS.has(patreonId) && pledge >= 100) {
      return 5;
    }

    return this.defaultMaxUserFeeds;
  }

  getMaxServersFromPledgeLifetime(pledgeLifetime: number): number {
    if (pledgeLifetime >= 2500) {
      return 4;
    }
    if (pledgeLifetime >= 1500) {
      return 3;
    }
    if (pledgeLifetime >= 500) {
      return 2;
    }

    return 1;
  }

  getRefreshRateSecondsFromPledge(pledge: number): number | undefined {
    if (pledge >= 500) {
      return 120;
    }

    return undefined;
  }
}
