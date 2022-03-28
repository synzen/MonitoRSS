import { DiscordGuildChannel } from '../../common';

const boilerplate: DiscordGuildChannel = {
  guild_id: '1',
  id: '1',
  name: 'name-1',
  permission_overwrites: [],
};

export const createTestDiscordGuildChannel = (
  override?: Partial<DiscordGuildChannel>,
): DiscordGuildChannel => ({
  ...boilerplate,
  ...override,
});
