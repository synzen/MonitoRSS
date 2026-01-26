import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { FeedsService } from "../../src/services/feeds/feeds.service";
import type { IFeedRepository, IFeedWithFailRecord } from "../../src/repositories/interfaces/feed.types";
import type { IBannedFeedRepository } from "../../src/repositories/interfaces/banned-feed.types";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";
import type { DiscordAuthService } from "../../src/services/discord-auth/discord-auth.service";
import type { DiscordPermissionsService } from "../../src/services/discord-permissions/discord-permissions.service";
import type { FeedSchedulingService } from "../../src/services/feed-scheduling/feed-scheduling.service";
import { DiscordAPIError } from "../../src/shared/exceptions/discord-api.error";
import {
  MissingChannelException,
  MissingChannelPermissionsException,
  UserMissingManageGuildException,
} from "../../src/shared/exceptions/feeds.exceptions";
import { DiscordChannelType } from "../../src/shared/types/discord.types";
import { FeedStatus } from "../../src/services/feeds/types";

describe("FeedsService", { concurrency: true }, () => {
  describe("canUseChannel", () => {
    it("throws MissingChannelException when channel is not found", async () => {
      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {
          getChannel: async () => {
            throw new DiscordAPIError("Not Found", 404);
          },
        } as unknown as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      await assert.rejects(
        () => service.canUseChannel({ channelId: "channel-1", userAccessToken: "token" }),
        MissingChannelException
      );
    });

    it("throws MissingChannelPermissionsException when channel is forbidden", async () => {
      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {
          getChannel: async () => {
            throw new DiscordAPIError("Forbidden", 403);
          },
        } as unknown as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      await assert.rejects(
        () => service.canUseChannel({ channelId: "channel-1", userAccessToken: "token" }),
        MissingChannelPermissionsException
      );
    });

    it("throws UserMissingManageGuildException when user does not manage guild", async () => {
      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {
          getChannel: async () => ({
            id: "channel-1",
            name: "test-channel",
            guild_id: "guild-1",
            type: DiscordChannelType.GUILD_TEXT,
            permission_overwrites: [],
            parent_id: null,
          }),
        } as unknown as DiscordApiService,
        discordAuthService: {
          userManagesGuild: async () => ({ isManager: false }),
        } as unknown as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      await assert.rejects(
        () => service.canUseChannel({ channelId: "channel-1", userAccessToken: "token" }),
        UserMissingManageGuildException
      );
    });

    it("returns channel for PUBLIC_THREAD without checking bot permissions", async () => {
      let botPermissionCalled = false;

      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {
          getChannel: async () => ({
            id: "channel-1",
            name: "test-thread",
            guild_id: "guild-1",
            type: DiscordChannelType.PUBLIC_THREAD,
            permission_overwrites: [],
            parent_id: "parent-1",
          }),
        } as unknown as DiscordApiService,
        discordAuthService: {
          userManagesGuild: async () => ({ isManager: true }),
        } as unknown as DiscordAuthService,
        discordPermissionsService: {
          botHasPermissionInChannel: async () => {
            botPermissionCalled = true;
            return true;
          },
        } as unknown as DiscordPermissionsService,
      });

      const channel = await service.canUseChannel({
        channelId: "channel-1",
        userAccessToken: "token",
      });

      assert.strictEqual(channel.type, DiscordChannelType.PUBLIC_THREAD);
      assert.strictEqual(botPermissionCalled, false);
    });

    it("throws MissingChannelPermissionsException when bot lacks permissions", async () => {
      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {
          getChannel: async () => ({
            id: "channel-1",
            name: "test-channel",
            guild_id: "guild-1",
            type: DiscordChannelType.GUILD_TEXT,
            permission_overwrites: [{ id: "role-1", type: "role", allow: "0", deny: "0" }],
            parent_id: null,
          }),
        } as unknown as DiscordApiService,
        discordAuthService: {
          userManagesGuild: async () => ({ isManager: true }),
        } as unknown as DiscordAuthService,
        discordPermissionsService: {
          botHasPermissionInChannel: async () => false,
        } as unknown as DiscordPermissionsService,
      });

      await assert.rejects(
        () => service.canUseChannel({ channelId: "channel-1", userAccessToken: "token" }),
        MissingChannelPermissionsException
      );
    });

    it("returns channel when all checks pass", async () => {
      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {
          getChannel: async () => ({
            id: "channel-1",
            name: "test-channel",
            guild_id: "guild-1",
            type: DiscordChannelType.GUILD_TEXT,
            permission_overwrites: [{ id: "role-1", type: "role", allow: "0", deny: "0" }],
            parent_id: null,
          }),
        } as unknown as DiscordApiService,
        discordAuthService: {
          userManagesGuild: async () => ({ isManager: true }),
        } as unknown as DiscordAuthService,
        discordPermissionsService: {
          botHasPermissionInChannel: async () => true,
        } as unknown as DiscordPermissionsService,
      });

      const channel = await service.canUseChannel({
        channelId: "channel-1",
        userAccessToken: "token",
      });

      assert.strictEqual(channel.id, "channel-1");
    });
  });

  describe("getServerFeeds", () => {
    it("passes correct skip and limit to repository", async () => {
      let calledOptions: { guildId: string; search?: string; skip: number; limit: number } | undefined;

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async (opts) => {
            calledOptions = opts;
            return [];
          },
          countByGuild: async () => 0,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {
          getRefreshRatesOfFeeds: async () => [],
        } as unknown as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      await service.getServerFeeds("guild-1", { limit: 10, offset: 5, search: "test" });

      assert.strictEqual(calledOptions?.guildId, "guild-1");
      assert.strictEqual(calledOptions?.skip, 5);
      assert.strictEqual(calledOptions?.limit, 10);
      assert.strictEqual(calledOptions?.search, "test");
    });

    it("returns feeds with correct status calculation", async () => {
      const mockFeeds: IFeedWithFailRecord[] = [
        {
          id: "feed-1",
          title: "Feed 1",
          url: "https://example.com/feed1",
          guild: "guild-1",
          channel: "channel-1",
          embeds: [],
          addedAt: new Date("2022-01-01"),
        },
      ];

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => mockFeeds,
          countByGuild: async () => 0,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {
          getRefreshRatesOfFeeds: async () => [15],
        } as unknown as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const feeds = await service.getServerFeeds("guild-1", { limit: 10, offset: 0 });

      assert.strictEqual(feeds.length, 1);
      assert.strictEqual(feeds[0]!.status, FeedStatus.OK);
      assert.strictEqual(feeds[0]!.refreshRateSeconds, 15);
    });

    it("returns DISABLED status when feed is disabled", async () => {
      const mockFeeds: IFeedWithFailRecord[] = [
        {
          id: "feed-1",
          title: "Feed 1",
          url: "https://example.com/feed1",
          guild: "guild-1",
          channel: "channel-1",
          embeds: [],
          addedAt: new Date("2022-01-01"),
          disabled: "MANUAL",
        },
      ];

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => mockFeeds,
          countByGuild: async () => 0,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {
          getRefreshRatesOfFeeds: async () => [15],
        } as unknown as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const feeds = await service.getServerFeeds("guild-1", { limit: 10, offset: 0 });

      assert.strictEqual(feeds[0]!.status, FeedStatus.DISABLED);
    });

    it("returns CONVERTED_TO_USER status when disabled is CONVERTED_USER_FEED", async () => {
      const mockFeeds: IFeedWithFailRecord[] = [
        {
          id: "feed-1",
          title: "Feed 1",
          url: "https://example.com/feed1",
          guild: "guild-1",
          channel: "channel-1",
          embeds: [],
          addedAt: new Date("2022-01-01"),
          disabled: "CONVERTED_USER_FEED",
        },
      ];

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => mockFeeds,
          countByGuild: async () => 0,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {
          getRefreshRatesOfFeeds: async () => [15],
        } as unknown as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const feeds = await service.getServerFeeds("guild-1", { limit: 10, offset: 0 });

      assert.strictEqual(feeds[0]!.status, FeedStatus.CONVERTED_TO_USER);
    });

    it("transforms DISABLED_FOR_PERSONAL_ROLLOUT to descriptive message", async () => {
      const mockFeeds: IFeedWithFailRecord[] = [
        {
          id: "feed-1",
          title: "Feed 1",
          url: "https://example.com/feed1",
          guild: "guild-1",
          channel: "channel-1",
          embeds: [],
          addedAt: new Date("2022-01-01"),
          disabled: "DISABLED_FOR_PERSONAL_ROLLOUT",
        },
      ];

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => mockFeeds,
          countByGuild: async () => 0,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {
          getRefreshRatesOfFeeds: async () => [15],
        } as unknown as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const feeds = await service.getServerFeeds("guild-1", { limit: 10, offset: 0 });

      assert.strictEqual(feeds[0]!.status, FeedStatus.DISABLED);
      assert.strictEqual(
        feeds[0]!.disabledReason,
        "Deprecated for personal feeds. Must convert to personal feed to restore function."
      );
    });

    it("returns FAILING status when failRecord exists but is less than 18 hours old", async () => {
      const recentFailedAt = new Date();
      recentFailedAt.setHours(recentFailedAt.getHours() - 5);

      const mockFeeds: IFeedWithFailRecord[] = [
        {
          id: "feed-1",
          title: "Feed 1",
          url: "https://example.com/feed1",
          guild: "guild-1",
          channel: "channel-1",
          embeds: [],
          addedAt: new Date("2022-01-01"),
          failRecord: {
            id: "fail-1",
            reason: "Connection timeout",
            failedAt: recentFailedAt,
            alerted: false,
          },
        },
      ];

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => mockFeeds,
          countByGuild: async () => 0,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {
          getRefreshRatesOfFeeds: async () => [15],
        } as unknown as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const feeds = await service.getServerFeeds("guild-1", { limit: 10, offset: 0 });

      assert.strictEqual(feeds[0]!.status, FeedStatus.FAILING);
      assert.strictEqual(feeds[0]!.failReason, "Connection timeout");
    });

    it("returns FAILED status when failRecord is older than 18 hours", async () => {
      const oldFailedAt = new Date();
      oldFailedAt.setHours(oldFailedAt.getHours() - 20);

      const mockFeeds: IFeedWithFailRecord[] = [
        {
          id: "feed-1",
          title: "Feed 1",
          url: "https://example.com/feed1",
          guild: "guild-1",
          channel: "channel-1",
          embeds: [],
          addedAt: new Date("2022-01-01"),
          failRecord: {
            id: "fail-1",
            reason: "Feed permanently unavailable",
            failedAt: oldFailedAt,
            alerted: true,
          },
        },
      ];

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => mockFeeds,
          countByGuild: async () => 0,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {
          getRefreshRatesOfFeeds: async () => [15],
        } as unknown as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const feeds = await service.getServerFeeds("guild-1", { limit: 10, offset: 0 });

      assert.strictEqual(feeds[0]!.status, FeedStatus.FAILED);
      assert.strictEqual(feeds[0]!.failReason, "Feed permanently unavailable");
    });
  });

  describe("countServerFeeds", () => {
    it("returns correct count", async () => {
      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => [],
          countByGuild: async () => 5,
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const count = await service.countServerFeeds("guild-1");

      assert.strictEqual(count, 5);
    });

    it("passes search parameter to repository", async () => {
      let calledSearch: string | undefined;

      const service = new FeedsService({
        feedRepository: {
          aggregateWithFailRecords: async () => [],
          countByGuild: async (_guildId: string, search?: string) => {
            calledSearch = search;
            return 2;
          },
        },
        bannedFeedRepository: {} as IBannedFeedRepository,
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const count = await service.countServerFeeds("guild-1", { search: "test" });

      assert.strictEqual(count, 2);
      assert.strictEqual(calledSearch, "test");
    });
  });

  describe("getBannedFeedDetails", () => {
    it("returns null when feed is not banned", async () => {
      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {
          findByUrlForGuild: async () => null,
        },
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const result = await service.getBannedFeedDetails("https://example.com", "guild-1");

      assert.strictEqual(result, null);
    });

    it("returns banned feed when found", async () => {
      const bannedFeed = {
        id: "banned-1",
        url: "https://example.com",
        reason: "spam",
        guildIds: ["guild-1"],
      };

      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {
          findByUrlForGuild: async () => bannedFeed,
        },
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      const result = await service.getBannedFeedDetails("https://example.com", "guild-1");

      assert.deepStrictEqual(result, bannedFeed);
    });

    it("passes correct url and guildId to repository", async () => {
      let calledUrl: string | undefined;
      let calledGuildId: string | undefined;

      const service = new FeedsService({
        feedRepository: {} as IFeedRepository,
        bannedFeedRepository: {
          findByUrlForGuild: async (url: string, guildId: string) => {
            calledUrl = url;
            calledGuildId = guildId;
            return null;
          },
        },
        feedSchedulingService: {} as FeedSchedulingService,
        discordApiService: {} as DiscordApiService,
        discordAuthService: {} as DiscordAuthService,
        discordPermissionsService: {} as DiscordPermissionsService,
      });

      await service.getBannedFeedDetails("https://reddit.com/r/test", "guild-456");

      assert.strictEqual(calledUrl, "https://reddit.com/r/test");
      assert.strictEqual(calledGuildId, "guild-456");
    });
  });
});
