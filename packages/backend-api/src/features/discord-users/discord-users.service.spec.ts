import { DiscordUsersService } from './discord-users.service';

describe('DiscordUsersService', () => {
  let service: DiscordUsersService;
  const discordApiService = {
    executeBearerRequest: jest.fn(),
  };

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new DiscordUsersService(discordApiService as any);

    jest.spyOn(discordApiService, 'executeBearerRequest').mockResolvedValue([]);
  });

  describe('getGuilds', () => {
    it('calls the correct api endpoint', async () => {
      const accessToken = 'abc';
      await service.getGuilds(accessToken);

      expect(discordApiService.executeBearerRequest).toHaveBeenCalledWith(
        accessToken,
        '/users/@me/guilds',
      );
    });

    it('returns the icon urls', async () => {
      const accessToken = 'abc';
      const guilds = [
        {
          id: 'guild_id',
          name: 'test',
          icon: 'icon_hash',
          owner: true,
          permissions: '123',
          features: ['123'],
        },
      ];
      discordApiService.executeBearerRequest.mockResolvedValue(guilds);

      const result = await service.getGuilds(accessToken);

      expect(result).toEqual([
        {
          ...guilds[0],
          iconUrl:
            `https://cdn.discordapp.com/icons` +
            `/${guilds[0].id}/${guilds[0].icon}.png?size=128`,
        },
      ]);
    });

    it('excludes guilds with no permissions', async () => {
      const accessToken = 'abc';
      const guilds = [
        {
          id: 'guild_id',
          name: 'test',
          icon: 'icon_hash',
          owner: false,
          permissions: 0,
        },
      ];
      discordApiService.executeBearerRequest.mockResolvedValue(guilds);

      const result = await service.getGuilds(accessToken);

      expect(result).toEqual([]);
    });

    it('includes guilds with manage channel permissions', async () => {
      const accessToken = 'abc';
      const guilds = [
        {
          id: 'guild_id',
          name: 'test',
          icon: 'icon_hash',
          owner: false,
          permissions: 16,
        },
      ];
      discordApiService.executeBearerRequest.mockResolvedValue(guilds);

      const result = await service.getGuilds(accessToken);

      expect(result).toHaveLength(1);
    });
  });

  describe('getUser', () => {
    it('calls the correct api endpoint', async () => {
      const accessToken = 'abc';
      await service.getUser(accessToken);

      expect(discordApiService.executeBearerRequest).toHaveBeenCalledWith(
        accessToken,
        '/users/@me',
      );
    });

    it('returns the user', async () => {
      const accessToken = 'abc';
      const user = {
        id: 'user_id',
        username: 'test',
        avatar: 'icon_hash',
      };
      discordApiService.executeBearerRequest.mockResolvedValue(user);

      const result = await service.getUser(accessToken);

      expect(result).toEqual({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        avatarUrl: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
      });
    });
  });
});
