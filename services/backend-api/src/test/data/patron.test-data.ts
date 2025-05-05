import { Types } from "mongoose";
import {
  Patron,
  PatronStatus,
} from "../../features/supporters/entities/patron.entity";

const boilerplate: Patron = {
  _id: new Types.ObjectId().toHexString(),
  email: "email@email.com",
  name: "name",
  pledge: 100,
  pledgeLifetime: 100,
  status: PatronStatus.ACTIVE,
  pledgeOverride: undefined,
};

export const createTestPatron = (overrides: Partial<Patron> = {}): Patron => ({
  ...boilerplate,
  _id: new Types.ObjectId().toHexString(),
  ...overrides,
});
