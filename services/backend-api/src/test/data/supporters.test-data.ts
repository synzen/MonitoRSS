import { Supporter } from "../../features/supporters/entities/supporter.entity";

const boilerplate: Supporter = {
  _id: "discord-user-id",
  guilds: ["serverid"],
  patron: true,
};

export const createTestSupporter = (
  overrides: Partial<Supporter> = {}
): Supporter => ({
  ...boilerplate,
  ...overrides,
});
