import { randomUUID } from "node:crypto";
import { PatronStatus } from "../../../src/repositories/shared/enums";
import type { IPatron } from "../../../src/repositories/interfaces";

const boilerplate: IPatron = {
  id: randomUUID(),
  email: "email@email.com",
  name: "name",
  pledge: 100,
  pledgeLifetime: 100,
  status: PatronStatus.ACTIVE,
  pledgeOverride: undefined,
};

export function createTestPatron(overrides: Partial<IPatron> = {}): IPatron {
  return {
    ...boilerplate,
    id: randomUUID(),
    ...overrides,
  };
}
