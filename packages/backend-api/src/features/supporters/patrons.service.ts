import { Injectable } from '@nestjs/common';
import { Patron, PatronStatus } from './entities/patron.entity';
import dayjs from 'dayjs';
import { ConfigService } from '@nestjs/config';

interface PatronBenefits {
  maxFeeds: number;
  maxGuilds: number;
  allowWebhooks: boolean;
}

interface PatronDetails {
  status: Patron['status'];
  pledge: number;
  pledgeLifetime: number;
}

@Injectable()
export class PatronsService {
  defaultMaxFeeds: number;
  constructor(private readonly configsService: ConfigService) {
    this.defaultMaxFeeds = this.configsService.get<number>(
      'defaultMaxFeeds',
    ) as number;
  }

  getMaxBenefitsFromPatrons(patrons: Array<PatronDetails>): PatronBenefits {
    const allBenefits = patrons
      .filter((patron) => this.isValidPatron(patron))
      .map((patron) => this.getBenefitsFromPatron(patron));

    if (allBenefits.length === 0) {
      return {
        maxFeeds: this.defaultMaxFeeds,
        maxGuilds: 0,
        allowWebhooks: false,
      };
    }

    return {
      maxFeeds: Math.max(...allBenefits.map((benefits) => benefits.maxFeeds)),
      maxGuilds: Math.max(...allBenefits.map((benefits) => benefits.maxGuilds)),
      allowWebhooks: allBenefits.some((benefits) => benefits.allowWebhooks),
    };
  }

  isValidPatron(patron: {
    status: Patron['status'];
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

      const oldestAllowableDate = dayjs().subtract(4, 'days');

      return lastChargeDate.isAfter(oldestAllowableDate);
    }

    return false;
  }

  getBenefitsFromPatron({
    pledge,
    pledgeLifetime,
  }: {
    pledge: number;
    pledgeLifetime: number;
  }): PatronBenefits {
    return {
      maxFeeds: this.getMaxFeedsFromPledge(pledge),
      maxGuilds: this.getMaxServersFromPledgeLifetime(pledgeLifetime),
      allowWebhooks: true,
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
}
