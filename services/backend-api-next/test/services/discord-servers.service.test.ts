import { describe, it, beforeEach, mock, Mock } from "node:test";
import assert from "node:assert";
import { DiscordServersService } from "../../src/services/discord-servers/discord-servers.service";
import type { DiscordServersServiceDeps } from "../../src/services/discord-servers/discord-servers.service";
import type { Config } from "../../src/config";
import { DiscordChannelType } from "../../src/shared/types/discord.types";
import { DiscordAPIError } from "../../src/shared/exceptions/discord-api.error";
import { DiscordServerNotFoundException } from "../../src/shared/exceptions/discord-servers.exceptions";

function createMockConfig(): Config {
  return {
    BACKEND_API_DEFAULT_DATE_FORMAT: "YYYY-MM-DD",
    BACKEND_API_DEFAULT_TIMEZONE: "UTC",
    BACKEND_API_DEFAULT_DATE_LANGUAGE: "en",
  } as Config;
}

function createMockDeps(): DiscordServersServiceDeps & {
  discordApiService: { executeBotRequest: Mock<(...args: unknown[]) => Promise<unknown>>; getGuild: Mock<(...args: unknown[]) => Promise<unknown>>; getGuildMember: Mock<(...args: unknown[]) => Promise<unknown>> };
  feedsService: { getServerFeeds: Mock<(...args: unknown[]) => Promise<unknown>>; countServerFeeds: Mock<(...args: unknown[]) => Promise<unknown>> };
  discordPermissionsService: { botHasPermissionInServer: Mock<(...args: unknown[]) => Promise<boolean>> };
  discordServerProfileRepository: {
    findById: Mock<(...args: unknown[]) => Promise<unknown>>;
    findOneAndUpdate: Mock<(...args: unknown[]) => Promise<unknown>>;
  };
} {
  return {
    config: createMockConfig(),
    discordApiService: {
      executeBotRequest: mock.fn(async () => ({})),
      getGuild: mock.fn(async () => ({})),
      getGuildMember: mock.fn(async () => ({})),
    },
    feedsService: {
      getServerFeeds: mock.fn(async () => []),
      countServerFeeds: mock.fn(async () => 0),
    },
    discordPermissionsService: {
      botHasPermissionInServer: mock.fn(async () => true),
    },
    discordServerProfileRepository: {
      findById: mock.fn(async () => null),
      findOneAndUpdate: mock.fn(async () => ({})),
    },
  } as unknown as DiscordServersServiceDeps & {
    discordApiService: { executeBotRequest: Mock<(...args: unknown[]) => Promise<unknown>>; getGuild: Mock<(...args: unknown[]) => Promise<unknown>>; getGuildMember: Mock<(...args: unknown[]) => Promise<unknown>> };
    feedsService: { getServerFeeds: Mock<(...args: unknown[]) => Promise<unknown>>; countServerFeeds: Mock<(...args: unknown[]) => Promise<unknown>> };
    discordPermissionsService: { botHasPermissionInServer: Mock<(...args: unknown[]) => Promise<boolean>> };
    discordServerProfileRepository: {
      findById: Mock<(...args: unknown[]) => Promise<unknown>>;
      findOneAndUpdate: Mock<(...args: unknown[]) => Promise<unknown>>;
    };
  };
}

