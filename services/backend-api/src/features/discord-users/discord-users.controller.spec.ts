import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { DiscordUsersController } from "./discord-users.controller";
import { GetMeOutputDto } from "./dto";
import { PartialUserGuildFormatted } from "./types/PartialUserGuild.type";

describe("DiscordUsersController", () => {
  let controller: DiscordUsersController;
  const discordUsersService = {
    getUser: jest.fn(),
    getGuilds: jest.fn(),
  };
  const discordAccessToken: SessionAccessToken = {
    access_token: "abc",
    discord: {
      id: "123",
    },
    expiresAt: 1,
    expires_in: 3600,
    refresh_token: "def",
    scope: "guilds",
    token_type: "Bearer",
  };

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new DiscordUsersController(discordUsersService as never);
  });

  describe("getMe", () => {
    it("returns correctly", async () => {
      const discordUser = {
        id: "id",
        username: "username",
        avatarUrl: "avatarUrl",
        maxFeeds: 10,
        maxUserFeeds: 11,
        supporter: {
          guilds: ["1"],
          maxFeeds: 10,
          maxGuilds: 10,
          expireAt: new Date(),
        },
      };
      discordUsersService.getUser.mockResolvedValue(discordUser);

      const expectedResponse: GetMeOutputDto = {
        id: discordUser.id,
        username: discordUser.username,
        iconUrl: discordUser.avatarUrl,
        maxFeeds: discordUser.supporter.maxFeeds,
        maxUserFeeds: discordUser.maxUserFeeds,
        supporter: {
          guilds: discordUser.supporter.guilds,
          maxFeeds: discordUser.supporter.maxFeeds,
          maxGuilds: discordUser.supporter.maxGuilds,
          expireAt: discordUser.supporter.expireAt,
        },
      };

      await expect(controller.getMe(discordAccessToken)).resolves.toEqual(
        expectedResponse
      );
    });
    it("returns correctly without supporter", async () => {
      const discordUser = {
        id: "id",
        username: "username",
        avatarUrl: "avatarUrl",
        maxFeeds: 11,
        maxUserFeeds: 12,
      };
      discordUsersService.getUser.mockResolvedValue(discordUser);

      const expectedResponse: GetMeOutputDto = {
        id: discordUser.id,
        username: discordUser.username,
        iconUrl: discordUser.avatarUrl,
        maxFeeds: discordUser.maxFeeds,
        maxUserFeeds: discordUser.maxUserFeeds,
      };

      await expect(controller.getMe(discordAccessToken)).resolves.toEqual(
        expectedResponse
      );
    });
  });

  describe("getMyServers", () => {
    it("returns the response correctly", async () => {
      const discordGuilds: PartialUserGuildFormatted[] = [
        {
          id: "guild_id",
          name: "test",
          iconUrl: "iconUrl",
          owner: true,
          permissions: "123",
          benefits: {
            maxFeeds: 10,
            webhooks: true,
          },
        },
      ];
      discordUsersService.getGuilds.mockResolvedValue(discordGuilds);

      const expectedResponse = {
        results: [
          {
            id: discordGuilds[0].id,
            name: discordGuilds[0].name,
            iconUrl: discordGuilds[0].iconUrl,
            benefits: {
              maxFeeds: discordGuilds[0].benefits.maxFeeds,
              webhooks: discordGuilds[0].benefits.webhooks,
            },
          },
        ],
        total: 1,
      };

      await expect(
        controller.getMyServers(discordAccessToken)
      ).resolves.toEqual(expectedResponse);
    });
  });
});
