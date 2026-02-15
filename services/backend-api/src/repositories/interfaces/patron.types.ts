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
}
