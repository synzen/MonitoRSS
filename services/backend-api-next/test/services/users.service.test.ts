import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { UsersService } from "../../src/services/users/users.service";
import type { Config } from "../../src/config";
import type { IUserRepository } from "../../src/repositories/interfaces/user.types";
import type { IUserFeedRepository } from "../../src/repositories/interfaces/user-feed.types";
import type { ISupporterRepository } from "../../src/repositories/interfaces/supporter.types";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import type { PaddleService } from "../../src/services/paddle/paddle.service";
import { SubscriptionStatus } from "../../src/repositories/shared/enums";

describe("UsersService", () => {
  let service: UsersService;
  let userRepository: {
    findByDiscordId: ReturnType<typeof mock.fn>;
    findIdByDiscordId: ReturnType<typeof mock.fn>;
    create: ReturnType<typeof mock.fn>;
    updateEmailByDiscordId: ReturnType<typeof mock.fn>;
    updatePreferencesByDiscordId: ReturnType<typeof mock.fn>;
    findEmailsByDiscordIdsWithAlertPreference: ReturnType<typeof mock.fn>;
    setExternalCredential: ReturnType<typeof mock.fn>;
    getExternalCredentials: ReturnType<typeof mock.fn>;
    removeExternalCredentials: ReturnType<typeof mock.fn>;
    revokeExternalCredential: ReturnType<typeof mock.fn>;
    aggregateUsersWithActiveRedditCredentials: ReturnType<typeof mock.fn>;
    aggregateUsersWithExpiredOrRevokedRedditCredentials: ReturnType<typeof mock.fn>;
  };
  let userFeedRepository: {
    bulkUpdateLookupKeys: ReturnType<typeof mock.fn>;
  };
  let supporterRepository: {
    findById: ReturnType<typeof mock.fn>;
  };
  let supportersService: {
    getBenefitsOfDiscordUser: ReturnType<typeof mock.fn>;
    getSupporterSubscription: ReturnType<typeof mock.fn>;
  };
  let paddleService: {
    updateCustomer: ReturnType<typeof mock.fn>;
    getCustomerCreditBalanace: ReturnType<typeof mock.fn>;
  };

  const mockConfig = {
    BACKEND_API_ENABLE_SUPPORTERS: true,
    BACKEND_API_ENCRYPTION_KEY_HEX: "0".repeat(64),
  } as Config;

  const defaultUser = {
    id: "user-id",
    discordUserId: "discord-user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    userRepository = {
      findByDiscordId: mock.fn(() => Promise.resolve(null)),
      findIdByDiscordId: mock.fn(() => Promise.resolve(null)),
      create: mock.fn(() => Promise.resolve(defaultUser)),
      updateEmailByDiscordId: mock.fn(() => Promise.resolve(defaultUser)),
      updatePreferencesByDiscordId: mock.fn(() => Promise.resolve(defaultUser)),
      findEmailsByDiscordIdsWithAlertPreference: mock.fn(() => Promise.resolve([])),
      setExternalCredential: mock.fn(() => Promise.resolve()),
      getExternalCredentials: mock.fn(() => Promise.resolve(null)),
      removeExternalCredentials: mock.fn(() => Promise.resolve()),
      revokeExternalCredential: mock.fn(() => Promise.resolve()),
      aggregateUsersWithActiveRedditCredentials: mock.fn(async function* () {}),
      aggregateUsersWithExpiredOrRevokedRedditCredentials: mock.fn(async function* () {}),
    };
    userFeedRepository = {
      bulkUpdateLookupKeys: mock.fn(() => Promise.resolve()),
    };
    supporterRepository = {
      findById: mock.fn(() => Promise.resolve(null)),
    };
    supportersService = {
      getBenefitsOfDiscordUser: mock.fn(() =>
        Promise.resolve({
          maxFeeds: 5,
          maxUserFeeds: 5,
          maxUserFeedsComposition: { base: 5, legacy: 0 },
          allowExternalProperties: false,
          maxPatreonPledge: undefined,
        })
      ),
      getSupporterSubscription: mock.fn(() =>
        Promise.resolve({ customer: null, subscription: null })
      ),
    };
    paddleService = {
      updateCustomer: mock.fn(() => Promise.resolve()),
      getCustomerCreditBalanace: mock.fn(() =>
        Promise.resolve({ data: [] })
      ),
    };

    service = new UsersService({
      config: mockConfig,
      userRepository: userRepository as unknown as IUserRepository,
      userFeedRepository: userFeedRepository as unknown as IUserFeedRepository,
      supporterRepository: supporterRepository as unknown as ISupporterRepository,
      supportersService: supportersService as unknown as SupportersService,
      paddleService: paddleService as unknown as PaddleService,
    });
  });

  describe("initDiscordUser", () => {
    it("creates a new user if not found", async () => {
      userRepository.findByDiscordId.mock.mockImplementation(() => Promise.resolve(null));

      await service.initDiscordUser("discord-user-id", { email: "test@test.com" });

      assert.strictEqual(userRepository.create.mock.calls.length, 1);
      assert.deepStrictEqual(userRepository.create.mock.calls[0]?.arguments[0], {
        discordUserId: "discord-user-id",
        email: "test@test.com",
      });
    });

    it("returns existing user if found and no email update needed", async () => {
      const existingUser = { ...defaultUser, email: "test@test.com" };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );

      const result = await service.initDiscordUser("discord-user-id", {
        email: "test@test.com",
      });

      assert.strictEqual(userRepository.create.mock.calls.length, 0);
      assert.deepStrictEqual(result, existingUser);
    });

    it("updates email if different from existing", async () => {
      const existingUser = { ...defaultUser, email: "old@test.com" };
      const updatedUser = { ...defaultUser, email: "new@test.com" };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );
      userRepository.updateEmailByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(updatedUser)
      );

      await service.initDiscordUser("discord-user-id", { email: "new@test.com" });

      assert.strictEqual(userRepository.updateEmailByDiscordId.mock.calls.length, 1);
    });

    it("syncs email with Paddle when email changes and user has paddle customer", async () => {
      const existingUser = { ...defaultUser, email: "old@test.com" };
      const updatedUser = { ...defaultUser, email: "new@test.com" };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );
      userRepository.updateEmailByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(updatedUser)
      );
      supporterRepository.findById.mock.mockImplementation(() =>
        Promise.resolve({
          paddleCustomer: { customerId: "paddle-cust-123" },
        })
      );

      await service.initDiscordUser("discord-user-id", { email: "new@test.com" });

      assert.strictEqual(paddleService.updateCustomer.mock.calls.length, 1);
      assert.strictEqual(
        paddleService.updateCustomer.mock.calls[0]?.arguments[0],
        "paddle-cust-123"
      );
      assert.deepStrictEqual(
        paddleService.updateCustomer.mock.calls[0]?.arguments[1],
        { email: "new@test.com" }
      );
    });

    it("does not throw when Paddle update fails", async () => {
      const existingUser = { ...defaultUser, email: "old@test.com" };
      const updatedUser = { ...defaultUser, email: "new@test.com" };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );
      userRepository.updateEmailByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(updatedUser)
      );
      supporterRepository.findById.mock.mockImplementation(() =>
        Promise.resolve({
          paddleCustomer: { customerId: "paddle-cust-123" },
        })
      );
      paddleService.updateCustomer.mock.mockImplementation(() =>
        Promise.reject(new Error("Paddle API error"))
      );

      await assert.doesNotReject(async () => {
        await service.initDiscordUser("discord-user-id", { email: "new@test.com" });
      });
    });
  });

  describe("getOrCreateUserByDiscordId", () => {
    it("returns existing user if found", async () => {
      const existingUser = { ...defaultUser };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );

      const result = await service.getOrCreateUserByDiscordId("discord-user-id");

      assert.deepStrictEqual(result, existingUser);
      assert.strictEqual(userRepository.create.mock.calls.length, 0);
    });

    it("creates new user if not found", async () => {
      userRepository.findByDiscordId.mock.mockImplementation(() => Promise.resolve(null));

      await service.getOrCreateUserByDiscordId("discord-user-id");

      assert.strictEqual(userRepository.create.mock.calls.length, 1);
    });
  });

  describe("getIdByDiscordId", () => {
    it("returns the user ID if found", async () => {
      userRepository.findIdByDiscordId.mock.mockImplementation(() =>
        Promise.resolve("user-id-123")
      );

      const result = await service.getIdByDiscordId("discord-user-id");

      assert.strictEqual(result, "user-id-123");
    });

    it("returns null if not found", async () => {
      userRepository.findIdByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(null)
      );

      const result = await service.getIdByDiscordId("discord-user-id");

      assert.strictEqual(result, null);
    });
  });

  describe("getByDiscordId", () => {
    it("returns user with free subscription when no email", async () => {
      const existingUser = { ...defaultUser };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );

      const result = await service.getByDiscordId("discord-user-id");

      assert.ok(result);
      assert.strictEqual(result.user.discordUserId, "discord-user-id");
      assert.strictEqual(result.subscription.product.key, "free");
      assert.strictEqual(result.subscription.status, SubscriptionStatus.Active);
      assert.strictEqual(result.creditBalance.availableFormatted, "0");
    });

    it("returns subscription details when user has active subscription", async () => {
      const existingUser = { ...defaultUser, email: "test@test.com" };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );
      supportersService.getSupporterSubscription.mock.mockImplementation(() =>
        Promise.resolve({
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
        })
      );
      paddleService.getCustomerCreditBalanace.mock.mockImplementation(() =>
        Promise.resolve({ data: [] })
      );

      const result = await service.getByDiscordId("discord-user-id");

      assert.ok(result);
      assert.strictEqual(result.subscription.product.key, "tier1");
      assert.strictEqual(result.subscription.product.name, "Tier 1");
      assert.strictEqual(result.subscription.status, SubscriptionStatus.Active);
    });
  });

  describe("getEmailsForAlerts", () => {
    it("returns emails from repository", async () => {
      const emails = ["test1@test.com", "test2@test.com"];
      userRepository.findEmailsByDiscordIdsWithAlertPreference.mock.mockImplementation(
        () => Promise.resolve(emails)
      );

      const result = await service.getEmailsForAlerts(["user1", "user2"]);

      assert.deepStrictEqual(result, emails);
    });
  });

  describe("updateUserByDiscordId", () => {
    it("updates user preferences", async () => {
      const updatedUser = { ...defaultUser, preferences: { dateFormat: "YYYY-MM-DD" } };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(updatedUser)
      );
      userRepository.updatePreferencesByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(updatedUser)
      );

      const result = await service.updateUserByDiscordId("discord-user-id", {
        preferences: { dateFormat: "YYYY-MM-DD" },
      });

      assert.ok(result);
      assert.strictEqual(
        userRepository.updatePreferencesByDiscordId.mock.calls.length,
        1
      );
    });

    it("returns full user data after update", async () => {
      const existingUser = { ...defaultUser };
      userRepository.findByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );
      userRepository.updatePreferencesByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(existingUser)
      );

      const result = await service.updateUserByDiscordId("discord-user-id", {
        preferences: { dateFormat: "YYYY-MM-DD" },
      });

      assert.ok(result);
      assert.ok(result.user);
      assert.ok(result.subscription);
      assert.ok(result.creditBalance);
    });

    it("returns null when user does not exist", async () => {
      userRepository.updatePreferencesByDiscordId.mock.mockImplementation(() =>
        Promise.resolve(null)
      );

      const result = await service.updateUserByDiscordId("non-existent-user", {
        preferences: { dateFormat: "YYYY-MM-DD" },
      });

      assert.strictEqual(result, null);
    });
  });

  describe("setRedditCredentials", () => {
    it("encrypts and stores credentials", async () => {
      await service.setRedditCredentials({
        userId: "user-id",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
      });

      assert.strictEqual(userRepository.setExternalCredential.mock.calls.length, 1);
      const callArgs = userRepository.setExternalCredential.mock.calls[0]?.arguments as [
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
      const serviceWithoutKey = new UsersService({
        config: { ...mockConfig, BACKEND_API_ENCRYPTION_KEY_HEX: undefined } as Config,
        userRepository: userRepository as unknown as IUserRepository,
        userFeedRepository: userFeedRepository as unknown as IUserFeedRepository,
        supporterRepository: supporterRepository as unknown as ISupporterRepository,
        supportersService: supportersService as unknown as SupportersService,
        paddleService: paddleService as unknown as PaddleService,
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

  describe("removeRedditCredentials", () => {
    it("removes credentials from repository", async () => {
      await service.removeRedditCredentials("user-id");

      assert.strictEqual(
        userRepository.removeExternalCredentials.mock.calls.length,
        1
      );
      assert.strictEqual(
        userRepository.removeExternalCredentials.mock.calls[0]?.arguments[0],
        "user-id"
      );
    });
  });

  describe("revokeRedditCredentials", () => {
    it("revokes specific credential", async () => {
      await service.revokeRedditCredentials("user-id", "credential-id");

      assert.strictEqual(
        userRepository.revokeExternalCredential.mock.calls.length,
        1
      );
      assert.strictEqual(
        userRepository.revokeExternalCredential.mock.calls[0]?.arguments[0],
        "user-id"
      );
      assert.strictEqual(
        userRepository.revokeExternalCredential.mock.calls[0]?.arguments[1],
        "credential-id"
      );
    });
  });

  describe("syncLookupKeys", () => {
    it("adds lookup keys for feeds with active Reddit credentials", async () => {
      userRepository.aggregateUsersWithActiveRedditCredentials.mock.mockImplementation(
        async function* () {
          yield { discordUserId: "discord-1", feedId: "feed-1", lookupKey: undefined };
          yield { discordUserId: "discord-2", feedId: "feed-2", lookupKey: undefined };
        }
      );

      await service.syncLookupKeys();

      assert.strictEqual(userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 1);
      const ops = userFeedRepository.bulkUpdateLookupKeys.mock.calls[0]?.arguments[0] as Array<{
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
      userRepository.aggregateUsersWithActiveRedditCredentials.mock.mockImplementation(
        async function* () {
          yield { discordUserId: "discord-1", feedId: "feed-1", lookupKey: "existing-key" };
        }
      );

      await service.syncLookupKeys();

      assert.strictEqual(userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 0);
    });

    it("removes lookup keys for feeds with expired/revoked credentials", async () => {
      userRepository.aggregateUsersWithExpiredOrRevokedRedditCredentials.mock.mockImplementation(
        async function* () {
          yield { feedId: "feed-expired" };
        }
      );

      await service.syncLookupKeys();

      assert.strictEqual(userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 1);
      const ops = userFeedRepository.bulkUpdateLookupKeys.mock.calls[0]?.arguments[0] as Array<{
        feedId: string;
        action: string;
      }>;
      assert.strictEqual(ops.length, 1);
      assert.strictEqual(ops[0]?.action, "unset");
      assert.strictEqual(ops[0]?.feedId, "feed-expired");
    });

    it("passes userIds and feedIds to repository methods", async () => {
      await service.syncLookupKeys({ userIds: ["user-1"], feedIds: ["feed-1"] });

      assert.strictEqual(
        userRepository.aggregateUsersWithActiveRedditCredentials.mock.calls.length,
        1
      );
      const activeArgs = userRepository.aggregateUsersWithActiveRedditCredentials.mock.calls[0]
        ?.arguments[0] as { userIds?: string[]; feedIds?: string[] };
      assert.deepStrictEqual(activeArgs?.userIds, ["user-1"]);
      assert.deepStrictEqual(activeArgs?.feedIds, ["feed-1"]);

      assert.strictEqual(
        userRepository.aggregateUsersWithExpiredOrRevokedRedditCredentials.mock.calls.length,
        1
      );
      const expiredArgs = userRepository.aggregateUsersWithExpiredOrRevokedRedditCredentials.mock
        .calls[0]?.arguments[0] as { userIds?: string[]; feedIds?: string[] };
      assert.deepStrictEqual(expiredArgs?.userIds, ["user-1"]);
      assert.deepStrictEqual(expiredArgs?.feedIds, ["feed-1"]);
    });

    it("does not call bulkUpdateLookupKeys when there are no operations", async () => {
      await service.syncLookupKeys();

      assert.strictEqual(userFeedRepository.bulkUpdateLookupKeys.mock.calls.length, 0);
    });
  });
});
