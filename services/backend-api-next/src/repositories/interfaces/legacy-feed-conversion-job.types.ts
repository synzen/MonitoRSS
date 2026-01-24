import type { LegacyFeedConversionStatus } from "../shared/enums";

export interface ILegacyFeedConversionJob {
  id: string;
  legacyFeedId: string;
  guildId: string;
  discordUserId: string;
  status: LegacyFeedConversionStatus;
  failReasonPublic?: string;
  failReasonInternal?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILegacyFeedConversionJobRepository {}
