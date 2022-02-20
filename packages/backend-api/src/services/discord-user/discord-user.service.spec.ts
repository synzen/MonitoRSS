import { DiscordUserService } from './discord-user.service';

describe('DiscordUserService', () => {
  let service: DiscordUserService;
  const discordApiService = {
    executeBearerRequest: jest.fn(),
  };

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new DiscordUserService(discordApiService as any);

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
          icon_url:
            `https://cdn.discordapp.com/icons` +
            `/${guilds[0].id}/${guilds[0].icon}.png?size=128`,
        },
      ]);
    });
  });
});
