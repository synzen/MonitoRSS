import { Injectable } from "@nestjs/common";
import { Patron, PatronStatus } from "./entities/patron.entity";
import dayjs from "dayjs";
import { ConfigService } from "@nestjs/config";

interface PatronBenefits {
  existsAndIsValid: boolean;
  maxFeeds: number;
  maxUserFeeds: number;
  maxGuilds: number;
  allowWebhooks: boolean;
  refreshRateSeconds?: number;
  allowCustomPlaceholders: boolean;
  maxPatreonPledge: number;
}

interface PatronDetails {
  _id: string;
  status: Patron["status"];
  pledge: number;
  pledgeOverride?: number;
  pledgeLifetime: number;
}

/**
 * Publicly hosting bot has decreased feed limit from 5 to 3 on 1 May 2025. These patrons are Patreon $1 supporters and will be
 * grandfathered in to 5 feeds.
 */
const LEGACY_PATREON_T1_IDS = new Set([
  "72337020",
  "35975808",
  "109183897",
  "58534",
  "77239951",
  "67367312",
]);

@Injectable()
export class PatronsService {
  defaultMaxFeeds: number;

  defaultMaxUserFeeds: number;

  constructor(private readonly configsService: ConfigService) {
    this.defaultMaxFeeds = this.configsService.getOrThrow<number>(
      "BACKEND_API_DEFAULT_MAX_FEEDS"
    ) as number;

    this.defaultMaxUserFeeds = +this.configsService.getOrThrow<number>(
      "BACKEND_API_DEFAULT_MAX_USER_FEEDS"
    );
  }

  getMaxBenefitsFromPatrons(patrons: Array<PatronDetails>): PatronBenefits {
    const allBenefits = patrons
      .filter((patron) => this.isValidPatron(patron))
      .map((patron) => this.getBenefitsFromPatron(patron));

    const maxPatreonPledge = Math.max(
      ...patrons.map((patron) => patron.pledgeOverride || patron.pledge),
      0
    );

    if (allBenefits.length === 0) {
      return {
        existsAndIsValid: false,
        maxFeeds: this.defaultMaxFeeds,
        maxGuilds: 0,
        allowWebhooks: false,
        maxUserFeeds: this.defaultMaxUserFeeds,
        allowCustomPlaceholders: false,
        maxPatreonPledge,
      };
    }

    return {
      existsAndIsValid: true,
      maxFeeds: Math.max(...allBenefits.map((benefits) => benefits.maxFeeds)),
      maxGuilds: Math.max(...allBenefits.map((benefits) => benefits.maxGuilds)),
      allowWebhooks: allBenefits.some((benefits) => benefits.allowWebhooks),
      // Arbitrarily select one since there is no business rule on this at the moment
      refreshRateSeconds: allBenefits.find(
        (benefits) => benefits.refreshRateSeconds !== undefined
      )?.refreshRateSeconds,
      maxUserFeeds: Math.max(
        ...allBenefits.map((benefits) => benefits.maxUserFeeds)
      ),
      allowCustomPlaceholders: allBenefits.some(
        (benefits) => benefits.allowCustomPlaceholders
      ),
      maxPatreonPledge,
    };
  }

  isValidPatron(patron: {
    status: Patron["status"];
    pledge: number;
    lastCharge?: Date;
  }) {
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

  getBenefitsFromPatron({
    _id: patreonId,
    pledge,
    pledgeLifetime,
    pledgeOverride,
  }: {
    _id: string;
    pledge: number;
    pledgeLifetime: number;
    pledgeOverride?: number;
  }): PatronBenefits {
    const usePledge = pledgeOverride ?? pledge;

    return {
      existsAndIsValid: true,
      maxFeeds: this.getMaxFeedsFromPledge(usePledge),
      maxUserFeeds: this.getMaxUserFeedsFromPledge(patreonId, usePledge),
      maxGuilds: this.getMaxServersFromPledgeLifetime(pledgeLifetime),
      refreshRateSeconds: this.getRefreshRateSecondsFromPledge(usePledge),
      allowWebhooks: true,
      allowCustomPlaceholders: usePledge >= 500,
      maxPatreonPledge: usePledge,
    };
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

  getRefreshRateSecondsFromPledge(pledge: number) {
    if (pledge >= 500) {
      return 60 * 2;
    }
  }
}
