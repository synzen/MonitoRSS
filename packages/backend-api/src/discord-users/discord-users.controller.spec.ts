import { DiscordUsersController } from './discord-users.controller';

describe('DiscordUsersController', () => {
  let controller: DiscordUsersController;
  const discordUsersService = {
    getUser: jest.fn(),
    getGuilds: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new DiscordUsersController(discordUsersService as never);
  });

  describe('getMe', () => {
    it('returns correctly', async () => {
      const discordAccessToken = 'token';
      const discordUser = {
        id: 'id',
        username: 'username',
        avatarUrl: 'avatarUrl',
      };
      discordUsersService.getUser.mockResolvedValue(discordUser);

      const expectedResponse = {
        id: discordUser.id,
        username: discordUser.username,
        iconUrl: discordUser.avatarUrl,
      };

      await expect(controller.getMe(discordAccessToken)).resolves.toEqual(
        expectedResponse,
      );
    });
  });

  describe('getMyServers', () => {
    it('returns the response correctly', async () => {
      const discordAccessToken = 'token';
      const discordGuilds = [
        {
          id: 'guild_id',
          name: 'test',
          iconUrl: 'iconUrl',
        },
      ];
      discordUsersService.getGuilds.mockResolvedValue(discordGuilds);

      const expectedResponse = {
        results: discordGuilds,
        total: 1,
      };

      await expect(
        controller.getMyServers(discordAccessToken),
      ).resolves.toEqual(expectedResponse);
    });
  });
});
