import { DiscordGuildMember } from "../../common";

const boilerplate: DiscordGuildMember = {
  roles: [],
  user: {
    id: "1",
    username: "username",
  },
};

export const createTestDiscordGuildMember = (
  override?: Partial<DiscordGuildMember>
): DiscordGuildMember => ({
  ...boilerplate,
  ...override,
});
