import { DiscordGuildRole } from "../../common";

const boilerplate: DiscordGuildRole = {
  id: "1",
  name: "name-1",
  permissions: "0",
  color: 1,
  hoist: false,
  mentionable: false,
  position: 1,
  icon: "icon-1",
};

export const createTestDiscordGuildRole = (
  override?: Partial<DiscordGuildRole>
): DiscordGuildRole => ({
  ...boilerplate,
  ...override,
});
