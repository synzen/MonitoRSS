import { DiscordChannelType, DiscordGuildChannel } from "../../common";

const boilerplate: DiscordGuildChannel = {
  guild_id: "1",
  id: "1",
  name: "name-1",
  permission_overwrites: [],
  parent_id: null,
  type: DiscordChannelType.GUILD_TEXT,
};

export const createTestDiscordGuildChannel = (
  override?: Partial<DiscordGuildChannel>
): DiscordGuildChannel => ({
  ...boilerplate,
  ...override,
});
