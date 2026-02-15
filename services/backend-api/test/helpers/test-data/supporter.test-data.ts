import type { ISupporter } from "../../../src/repositories/interfaces/supporter.types";

const boilerplate: ISupporter = {
  id: "discord-user-id",
  guilds: ["serverid"],
  patron: true,
};

export function createTestSupporter(
  overrides: Partial<ISupporter> = {},
): ISupporter {
  return {
    ...boilerplate,
    ...overrides,
  };
}
