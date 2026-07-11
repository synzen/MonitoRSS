import type { PatronStatus } from "../shared/enums";

export interface IPatron {
  id: string;
  statusOverride?: PatronStatus;
  status: PatronStatus;
  lastCharge?: Date;
  pledgeLifetime: number;
  pledgeOverride?: number;
  pledge: number;
  name: string;
  discord?: string;
  email: string;
}

export interface IPatronRepository {
  create(patron: IPatron): Promise<IPatron>;
  deleteAll(): Promise<void>;
  // Strips the personal email from every patron row tied to a Discord id,
  // keeping the financial record (legal-retention exemption).
  clearEmailByDiscordId(discordUserId: string): Promise<void>;
}
