import { DiscordUsersController } from './discord-users.controller';

describe('DiscordUsersController', () => {
  let controller: DiscordUsersController;
  const discordUsersService = {
    getUser: jest.fn(),
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
});
