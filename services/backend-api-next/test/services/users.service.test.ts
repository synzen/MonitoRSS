import { describe, it } from "node:test";
import assert from "node:assert";
import { createUsersHarness } from "../helpers/users.harness";
import { UsersService } from "../../src/services/users/users.service";
import { SubscriptionStatus } from "../../src/repositories/shared/enums";
import type { Config } from "../../src/config";
import type { IUserRepository } from "../../src/repositories/interfaces/user.types";
import type { IUserFeedRepository } from "../../src/repositories/interfaces/user-feed.types";
import type { ISupporterRepository } from "../../src/repositories/interfaces/supporter.types";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import type { PaddleService } from "../../src/services/paddle/paddle.service";

describe("UsersService", { concurrency: true }, () => {
  const harness = createUsersHarness();

  describe("initDiscordUser", { concurrency: true }, () => {
    it("creates a new user if not found", async () => {
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(null),
        },
      });

      await ctx.service.initDiscordUser("discord-user-id", { email: "test@test.com" });

      assert.strictEqual(ctx.userRepository.create.mock.calls.length, 1);
      assert.deepStrictEqual(ctx.userRepository.create.mock.calls[0]?.arguments[0], {
        discordUserId: "discord-user-id",
        email: "test@test.com",
      });
    });

    it("returns existing user if found and no email update needed", async () => {
      const existingUser = { ...harness.createContext().defaultUser, email: "test@test.com" };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
        },
      });

      const result = await ctx.service.initDiscordUser("discord-user-id", {
        email: "test@test.com",
      });

      assert.strictEqual(ctx.userRepository.create.mock.calls.length, 0);
      assert.deepStrictEqual(result, existingUser);
    });

    it("updates email if different from existing", async () => {
      const defaultUser = harness.createContext().defaultUser;
      const existingUser = { ...defaultUser, email: "old@test.com" };
      const updatedUser = { ...defaultUser, email: "new@test.com" };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
          updateEmailByDiscordId: () => Promise.resolve(updatedUser),
        },
      });

      await ctx.service.initDiscordUser("discord-user-id", { email: "new@test.com" });

      assert.strictEqual(ctx.userRepository.updateEmailByDiscordId.mock.calls.length, 1);
    });

    it("syncs email with Paddle when email changes and user has paddle customer", async () => {
      const defaultUser = harness.createContext().defaultUser;
      const existingUser = { ...defaultUser, email: "old@test.com" };
      const updatedUser = { ...defaultUser, email: "new@test.com" };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
          updateEmailByDiscordId: () => Promise.resolve(updatedUser),
        },
        supporterRepository: {
          findById: () => Promise.resolve({
            paddleCustomer: { customerId: "paddle-cust-123" },
          }),
        },
      });

      await ctx.service.initDiscordUser("discord-user-id", { email: "new@test.com" });

      assert.strictEqual(ctx.paddleService.updateCustomer.mock.calls.length, 1);
      assert.strictEqual(
        ctx.paddleService.updateCustomer.mock.calls[0]?.arguments[0],
        "paddle-cust-123"
      );
      assert.deepStrictEqual(
        ctx.paddleService.updateCustomer.mock.calls[0]?.arguments[1],
        { email: "new@test.com" }
      );
    });

    it("does not throw when Paddle update fails", async () => {
      const defaultUser = harness.createContext().defaultUser;
      const existingUser = { ...defaultUser, email: "old@test.com" };
      const updatedUser = { ...defaultUser, email: "new@test.com" };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
          updateEmailByDiscordId: () => Promise.resolve(updatedUser),
        },
        supporterRepository: {
          findById: () => Promise.resolve({
            paddleCustomer: { customerId: "paddle-cust-123" },
          }),
        },
        paddleService: {
          updateCustomer: () => Promise.reject(new Error("Paddle API error")),
        },
      });

      await assert.doesNotReject(async () => {
        await ctx.service.initDiscordUser("discord-user-id", { email: "new@test.com" });
      });
    });
  });

  describe("getOrCreateUserByDiscordId", { concurrency: true }, () => {
    it("returns existing user if found", async () => {
      const existingUser = { ...harness.createContext().defaultUser };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
        },
      });

      const result = await ctx.service.getOrCreateUserByDiscordId("discord-user-id");

      assert.deepStrictEqual(result, existingUser);
      assert.strictEqual(ctx.userRepository.create.mock.calls.length, 0);
    });

    it("creates new user if not found", async () => {
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(null),
        },
      });

      await ctx.service.getOrCreateUserByDiscordId("discord-user-id");

      assert.strictEqual(ctx.userRepository.create.mock.calls.length, 1);
    });
  });

  describe("getIdByDiscordId", { concurrency: true }, () => {
    it("returns the user ID if found", async () => {
      const ctx = harness.createContext({
        userRepository: {
          findIdByDiscordId: () => Promise.resolve("user-id-123"),
        },
      });

      const result = await ctx.service.getIdByDiscordId("discord-user-id");

      assert.strictEqual(result, "user-id-123");
    });

    it("returns null if not found", async () => {
      const ctx = harness.createContext({
        userRepository: {
          findIdByDiscordId: () => Promise.resolve(null),
        },
      });

      const result = await ctx.service.getIdByDiscordId("discord-user-id");

      assert.strictEqual(result, null);
    });
  });

  describe("getByDiscordId", { concurrency: true }, () => {
    it("returns user with free subscription when no email", async () => {
      const existingUser = { ...harness.createContext().defaultUser };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
        },
      });

      const result = await ctx.service.getByDiscordId("discord-user-id");

      assert.ok(result);
      assert.strictEqual(result.user.discordUserId, "discord-user-id");
      assert.strictEqual(result.subscription.product.key, "free");
      assert.strictEqual(result.subscription.status, SubscriptionStatus.Active);
      assert.strictEqual(result.creditBalance.availableFormatted, "0");
    });

    it("returns subscription details when user has active subscription", async () => {
      const existingUser = { ...harness.createContext().defaultUser, email: "test@test.com" };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
        },
        supportersService: {
          getSupporterSubscription: () => Promise.resolve({
            customer: { id: "cust-id", currencyCode: "USD" },
            subscription: {
              id: "sub-id",
              product: { key: "tier1" },
              status: SubscriptionStatus.Active,
              billingInterval: "month",
              billingPeriod: {
                start: new Date(),
                end: new Date(),
              },
              updatedAt: new Date(),
              addons: [],
            },
          }),
        },
        paddleService: {
          getCustomerCreditBalanace: () => Promise.resolve({ data: [] }),
        },
      });

      const result = await ctx.service.getByDiscordId("discord-user-id");

      assert.ok(result);
      assert.strictEqual(result.subscription.product.key, "tier1");
      assert.strictEqual(result.subscription.product.name, "Tier 1");
      assert.strictEqual(result.subscription.status, SubscriptionStatus.Active);
    });
  });

  describe("getEmailsForAlerts", { concurrency: true }, () => {
    it("returns emails from repository", async () => {
      const emails = ["test1@test.com", "test2@test.com"];
      const ctx = harness.createContext({
        userRepository: {
          findEmailsByDiscordIdsWithAlertPreference: () => Promise.resolve(emails),
        },
      });

      const result = await ctx.service.getEmailsForAlerts(["user1", "user2"]);

      assert.deepStrictEqual(result, emails);
    });
  });

  describe("updateUserByDiscordId", { concurrency: true }, () => {
    it("updates user preferences", async () => {
      const updatedUser = { ...harness.createContext().defaultUser, preferences: { dateFormat: "YYYY-MM-DD" } };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(updatedUser),
          updatePreferencesByDiscordId: () => Promise.resolve(updatedUser),
        },
      });

      const result = await ctx.service.updateUserByDiscordId("discord-user-id", {
        preferences: { dateFormat: "YYYY-MM-DD" },
      });

      assert.ok(result);
      assert.strictEqual(
        ctx.userRepository.updatePreferencesByDiscordId.mock.calls.length,
        1
      );
    });

    it("returns full user data after update", async () => {
      const existingUser = { ...harness.createContext().defaultUser };
      const ctx = harness.createContext({
        userRepository: {
          findByDiscordId: () => Promise.resolve(existingUser),
          updatePreferencesByDiscordId: () => Promise.resolve(existingUser),
        },
      });

      const result = await ctx.service.updateUserByDiscordId("discord-user-id", {
        preferences: { dateFormat: "YYYY-MM-DD" },
      });

      assert.ok(result);
      assert.ok(result.user);
      assert.ok(result.subscription);
      assert.ok(result.creditBalance);
    });

    it("returns null when user does not exist", async () => {
      const ctx = harness.createContext({
        userRepository: {
          updatePreferencesByDiscordId: () => Promise.resolve(null),
        },
      });

      const result = await ctx.service.updateUserByDiscordId("non-existent-user", {
        preferences: { dateFormat: "YYYY-MM-DD" },
      });

      assert.strictEqual(result, null);
    });
  });

  describe("setRedditCredentials", { concurrency: true }, () => {
    it("encrypts and stores credentials", async () => {
      const ctx = harness.createContext();

      await ctx.service.setRedditCredentials({
        userId: "user-id",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
      });

      assert.strictEqual(ctx.userRepository.setExternalCredential.mock.calls.length, 1);
      const callArgs = ctx.userRepository.setExternalCredential.mock.calls[0]?.arguments as [
        string,
        { type: string; data: Record<string, string>; expireAt: Date }
      ];
      assert.strictEqual(callArgs?.[0], "user-id");
      assert.strictEqual(callArgs?.[1].type, "reddit");
      assert.ok(callArgs?.[1].data.accessToken);
      assert.ok(callArgs?.[1].data.refreshToken);
      assert.ok(callArgs?.[1].expireAt);
    });

    it("throws error when encryption key is not set", async () => {
      const ctx = harness.createContext({
        config: { BACKEND_API_ENCRYPTION_KEY_HEX: undefined },
      });

      const serviceWithoutKey = new UsersService({
        config: { ...ctx.config, BACKEND_API_ENCRYPTION_KEY_HEX: undefined } as Config,
        userRepository: ctx.userRepository as unknown as IUserRepository,
        userFeedRepository: ctx.userFeedRepository as unknown as IUserFeedRepository,
        supporterRepository: ctx.supporterRepository as unknown as ISupporterRepository,
        supportersService: ctx.supportersService as unknown as SupportersService,
        paddleService: ctx.paddleService as unknown as PaddleService,
      });

      await assert.rejects(
        () =>
          serviceWithoutKey.setRedditCredentials({
            userId: "user-id",
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiresIn: 3600,
          }),
        { message: "Encryption key not set while encrypting object values" }
      );
    });
  });

  describe("removeRedditCredentials", { concurrency: true }, () => {
    it("removes credentials from repository", async () => {
      const ctx = harness.createContext();

      await ctx.service.removeRedditCredentials("user-id");

      assert.strictEqual(
        ctx.userRepository.removeExternalCredentials.mock.calls.length,
        1
      );
      assert.strictEqual(
        ctx.userRepository.removeExternalCredentials.mock.calls[0]?.arguments[0],
        "user-id"
      );
    });
  });

  describe("revokeRedditCredentials", { concurrency: true }, () => {
    it("revokes specific credential", async () => {
      const ctx = harness.createContext();

      await ctx.service.revokeRedditCredentials("user-id", "credential-id");

      assert.strictEqual(
        ctx.userRepository.revokeExternalCredential.mock.calls.length,
        1
      );
      assert.strictEqual(
        ctx.userRepository.revokeExternalCredential.mock.calls[0]?.arguments[0],
        "user-id"
      );
      assert.strictEqual(
        ctx.userRepository.revokeExternalCredential.mock.calls[0]?.arguments[1],
        "credential-id"
      );
    });
  });

  describe("syncLookupKeys", { concurrency: true }, () => {
    it("adds lookup keys for feeds with active Reddit credentials", async () => {
      const ctx = harness.createContext({
        userRepository: {
          aggregateUsersWithActiveRedditCredentials: async function* () {
            yield { discordUserId: "discord-1", feedId: "feed-1", lookupKey: undefined };
            yield { discordUserId: "discord-2", feedId: "feed-2", lookupKey: undefined };
          },
        },
      });

      await ctx.service.syncLookupKeys();

      assert.strictEqual(ctx.userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 1);
      const ops = ctx.userFeedRepository.bulkUpdateLookupKeys.mock.calls[0]?.arguments[0] as Array<{
        feedId: string;
        action: string;
        lookupKey?: string;
      }>;
      assert.strictEqual(ops.length, 2);
      assert.strictEqual(ops[0]?.action, "set");
      assert.strictEqual(ops[0]?.feedId, "feed-1");
      assert.ok(ops[0]?.lookupKey);
      assert.strictEqual(ops[1]?.action, "set");
      assert.strictEqual(ops[1]?.feedId, "feed-2");
    });

    it("skips feeds that already have lookup keys", async () => {
      const ctx = harness.createContext({
        userRepository: {
          aggregateUsersWithActiveRedditCredentials: async function* () {
            yield { discordUserId: "discord-1", feedId: "feed-1", lookupKey: "existing-key" };
          },
        },
      });

      await ctx.service.syncLookupKeys();

      assert.strictEqual(ctx.userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 0);
    });

    it("removes lookup keys for feeds with expired/revoked credentials", async () => {
      const ctx = harness.createContext({
        userRepository: {
          aggregateUsersWithExpiredOrRevokedRedditCredentials: async function* () {
            yield { feedId: "feed-expired" };
          },
        },
      });

      await ctx.service.syncLookupKeys();

      assert.strictEqual(ctx.userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 1);
      const ops = ctx.userFeedRepository.bulkUpdateLookupKeys.mock.calls[0]?.arguments[0] as Array<{
        feedId: string;
        action: string;
      }>;
      assert.strictEqual(ops.length, 1);
      assert.strictEqual(ops[0]?.action, "unset");
      assert.strictEqual(ops[0]?.feedId, "feed-expired");
    });

    it("passes userIds and feedIds to repository methods", async () => {
      const ctx = harness.createContext();

      await ctx.service.syncLookupKeys({ userIds: ["user-1"], feedIds: ["feed-1"] });

      assert.strictEqual(
        ctx.userRepository.aggregateUsersWithActiveRedditCredentials.mock.calls.length,
        1
      );
      const activeArgs = ctx.userRepository.aggregateUsersWithActiveRedditCredentials.mock.calls[0]
        ?.arguments[0] as { userIds?: string[]; feedIds?: string[] };
      assert.deepStrictEqual(activeArgs?.userIds, ["user-1"]);
      assert.deepStrictEqual(activeArgs?.feedIds, ["feed-1"]);

      assert.strictEqual(
        ctx.userRepository.aggregateUsersWithExpiredOrRevokedRedditCredentials.mock.calls.length,
        1
      );
      const expiredArgs = ctx.userRepository.aggregateUsersWithExpiredOrRevokedRedditCredentials.mock
        .calls[0]?.arguments[0] as { userIds?: string[]; feedIds?: string[] };
      assert.deepStrictEqual(expiredArgs?.userIds, ["user-1"]);
      assert.deepStrictEqual(expiredArgs?.feedIds, ["feed-1"]);
    });

    it("does not call bulkUpdateLookupKeys when there are no operations", async () => {
      const ctx = harness.createContext();

      await ctx.service.syncLookupKeys();

      assert.strictEqual(ctx.userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 0);
    });
  });
});