describe("DiscordServersService", () => {
  let service: DiscordServersService;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
    service = new DiscordServersService(deps);
  });

  describe("getActiveThreads", () => {
    const guildId = "guildId";
    const threadsResponse = {
      threads: [
        {
          id: "1",
          type: DiscordChannelType.PRIVATE_THREAD,
          guild_id: guildId,
          name: "thread1",
          parent_id: null,
          permission_overwrites: [],
        },
        {
          id: "2",
          type: DiscordChannelType.PUBLIC_THREAD,
          guild_id: guildId,
          name: "thread2",
          parent_id: null,
          permission_overwrites: [],
        },
      ],
    };

    it("should return active threads, excluding private by default", async () => {
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => ({ ...threadsResponse })
      );

      const result = await service.getActiveThreads(guildId);

      assert.deepStrictEqual(result, [
        {
          id: "2",
          type: DiscordChannelType.PUBLIC_THREAD,
          guild_id: guildId,
          name: "thread2",
          availableTags: [],
          category: null,
        },
      ]);
    });

    it("should return active threads, including private if specified", async () => {
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => threadsResponse
      );

      const result = await service.getActiveThreads(guildId, {
        includePrivate: true,
      });

      assert.deepStrictEqual(result, [
        {
          id: "1",
          type: DiscordChannelType.PRIVATE_THREAD,
          guild_id: guildId,
          name: "thread1",
          availableTags: [],
          category: null,
        },
        {
          id: "2",
          type: DiscordChannelType.PUBLIC_THREAD,
          guild_id: guildId,
          name: "thread2",
          availableTags: [],
          category: null,
        },
      ]);
    });

    it("should return active threads under parent channel id if specified", async () => {
      const parentChannelId = "parent-1";
      const thisResponse = {
        threads: [
          {
            id: "1",
            type: DiscordChannelType.PUBLIC_THREAD,
            guild_id: guildId,
            name: "thread1",
            parent_id: null,
            permission_overwrites: [],
          },
          {
            id: "2",
            type: DiscordChannelType.PUBLIC_THREAD,
            guild_id: guildId,
            name: "thread2",
            parent_id: parentChannelId,
            permission_overwrites: [],
          },
        ],
      };
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => thisResponse
      );

      const result = await service.getActiveThreads(guildId, {
        parentChannelId,
      });

      assert.deepStrictEqual(result, [
        {
          id: "2",
          type: DiscordChannelType.PUBLIC_THREAD,
          guild_id: guildId,
          name: "thread2",
          availableTags: [],
          category: null,
        },
      ]);
    });
  });

  describe("getServerProfile", () => {
    const serverId = "server-id";

    it("returns the profile if it exists", async () => {
      const mockProfile = {
        id: serverId,
        dateFormat: "date-format",
        dateLanguage: "date-language",
        timezone: "timezone",
      };
      deps.discordServerProfileRepository.findById.mock.mockImplementation(
        async () => mockProfile
      );

      const profile = await service.getServerProfile(serverId);

      assert.deepStrictEqual(profile, {
        dateFormat: "date-format",
        timezone: "timezone",
        dateLanguage: "date-language",
      });
    });

    it("returns defaults if no profile is found", async () => {
      deps.discordServerProfileRepository.findById.mock.mockImplementation(
        async () => null
      );

      const profile = await service.getServerProfile(serverId);

      assert.deepStrictEqual(profile, {
        dateFormat: "YYYY-MM-DD",
        timezone: "UTC",
        dateLanguage: "en",
      });
    });

    it("returns defaults if only some fields are not found", async () => {
      const mockProfile = {
        id: serverId,
        dateFormat: "date-format",
        dateLanguage: "date-language",
        timezone: undefined,
      };
      deps.discordServerProfileRepository.findById.mock.mockImplementation(
        async () => mockProfile
      );

      const profile = await service.getServerProfile(serverId);

      assert.deepStrictEqual(profile, {
        dateFormat: "date-format",
        timezone: "UTC",
        dateLanguage: "date-language",
      });
    });
  });

  describe("updateServerProfile", () => {
    const serverId = "server-id";

    it("updates dateFormat", async () => {
      const updatedProfile = {
        id: serverId,
        dateFormat: "new-date-format",
        dateLanguage: "date-language",
        timezone: "timezone",
      };
      deps.discordServerProfileRepository.findOneAndUpdate.mock.mockImplementation(
        async () => updatedProfile
      );

      const result = await service.updateServerProfile(serverId, {
        dateFormat: "new-date-format",
      });

      assert.deepStrictEqual(result, {
        dateFormat: "new-date-format",
        timezone: "timezone",
        dateLanguage: "date-language",
      });
    });

    it("updates all the fields", async () => {
      const updatedProfile = {
        id: serverId,
        dateFormat: "new-date-format",
        dateLanguage: "new-date-language",
        timezone: "new-timezone",
      };
      deps.discordServerProfileRepository.findOneAndUpdate.mock.mockImplementation(
        async () => updatedProfile
      );

      const result = await service.updateServerProfile(serverId, {
        dateFormat: "new-date-format",
        timezone: "new-timezone",
        dateLanguage: "new-date-language",
      });

      assert.deepStrictEqual(result, {
        dateFormat: "new-date-format",
        timezone: "new-timezone",
        dateLanguage: "new-date-language",
      });
    });

    it("upserts the fields if necessary", async () => {
      const updatedProfile = {
        id: serverId,
        dateFormat: "new-date-format",
        dateLanguage: "new-date-language",
        timezone: "new-timezone",
      };
      deps.discordServerProfileRepository.findOneAndUpdate.mock.mockImplementation(
        async () => updatedProfile
      );

      const result = await service.updateServerProfile(serverId, {
        dateFormat: "new-date-format",
        timezone: "new-timezone",
        dateLanguage: "new-date-language",
      });

      assert.deepStrictEqual(result, {
        dateFormat: "new-date-format",
        timezone: "new-timezone",
        dateLanguage: "new-date-language",
      });

      const calls = deps.discordServerProfileRepository.findOneAndUpdate.mock.calls;
      assert.strictEqual(calls.length, 1);
    });
  });

  describe("getServerFeeds", () => {
    it("calls the feeds service correctly", async () => {
      const serverId = "server-id";
      const options = { limit: 10, offset: 20 };
      const mockFeeds = [{ id: "feed-1" }];
      deps.feedsService.getServerFeeds.mock.mockImplementation(
        async () => mockFeeds
      );

      const result = await service.getServerFeeds(serverId, options);

      assert.deepStrictEqual(result, mockFeeds);
      const calls = deps.feedsService.getServerFeeds.mock.calls;
      assert.strictEqual(calls.length, 1);
      assert.deepStrictEqual(calls[0].arguments, [serverId, options]);
    });
  });

  describe("countServerFeeds", () => {
    it("calls the feeds service correctly", async () => {
      const serverId = "server-id";
      deps.feedsService.countServerFeeds.mock.mockImplementation(
        async () => 5
      );

      const result = await service.countServerFeeds(serverId);

      assert.strictEqual(result, 5);
      const calls = deps.feedsService.countServerFeeds.mock.calls;
      assert.strictEqual(calls.length, 1);
      assert.deepStrictEqual(calls[0].arguments, [serverId, { search: undefined }]);
    });

    it("calls the feed service with search correctly", async () => {
      const serverId = "server-id";
      const options = { search: "search" };
      deps.feedsService.countServerFeeds.mock.mockImplementation(
        async () => 3
      );

      const result = await service.countServerFeeds(serverId, options);

      assert.strictEqual(result, 3);
      const calls = deps.feedsService.countServerFeeds.mock.calls;
      assert.strictEqual(calls.length, 1);
      assert.deepStrictEqual(calls[0].arguments, [serverId, { search: "search" }]);
    });
  });

  describe("getServer", () => {
    it("returns the guild", async () => {
      const mockGuild = { id: "server-1", name: "Test Server" };
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => mockGuild
      );

      const guild = await service.getServer("server-1");

      assert.deepStrictEqual(guild, mockGuild);
    });

    it("returns null if the bot was forbidden", async () => {
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => {
          throw new DiscordAPIError("Forbidden", 403);
        }
      );

      const guild = await service.getServer("server-1");

      assert.strictEqual(guild, null);
    });

    it("returns null if 404 is returned", async () => {
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => {
          throw new DiscordAPIError("Not Found", 404);
        }
      );

      const guild = await service.getServer("server-1");

      assert.strictEqual(guild, null);
    });

    it("throws for an unhandled error", async () => {
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => {
          throw new Error("Unhandled error");
        }
      );

      await assert.rejects(
        () => service.getServer("server-1"),
        { message: "Unhandled error" }
      );
    });
  });

  describe("getGuild", () => {
    it("returns { exists: true } when guild exists", async () => {
      deps.discordApiService.getGuild.mock.mockImplementation(
        async () => ({ id: "guild-1" })
      );

      const result = await service.getGuild("guild-1");

      assert.deepStrictEqual(result, { exists: true });
    });

    it("returns { exists: false } when 404 from Discord", async () => {
      deps.discordApiService.getGuild.mock.mockImplementation(
        async () => {
          throw new DiscordAPIError("Not Found", 404);
        }
      );

      const result = await service.getGuild("guild-1");

      assert.deepStrictEqual(result, { exists: false });
    });

    it("throws for other errors", async () => {
      deps.discordApiService.getGuild.mock.mockImplementation(
        async () => {
          throw new Error("Some other error");
        }
      );

      await assert.rejects(
        () => service.getGuild("guild-1"),
        { message: "Some other error" }
      );
    });
  });

  describe("getTextChannelsOfServer", () => {
    it("returns channels from Discord with category mapping", async () => {
      const serverId = "server-id";
      const mockChannels = [
        {
          id: "id-1",
          guild_id: serverId,
          permission_overwrites: [],
          name: "channel-1",
          type: DiscordChannelType.GUILD_TEXT,
          parent_id: "id-3",
        },
        {
          id: "id-2",
          name: "channel-2",
          guild_id: serverId,
          permission_overwrites: [],
          type: DiscordChannelType.GUILD_TEXT,
          parent_id: "id-4",
        },
        {
          id: "id-3",
          name: "category1",
          guild_id: serverId,
          permission_overwrites: [],
          type: DiscordChannelType.GUILD_CATEGORY,
          parent_id: "",
        },
        {
          id: "id-4",
          name: "category2",
          guild_id: serverId,
          permission_overwrites: [],
          type: DiscordChannelType.GUILD_CATEGORY,
          parent_id: "",
        },
        {
          id: "id-5",
          name: "channel-3",
          guild_id: serverId,
          permission_overwrites: [],
          type: DiscordChannelType.GUILD_TEXT,
          parent_id: "",
        },
        {
          id: "id-6",
          name: "channel-4",
          guild_id: serverId,
          permission_overwrites: [],
          type: DiscordChannelType.GUILD_ANNOUNCEMENT,
          parent_id: "",
        },
      ];
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => mockChannels
      );

      const channels = await service.getTextChannelsOfServer(serverId);

      assert.deepStrictEqual(channels, [
        {
          id: "id-1",
          guild_id: serverId,
          name: "channel-1",
          type: DiscordChannelType.GUILD_TEXT,
          category: { id: "id-3", name: "category1" },
        },
        {
          id: "id-2",
          name: "channel-2",
          guild_id: serverId,
          type: DiscordChannelType.GUILD_TEXT,
          category: { id: "id-4", name: "category2" },
        },
        {
          id: "id-5",
          name: "channel-3",
          guild_id: serverId,
          type: DiscordChannelType.GUILD_TEXT,
          category: null,
        },
        {
          id: "id-6",
          name: "channel-4",
          guild_id: serverId,
          type: DiscordChannelType.GUILD_ANNOUNCEMENT,
          category: null,
        },
      ]);
    });

    it("throws DiscordServerNotFoundException on 404", async () => {
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => {
          throw new DiscordAPIError("Not Found", 404);
        }
      );

      await assert.rejects(
        () => service.getTextChannelsOfServer("server-id"),
        DiscordServerNotFoundException
      );
    });

    it("throws DiscordServerNotFoundException on 403", async () => {
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => {
          throw new DiscordAPIError("Forbidden", 403);
        }
      );

      await assert.rejects(
        () => service.getTextChannelsOfServer("server-id"),
        DiscordServerNotFoundException
      );
    });

    describe("types option filtering", () => {
      const serverId = "server-id";
      const mockChannels = [
        {
          id: "text-1",
          guild_id: serverId,
          name: "text-channel",
          type: DiscordChannelType.GUILD_TEXT,
          parent_id: null,
          permission_overwrites: [],
        },
        {
          id: "forum-1",
          guild_id: serverId,
          name: "forum-channel",
          type: DiscordChannelType.GUILD_FORUM,
          parent_id: null,
          permission_overwrites: [],
        },
        {
          id: "announcement-1",
          guild_id: serverId,
          name: "announcement-channel",
          type: DiscordChannelType.GUILD_ANNOUNCEMENT,
          parent_id: null,
          permission_overwrites: [],
        },
        {
          id: "voice-1",
          guild_id: serverId,
          name: "voice-channel",
          type: DiscordChannelType.GUILD_VOICE,
          parent_id: null,
          permission_overwrites: [],
        },
      ];

      it("returns all channel types when types includes '*'", async () => {
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["*"],
        });

        assert.strictEqual(channels.length, 4);
        const ids = channels.map((c) => c.id);
        assert.ok(ids.includes("text-1"));
        assert.ok(ids.includes("forum-1"));
        assert.ok(ids.includes("announcement-1"));
        assert.ok(ids.includes("voice-1"));
      });

      it("returns only forum channels when types includes 'forum'", async () => {
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["forum"],
        });

        assert.strictEqual(channels.length, 1);
        assert.strictEqual(channels[0].id, "forum-1");
        assert.strictEqual(channels[0].type, DiscordChannelType.GUILD_FORUM);
      });

      it("returns only text channels when types includes 'text'", async () => {
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["text"],
        });

        assert.strictEqual(channels.length, 1);
        assert.strictEqual(channels[0].id, "text-1");
        assert.strictEqual(channels[0].type, DiscordChannelType.GUILD_TEXT);
      });

      it("returns only announcement channels when types includes 'announcement'", async () => {
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["announcement"],
        });

        assert.strictEqual(channels.length, 1);
        assert.strictEqual(channels[0].id, "announcement-1");
        assert.strictEqual(channels[0].type, DiscordChannelType.GUILD_ANNOUNCEMENT);
      });

      it("returns multiple types when specified", async () => {
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["text", "forum"],
        });

        assert.strictEqual(channels.length, 2);
        const ids = channels.map((c) => c.id);
        assert.ok(ids.includes("text-1"));
        assert.ok(ids.includes("forum-1"));
      });

      it("returns text and announcement by default when no types specified", async () => {
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId);

        assert.strictEqual(channels.length, 2);
        const ids = channels.map((c) => c.id);
        assert.ok(ids.includes("text-1"));
        assert.ok(ids.includes("announcement-1"));
        assert.ok(!ids.includes("forum-1"));
        assert.ok(!ids.includes("voice-1"));
      });
    });

    describe("available_tags processing", () => {
      const serverId = "server-id";

      it("formats available_tags with permission info for non-moderated tags", async () => {
        const mockChannels = [
          {
            id: "forum-1",
            guild_id: serverId,
            name: "forum-channel",
            type: DiscordChannelType.GUILD_FORUM,
            parent_id: null,
            permission_overwrites: [],
            available_tags: [
              { id: "tag-1", name: "Tag One", moderated: false, emoji_id: null, emoji_name: "🔥" },
              { id: "tag-2", name: "Tag Two", moderated: false, emoji_id: "123", emoji_name: null },
            ],
          },
        ];
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["forum"],
        });

        assert.strictEqual(channels.length, 1);
        assert.ok(channels[0].availableTags);
        assert.strictEqual(channels[0].availableTags!.length, 2);
        assert.deepStrictEqual(channels[0].availableTags![0], {
          id: "tag-1",
          name: "Tag One",
          emojiId: null,
          emojiName: "🔥",
          hasPermissionToUse: true,
        });
        assert.deepStrictEqual(channels[0].availableTags![1], {
          id: "tag-2",
          name: "Tag Two",
          emojiId: "123",
          emojiName: null,
          hasPermissionToUse: true,
        });
      });

      it("checks MANAGE_THREADS permission for moderated tags", async () => {
        const mockChannels = [
          {
            id: "forum-1",
            guild_id: serverId,
            name: "forum-channel",
            type: DiscordChannelType.GUILD_FORUM,
            parent_id: null,
            permission_overwrites: [],
            available_tags: [
              { id: "tag-1", name: "Moderated Tag", moderated: true, emoji_id: null, emoji_name: null },
              { id: "tag-2", name: "Normal Tag", moderated: false, emoji_id: null, emoji_name: null },
            ],
          },
        ];
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );
        deps.discordPermissionsService.botHasPermissionInServer.mock.mockImplementation(
          async () => true
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["forum"],
        });

        const permCalls = deps.discordPermissionsService.botHasPermissionInServer.mock.calls;
        assert.strictEqual(permCalls.length, 1);
        assert.strictEqual(permCalls[0].arguments[0], serverId);

        assert.ok(channels[0].availableTags);
        const moderatedTag = channels[0].availableTags!.find((t) => t.name === "Moderated Tag");
        const normalTag = channels[0].availableTags!.find((t) => t.name === "Normal Tag");
        assert.strictEqual(moderatedTag!.hasPermissionToUse, true);
        assert.strictEqual(normalTag!.hasPermissionToUse, true);
      });

      it("sets hasPermissionToUse false for moderated tags when bot lacks MANAGE_THREADS", async () => {
        const mockChannels = [
          {
            id: "forum-1",
            guild_id: serverId,
            name: "forum-channel",
            type: DiscordChannelType.GUILD_FORUM,
            parent_id: null,
            permission_overwrites: [],
            available_tags: [
              { id: "tag-1", name: "Moderated Tag", moderated: true, emoji_id: null, emoji_name: null },
              { id: "tag-2", name: "Normal Tag", moderated: false, emoji_id: null, emoji_name: null },
            ],
          },
        ];
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );
        deps.discordPermissionsService.botHasPermissionInServer.mock.mockImplementation(
          async () => false
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["forum"],
        });

        assert.ok(channels[0].availableTags);
        const moderatedTag = channels[0].availableTags!.find((t) => t.name === "Moderated Tag");
        const normalTag = channels[0].availableTags!.find((t) => t.name === "Normal Tag");
        assert.strictEqual(moderatedTag!.hasPermissionToUse, false);
        assert.strictEqual(normalTag!.hasPermissionToUse, true);
      });

      it("sorts tags alphabetically by name", async () => {
        const mockChannels = [
          {
            id: "forum-1",
            guild_id: serverId,
            name: "forum-channel",
            type: DiscordChannelType.GUILD_FORUM,
            parent_id: null,
            permission_overwrites: [],
            available_tags: [
              { id: "tag-c", name: "Zebra", moderated: false, emoji_id: null, emoji_name: null },
              { id: "tag-a", name: "Apple", moderated: false, emoji_id: null, emoji_name: null },
              { id: "tag-b", name: "Banana", moderated: false, emoji_id: null, emoji_name: null },
            ],
          },
        ];
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        const channels = await service.getTextChannelsOfServer(serverId, {
          types: ["forum"],
        });

        assert.ok(channels[0].availableTags);
        assert.strictEqual(channels[0].availableTags![0].name, "Apple");
        assert.strictEqual(channels[0].availableTags![1].name, "Banana");
        assert.strictEqual(channels[0].availableTags![2].name, "Zebra");
      });

      it("does not check permissions when no moderated tags exist", async () => {
        const mockChannels = [
          {
            id: "forum-1",
            guild_id: serverId,
            name: "forum-channel",
            type: DiscordChannelType.GUILD_FORUM,
            parent_id: null,
            permission_overwrites: [],
            available_tags: [
              { id: "tag-1", name: "Tag One", moderated: false, emoji_id: null, emoji_name: null },
            ],
          },
        ];
        deps.discordApiService.executeBotRequest.mock.mockImplementation(
          async () => mockChannels
        );

        await service.getTextChannelsOfServer(serverId, { types: ["forum"] });

        const permCalls = deps.discordPermissionsService.botHasPermissionInServer.mock.calls;
        assert.strictEqual(permCalls.length, 0);
      });
    });
  });

  describe("getRolesOfServer", () => {
    it("returns the roles from Discord", async () => {
      const serverId = "server-id";
      const mockRoles = [
        { id: "id-1", name: "role-1" },
        { id: "id-2", name: "role-2" },
      ];
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => mockRoles
      );

      const roles = await service.getRolesOfServer(serverId);

      assert.deepStrictEqual(roles, mockRoles);
    });
  });

  describe("searchMembersOfServer", () => {
    it("returns members from Discord search API", async () => {
      const serverId = "server-id";
      const mockMembers = [
        { user: { id: "user-1", username: "User1" }, roles: [] },
        { user: { id: "user-2", username: "User2" }, roles: [] },
      ];
      deps.discordApiService.executeBotRequest.mock.mockImplementation(
        async () => mockMembers
      );

      const members = await service.searchMembersOfServer(serverId, {
        search: "User",
        limit: 10,
      });

      assert.deepStrictEqual(members, mockMembers);
    });
  });

  describe("getMemberOfServer", () => {
    it("returns member when found", async () => {
      const mockMember = { user: { id: "user-1", username: "User1" }, roles: [] };
      deps.discordApiService.getGuildMember.mock.mockImplementation(
        async () => mockMember
      );

      const member = await service.getMemberOfServer("server-1", "user-1");

      assert.deepStrictEqual(member, mockMember);
    });

    it("returns null on 404", async () => {
      deps.discordApiService.getGuildMember.mock.mockImplementation(
        async () => {
          throw new DiscordAPIError("Not Found", 404);
        }
      );

      const member = await service.getMemberOfServer("server-1", "user-1");

      assert.strictEqual(member, null);
    });

    it("returns null on 403", async () => {
      deps.discordApiService.getGuildMember.mock.mockImplementation(
        async () => {
          throw new DiscordAPIError("Forbidden", 403);
        }
      );

      const member = await service.getMemberOfServer("server-1", "user-1");

      assert.strictEqual(member, null);
    });

    it("throws for other errors", async () => {
      deps.discordApiService.getGuildMember.mock.mockImplementation(
        async () => {
          throw new Error("Network error");
        }
      );

      await assert.rejects(
        () => service.getMemberOfServer("server-1", "user-1"),
        { message: "Network error" }
      );
    });
  });
});
