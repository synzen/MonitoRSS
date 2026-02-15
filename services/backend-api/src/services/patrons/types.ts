import type { PatronStatus } from "../../repositories/shared/enums";

export interface PatronBenefits {
  existsAndIsValid: boolean;
  maxFeeds: number;
  maxUserFeeds: number;
  maxGuilds: number;
  allowWebhooks: boolean;
  refreshRateSeconds?: number;
  allowCustomPlaceholders: boolean;
  maxPatreonPledge: number;
}

export interface PatronDetails {
  id: string;
  status: PatronStatus;
  pledge: number;
  pledgeOverride?: number;
  pledgeLifetime: number;
  lastCharge?: Date;
}
