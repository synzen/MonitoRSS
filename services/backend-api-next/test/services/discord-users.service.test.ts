import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { DiscordUsersService } from "../../src/services/discord-users/discord-users.service";
import type { Config } from "../../src/config";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import { MANAGE_CHANNEL } from "../../src/shared/constants/permissions";

describe("DiscordUsersService", () => {
  let service: DiscordUsersService;
  let discordApiService: {
    executeBearerRequest: ReturnType<typeof mock.fn>;
    getBot: ReturnType<typeof mock.fn>;
    executeBotRequest: ReturnType<typeof mock.fn>;
  };
  let supportersService: {
    getBenefitsOfServers: ReturnType<typeof mock.fn>;
    getBenefitsOfDiscordUser: ReturnType<typeof mock.fn>;
    setGuilds: ReturnType<typeof mock.fn>;
  };
  const mockConfig = {} as Config;

  beforeEach(() => {
    discordApiService = {
      executeBearerRequest: mock.fn(() => Promise.resolve([])),
      getBot: mock.fn(),
      executeBotRequest: mock.fn(),
    };
    supportersService = {
      getBenefitsOfServers: mock.fn(() => Promise.resolve([])),
      getBenefitsOfDiscordUser: mock.fn(() =>
        Promise.resolve({
          maxFeeds: 0,
          maxGuilds: 0,
          guilds: [],
          maxUserFeeds: 0,
          maxUserFeedsComposition: { base: 0, legacy: 0 },
        })
      ),
      setGuilds: mock.fn(),
    };

    service = new DiscordUsersService({
      config: mockConfig,
      discordApiService: discordApiService as unknown as DiscordApiService,
      supportersService: supportersService as unknown as SupportersService,
    });
  });

  describe("getBot", () => {
    it("returns the bot with avatar URL", async () => {
      const getBotResponse = {
        username: "bot",
        id: "bot-id",
        avatar: "bot-avatar",
      };
      discordApiService.getBot.mock.mockImplementation(() =>
        Promise.resolve(getBotResponse)
      );

      const bot = await service.getBot();

      assert.deepStrictEqual(bot, {
        username: getBotResponse.username,
        id: getBotResponse.id,
        avatar: `https://cdn.discordapp.com/avatars/${getBotResponse.id}/${getBotResponse.avatar}.png`,
      });
    });

    it("returns null for avatar if bot has no avatar", async () => {
      const getBotResponse = {
        username: "bot",
        id: "bot-id",
        avatar: null,
      };
      discordApiService.getBot.mock.mockImplementation(() =>
        Promise.resolve(getBotResponse)
      );

      const bot = await service.getBot();

      assert.deepStrictEqual(bot, {
        username: getBotResponse.username,
        id: getBotResponse.id,
        avatar: null,
      });
    });
  });

  describe("getUserById", () => {
    it("returns user with static avatar URL (png) for non-animated avatar", async () => {
      const userResponse = {
        id: "user-123",
        username: "testuser",
        discriminator: "0001",
        avatar: "abc123",
      };
      discordApiService.executeBotRequest.mock.mockImplementation(() =>
        Promise.resolve(userResponse)
      );

      const user = await service.getUserById("user-123");

      assert.strictEqual(
        discordApiService.executeBotRequest.mock.calls[0]?.arguments[0],
        "/users/user-123"
      );
      assert.deepStrictEqual(user, {
        id: userResponse.id,
        username: userResponse.username,
        discriminator: userResponse.discriminator,
        avatar: `https://cdn.discordapp.com/avatars/${userResponse.id}/${userResponse.avatar}.png`,
      });
    });

    it("returns user with animated avatar URL (gif) for animated avatar", async () => {
      const userResponse = {
        id: "user-456",
        username: "animateduser",
        discriminator: "1234",
        avatar: "a_def789",
      };
      discordApiService.executeBotRequest.mock.mockImplementation(() =>
        Promise.resolve(userResponse)
      );

      const user = await service.getUserById("user-456");

      assert.deepStrictEqual(user, {
        id: userResponse.id,
        username: userResponse.username,
        discriminator: userResponse.discriminator,
        avatar: `https://cdn.discordapp.com/avatars/${userResponse.id}/${userResponse.avatar}.gif`,
      });
    });

    it("returns null avatar when user has no avatar", async () => {
      const userResponse = {
        id: "user-789",
        username: "noavataruser",
        discriminator: "5678",
        avatar: null,
      };
      discordApiService.executeBotRequest.mock.mockImplementation(() =>
        Promise.resolve(userResponse)
      );

      const user = await service.getUserById("user-789");

      assert.deepStrictEqual(user, {
        id: userResponse.id,
        username: userResponse.username,
        discriminator: userResponse.discriminator,
        avatar: null,
      });
    });
  });

  describe("getGuilds", () => {
    it("calls the correct api endpoint", async () => {
      const accessToken = "abc";
      await service.getGuilds(accessToken);

      assert.strictEqual(discordApiService.executeBearerRequest.mock.calls.length, 1);
      assert.strictEqual(
        discordApiService.executeBearerRequest.mock.calls[0]?.arguments[0],
        accessToken
      );
      assert.strictEqual(
        discordApiService.executeBearerRequest.mock.calls[0]?.arguments[1],
        "/users/@me/guilds"
      );
    });

    it("returns the icon urls", async () => {
      const accessToken = "abc";
      const guilds = [
        {
          id: "guild_id",
          name: "test",
          icon: "icon_hash",
          owner: true,
          permissions: "123",
        },
      ];
      discordApiService.executeBearerRequest.mock.mockImplementation(() =>
        Promise.resolve(guilds)
      );
      supportersService.getBenefitsOfServers.mock.mockImplementation(() =>
        Promise.resolve([{ maxFeeds: 10, webhooks: true }])
      );

      const result = await service.getGuilds(accessToken);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(
        result[0]?.iconUrl,
        `https://cdn.discordapp.com/icons/${guilds[0]?.id}/${guilds[0]?.icon}.png?size=128`
      );
    });

    it("returns the benefits correctly", async () => {
      const accessToken = "abc";
      const guilds = [
        {
          id: "guild_id",
          name: "test",
          icon: "icon_hash",
          owner: true,
          permissions: "123",
        },
        {
          id: "guild_id_2",
          name: "test2",
          icon: "icon_hash2",
          owner: true,
          permissions: "123",
        },
      ];
      discordApiService.executeBearerRequest.mock.mockImplementation(() =>
        Promise.resolve(guilds)
      );
      const benefitsResponse = [
        { maxFeeds: 10, webhooks: true },
        { maxFeeds: 20, webhooks: false },
      ];
      supportersService.getBenefitsOfServers.mock.mockImplementation(() =>
        Promise.resolve(benefitsResponse)
      );

      const result = await service.getGuilds(accessToken);

      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result[0]?.benefits, {
        maxFeeds: 10,
        webhooks: true,
      });
      assert.deepStrictEqual(result[1]?.benefits, {
        maxFeeds: 20,
        webhooks: false,
      });
    });

    it("excludes guilds with no permissions", async () => {
      const accessToken = "abc";
      const guilds = [
        {
          id: "guild_id",
          name: "test",
          icon: "icon_hash",
          owner: false,
          permissions: "0",
        },
      ];
      discordApiService.executeBearerRequest.mock.mockImplementation(() =>
        Promise.resolve(guilds)
      );
      supportersService.getBenefitsOfServers.mock.mockImplementation(() =>
        Promise.resolve([{ maxFeeds: 10, webhooks: true }])
      );

      const result = await service.getGuilds(accessToken);

      assert.strictEqual(result.length, 0);
    });

    it("includes guilds with manage channel permissions", async () => {
      const accessToken = "abc";
      const guilds = [
        {
          id: "guild_id",
          name: "test",
          icon: "icon_hash",
          owner: false,
          permissions: MANAGE_CHANNEL.toString(),
        },
      ];
      discordApiService.executeBearerRequest.mock.mockImplementation(() =>
        Promise.resolve(guilds)
      );
      supportersService.getBenefitsOfServers.mock.mockImplementation(() =>
        Promise.resolve([{ maxFeeds: 10, webhooks: true }])
      );

      const result = await service.getGuilds(accessToken);

      assert.strictEqual(result.length, 1);
    });
  });

  describe("getUser", () => {
    it("calls the correct api endpoint", async () => {
      const accessToken = "abc";
      discordApiService.executeBearerRequest.mock.mockImplementation(() =>
        Promise.resolve({ id: "user_id", username: "test", avatar: null })
      );

      await service.getUser(accessToken);

      assert.strictEqual(discordApiService.executeBearerRequest.mock.calls.length, 1);
      assert.strictEqual(
        discordApiService.executeBearerRequest.mock.calls[0]?.arguments[0],
        accessToken
      );
      assert.strictEqual(
        discordApiService.executeBearerRequest.mock.calls[0]?.arguments[1],
        "/users/@me"
      );
    });

    it("returns the user with supporter details if they are a supporter", async () => {
      const accessToken = "abc";
      const user = {
        id: "user_id",
        username: "test",
        discriminator: "0",
        avatar: "icon_hash",
      };
      const supporterBenefits = {
        isSupporter: true,
        guilds: ["1"],
        maxFeeds: 10,
        maxGuilds: 10,
        maxUserFeeds: 15,
        maxUserFeedsComposition: { base: 15, legacy: 0 },
        expireAt: new Date("2025-01-01"),
        allowCustomPlaceholders: true,
      };
      discordApiService.executeBearerRequest.mock.mockImplementation(() =>
        Promise.resolve(user)
      );
      supportersService.getBenefitsOfDiscordUser.mock.mockImplementation(() =>
        Promise.resolve(supporterBenefits)
      );

      const result = await service.getUser(accessToken);

      assert.strictEqual(result.id, user.id);
      assert.strictEqual(result.username, user.username);
      assert.strictEqual(result.avatar, user.avatar);
      assert.strictEqual(
        result.avatarUrl,
        `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      );
      assert.strictEqual(result.maxFeeds, supporterBenefits.maxFeeds);
      assert.strictEqual(result.maxUserFeeds, supporterBenefits.maxUserFeeds);
      assert.deepStrictEqual(result.supporter, {
        guilds: supporterBenefits.guilds,
        maxFeeds: supporterBenefits.maxFeeds,
        maxGuilds: supporterBenefits.maxGuilds,
        expireAt: supporterBenefits.expireAt,
      });
    });

    it("returns the user with no supporter details if they are not a supporter", async () => {
      const accessToken = "abc";
      const user = {
        id: "user_id",
        username: "test",
        discriminator: "0",
        avatar: "icon_hash",
      };
      const supporterBenefits = {
        isSupporter: false,
        guilds: [],
        maxFeeds: 10,
        maxGuilds: 10,
        maxUserFeeds: 5,
        maxUserFeedsComposition: { base: 5, legacy: 0 },
      };
      discordApiService.executeBearerRequest.mock.mockImplementation(() =>
        Promise.resolve(user)
      );
      supportersService.getBenefitsOfDiscordUser.mock.mockImplementation(() =>
        Promise.resolve(supporterBenefits)
      );

      const result = await service.getUser(accessToken);

      assert.strictEqual(result.id, user.id);
      assert.strictEqual(result.username, user.username);
      assert.strictEqual(result.supporter, undefined);
    });
  });

  describe("updateSupporter", () => {
    it("calls supportersService to set the guilds if guild ids is inputted", async () => {
      const guildIds = ["1", "2"];
      const userId = "user-id";

      await service.updateSupporter(userId, { guildIds });

      assert.strictEqual(supportersService.setGuilds.mock.calls.length, 1);
      assert.strictEqual(
        supportersService.setGuilds.mock.calls[0]?.arguments[0],
        userId
      );
      assert.deepStrictEqual(
        supportersService.setGuilds.mock.calls[0]?.arguments[1],
        guildIds
      );
    });

    it("does not call setGuilds if guildIds is not provided", async () => {
      const userId = "user-id";

      await service.updateSupporter(userId, {});

      assert.strictEqual(supportersService.setGuilds.mock.calls.length, 0);
    });
  });
});
