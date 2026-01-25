import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { DiscordPermissionsService } from "../../src/services/discord-permissions/discord-permissions.service";
import {
  ADMINISTRATOR,
  MANAGE_CHANNEL,
  VIEW_CHANNEL,
} from "../../src/shared/constants/discord-permissions";
import type { Config } from "../../src/config";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";

describe("DiscordPermissionsService", { concurrency: true }, () => {
  const botUserId = "bot-user-123";
  const mockConfig = {
    BACKEND_API_DISCORD_CLIENT_ID: botUserId,
  } as Config;

  const createMockDiscordApiService = (overrides: Record<string, unknown> = {}) => ({
    getGuild: mock.fn(),
    getGuildMember: mock.fn(),
    ...overrides,
  }) as unknown as DiscordApiService;

  describe("computeBasePermissions", () => {
    let service: DiscordPermissionsService;

    beforeEach(() => {
      service = new DiscordPermissionsService(mockConfig, createMockDiscordApiService());
    });

    it("returns ADMINISTRATOR when user is guild owner", () => {
      const guildMember = { roles: [], user: { id: "owner-123" } };
      const guild = {
        id: "guild-123",
        owner_id: "owner-123",
        roles: [{ id: "guild-123", permissions: "0" }],
      };

      const result = service.computeBasePermissions(guildMember, guild);

      assert.strictEqual(result, ADMINISTRATOR);
    });

    it("returns ADMINISTRATOR when everyone role has ADMINISTRATOR", () => {
      const guildMember = { roles: [], user: { id: "user-123" } };
      const guild = {
        id: "guild-123",
        owner_id: "other-owner",
        roles: [{ id: "guild-123", permissions: ADMINISTRATOR.toString() }],
      };

      const result = service.computeBasePermissions(guildMember, guild);

      assert.strictEqual(result, ADMINISTRATOR);
    });

    it("combines permissions from all member roles", () => {
      const guildMember = { roles: ["role-1", "role-2"], user: { id: "user-123" } };
      const guild = {
        id: "guild-123",
        owner_id: "other-owner",
        roles: [
          { id: "guild-123", permissions: "0" },
          { id: "role-1", permissions: VIEW_CHANNEL.toString() },
          { id: "role-2", permissions: MANAGE_CHANNEL.toString() },
        ],
      };

      const result = service.computeBasePermissions(guildMember, guild);

      assert.strictEqual((result & VIEW_CHANNEL) === VIEW_CHANNEL, true);
      assert.strictEqual((result & MANAGE_CHANNEL) === MANAGE_CHANNEL, true);
    });
  });

  describe("computeOverwritePermissions", () => {
    let service: DiscordPermissionsService;

    beforeEach(() => {
      service = new DiscordPermissionsService(mockConfig, createMockDiscordApiService());
    });

    it("returns ADMINISTRATOR when base permissions include ADMINISTRATOR", () => {
      const member = { roles: [], user: { id: "user-123" } };
      const channel = { guild_id: "guild-123", permission_overwrites: [] };

      const result = service.computeOverwritePermissions(ADMINISTRATOR, member, channel);

      assert.strictEqual(result, ADMINISTRATOR);
    });

    it("applies everyone role overwrites", () => {
      const basePermissions = VIEW_CHANNEL | MANAGE_CHANNEL;
      const member = { roles: [], user: { id: "user-123" } };
      const channel = {
        guild_id: "guild-123",
        permission_overwrites: [
          { id: "guild-123", allow: "0", deny: MANAGE_CHANNEL.toString() },
        ],
      };

      const result = service.computeOverwritePermissions(basePermissions, member, channel);

      assert.strictEqual((result & VIEW_CHANNEL) === VIEW_CHANNEL, true);
      assert.strictEqual((result & MANAGE_CHANNEL) === MANAGE_CHANNEL, false);
    });

    it("applies role-specific overwrites after everyone", () => {
      const basePermissions = VIEW_CHANNEL;
      const member = { roles: ["role-1"], user: { id: "user-123" } };
      const channel = {
        guild_id: "guild-123",
        permission_overwrites: [
          { id: "guild-123", allow: "0", deny: VIEW_CHANNEL.toString() },
          { id: "role-1", allow: VIEW_CHANNEL.toString(), deny: "0" },
        ],
      };

      const result = service.computeOverwritePermissions(basePermissions, member, channel);

      assert.strictEqual((result & VIEW_CHANNEL) === VIEW_CHANNEL, true);
    });

    it("applies member-specific overwrites last", () => {
      const basePermissions = VIEW_CHANNEL;
      const member = { roles: ["role-1"], user: { id: "user-123" } };
      const channel = {
        guild_id: "guild-123",
        permission_overwrites: [
          { id: "role-1", allow: "0", deny: VIEW_CHANNEL.toString() },
          { id: "user-123", allow: VIEW_CHANNEL.toString(), deny: "0" },
        ],
      };

      const result = service.computeOverwritePermissions(basePermissions, member, channel);

      assert.strictEqual((result & VIEW_CHANNEL) === VIEW_CHANNEL, true);
    });
  });

  describe("computedPermissionsHasPermissions", () => {
    let service: DiscordPermissionsService;

    beforeEach(() => {
      service = new DiscordPermissionsService(mockConfig, createMockDiscordApiService());
    });

    it("returns true when user has ADMINISTRATOR", () => {
      const result = service.computedPermissionsHasPermissions(ADMINISTRATOR, [VIEW_CHANNEL, MANAGE_CHANNEL]);

      assert.strictEqual(result, true);
    });

    it("returns true when user has all required permissions", () => {
      const permissions = VIEW_CHANNEL | MANAGE_CHANNEL;

      const result = service.computedPermissionsHasPermissions(permissions, [VIEW_CHANNEL, MANAGE_CHANNEL]);

      assert.strictEqual(result, true);
    });

    it("returns false when user is missing some permissions", () => {
      const permissions = VIEW_CHANNEL;

      const result = service.computedPermissionsHasPermissions(permissions, [VIEW_CHANNEL, MANAGE_CHANNEL]);

      assert.strictEqual(result, false);
    });
  });

  describe("botHasPermissionInServer", () => {
    it("returns true when bot has all required permissions", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        getGuild: mock.fn(() =>
          Promise.resolve({
            id: "guild-123",
            name: "Test Guild",
            icon: "icon-hash",
            owner_id: "owner-123",
            roles: [{ id: "guild-123", name: "@everyone", permissions: (VIEW_CHANNEL | MANAGE_CHANNEL).toString(), position: 0, color: 0, hoist: false, mentionable: false }],
          })
        ),
        getGuildMember: mock.fn(() =>
          Promise.resolve({ roles: [], user: { id: botUserId, username: "bot" } })
        ),
      });
      const service = new DiscordPermissionsService(mockConfig, mockDiscordApiService);

      const result = await service.botHasPermissionInServer("guild-123", [VIEW_CHANNEL]);

      assert.strictEqual(result, true);
    });

    it("returns true when bot is administrator", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        getGuild: mock.fn(() =>
          Promise.resolve({
            id: "guild-123",
            name: "Test Guild",
            icon: "icon-hash",
            owner_id: "owner-123",
            roles: [{ id: "guild-123", name: "@everyone", permissions: ADMINISTRATOR.toString(), position: 0, color: 0, hoist: false, mentionable: false }],
          })
        ),
        getGuildMember: mock.fn(() =>
          Promise.resolve({ roles: [], user: { id: botUserId, username: "bot" } })
        ),
      });
      const service = new DiscordPermissionsService(mockConfig, mockDiscordApiService);

      const result = await service.botHasPermissionInServer("guild-123", [VIEW_CHANNEL, MANAGE_CHANNEL]);

      assert.strictEqual(result, true);
    });

    it("returns false when bot lacks required permissions", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        getGuild: mock.fn(() =>
          Promise.resolve({
            id: "guild-123",
            name: "Test Guild",
            icon: "icon-hash",
            owner_id: "owner-123",
            roles: [{ id: "guild-123", name: "@everyone", permissions: VIEW_CHANNEL.toString(), position: 0, color: 0, hoist: false, mentionable: false }],
          })
        ),
        getGuildMember: mock.fn(() =>
          Promise.resolve({ roles: [], user: { id: botUserId, username: "bot" } })
        ),
      });
      const service = new DiscordPermissionsService(mockConfig, mockDiscordApiService);

      const result = await service.botHasPermissionInServer("guild-123", [VIEW_CHANNEL, MANAGE_CHANNEL]);

      assert.strictEqual(result, false);
    });
  });
});
