import { DiscordGuildMember } from "../../common";

const boilerplate: DiscordGuildMember = {
  roles: [],
  user: {
    id: "1",
  },
};

export const createTestDiscordGuildMember = (
  override?: Partial<DiscordGuildMember>
): DiscordGuildMember => ({
  ...boilerplate,
  ...override,
});
