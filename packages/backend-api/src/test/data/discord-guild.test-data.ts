import { DiscordGuild } from '../../common';

const boilerplate: DiscordGuild = {
  id: '1',
  name: 'name-1',
  roles: [],
  icon: 'icon-1',
  owner_id: '1',
};

export const createTestDiscordGuild = (
  override?: Partial<DiscordGuild>,
): DiscordGuild => ({
  ...boilerplate,
  ...override,
});
