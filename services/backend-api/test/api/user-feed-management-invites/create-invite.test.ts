import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

interface CreateInviteResponse {
  result: { status: string };
}

interface ErrorResponse {
  code: string;
  message: string;
}

describe(
  "POST /api/v1/user-feed-management-invites",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/user-feed-management-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedId: generateTestId(),
          discordUserId: generateSnowflake(),
          type: "CO_MANAGE",
        }),
      });
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 when feed does not exist", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: generateTestId(),
            discordUserId: generateSnowflake(),
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when user is not the feed creator", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherUserDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherUserDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Not Owner Feed",
        url: `https://example.com/not-owner-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: generateSnowflake(),
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("creates CO_MANAGE invite successfully", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const targetDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Create CoManage Feed",
        url: `https://example.com/create-comanage-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: targetDiscordUserId,
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as CreateInviteResponse;
      assert.strictEqual(body.result.status, "SUCCESS");

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed?.shareManageOptions?.invites);
      const invite = updatedFeed.shareManageOptions.invites.find(
        (i) => i.discordUserId === targetDiscordUserId,
      );
      assert.ok(invite);
      assert.strictEqual(invite.type, UserFeedManagerInviteType.CoManage);
      assert.strictEqual(invite.status, UserFeedManagerStatus.Pending);
    });

    it("creates TRANSFER invite successfully", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const targetDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Create Transfer Feed",
        url: `https://example.com/create-transfer-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: targetDiscordUserId,
            type: "TRANSFER",
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as CreateInviteResponse;
      assert.strictEqual(body.result.status, "SUCCESS");

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const invite = updatedFeed?.shareManageOptions?.invites?.find(
        (i) => i.discordUserId === targetDiscordUserId,
      );
      assert.ok(invite);
      assert.strictEqual(invite.type, UserFeedManagerInviteType.Transfer);
    });

    it("returns USER_MANAGER_ALREADY_INVITED when user already invited", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const targetDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Already Invited Feed",
        url: `https://example.com/already-invited-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: targetDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: targetDiscordUserId,
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as ErrorResponse;
      assert.strictEqual(body.code, "USER_MANAGER_ALREADY_INVITED");
    });

    it("returns USER_MANAGER_ALREADY_INVITED when trying to invite self", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Self Invite Feed",
        url: `https://example.com/self-invite-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: ownerDiscordUserId,
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as ErrorResponse;
      assert.strictEqual(body.code, "USER_MANAGER_ALREADY_INVITED");
    });

    it("returns USER_FEED_TRANSFER_REQUEST_EXISTS when transfer already exists", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const existingTransferTarget = generateSnowflake();
      const newTransferTarget = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Existing Transfer Feed",
        url: `https://example.com/existing-transfer-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: existingTransferTarget,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.Transfer,
            },
          ],
        },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: newTransferTarget,
            type: "TRANSFER",
          }),
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as ErrorResponse;
      assert.strictEqual(body.code, "USER_FEED_TRANSFER_REQUEST_EXISTS");
    });

    it("creates invite with connection restrictions", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const targetDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);
      const connectionId = generateTestId();

      const feed = await ctx.container.userFeedRepository.create({
        title: "With Connections Feed",
        url: `https://example.com/with-connections-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        connections: {
          discordChannels: [
            {
              id: connectionId,
              name: "test-connection",
              details: {
                embeds: [],
                formatter: {},
                channel: {
                  id: generateSnowflake(),
                  guildId: generateSnowflake(),
                },
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never,
          ],
        },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: targetDiscordUserId,
            type: "CO_MANAGE",
            connections: [{ connectionId }],
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as CreateInviteResponse;
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("returns 500 when connection ID is invalid", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const targetDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(ownerDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invalid Connection Feed",
        url: `https://example.com/invalid-connection-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: targetDiscordUserId,
            type: "CO_MANAGE",
            connections: [{ connectionId: generateTestId() }],
          }),
        },
      );

      assert.strictEqual(response.status, 500);
    });

    it("returns 400 when feedId is empty", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: "",
            discordUserId: generateSnowflake(),
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when discordUserId is empty", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: generateTestId(),
            discordUserId: "",
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when type is invalid", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: generateTestId(),
            discordUserId: generateSnowflake(),
            type: "INVALID_TYPE",
          }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("allows admin user to create invite for any feed", async () => {
      const adminDiscordUserId = generateSnowflake();
      const ownerDiscordUserId = generateSnowflake();
      const targetDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(adminDiscordUserId);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Invite Feed",
        url: `https://example.com/admin-invite-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites",
        {
          method: "POST",
          body: JSON.stringify({
            feedId: feed.id,
            discordUserId: targetDiscordUserId,
            type: "CO_MANAGE",
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as CreateInviteResponse;
      assert.strictEqual(body.result.status, "SUCCESS");

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      const invite = updatedFeed?.shareManageOptions?.invites?.find(
        (i) => i.discordUserId === targetDiscordUserId,
      );
      assert.ok(invite);
      assert.strictEqual(invite.type, UserFeedManagerInviteType.CoManage);
      assert.strictEqual(invite.status, UserFeedManagerStatus.Pending);
    });
  },
);
