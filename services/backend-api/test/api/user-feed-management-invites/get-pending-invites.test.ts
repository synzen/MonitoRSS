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

interface PendingInviteResult {
  id: string;
  type?: "CO_MANAGE" | "TRANSFER";
  feed: {
    id: string;
    title: string;
    url: string;
    ownerDiscordUserId: string;
  };
}

interface GetPendingInvitesResponse {
  results: PendingInviteResult[];
}

describe(
  "GET /api/v1/user-feed-management-invites",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/user-feed-management-invites");
      assert.strictEqual(response.status, 401);
    });

    it("returns empty results when user has no pending invites", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      assert.deepStrictEqual(body.results, []);
    });

    it("returns pending invites with correct structure", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Pending Invite Feed",
        url: `https://example.com/pending-invite-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      const invite = body.results.find((r) => r.feed.id === feed.id);
      assert.ok(invite);
      assert.strictEqual(typeof invite.id, "string");
      assert.strictEqual(invite.type, "CO_MANAGE");
      assert.strictEqual(invite.feed.id, feed.id);
      assert.strictEqual(invite.feed.title, "Pending Invite Feed");
      assert.strictEqual(invite.feed.ownerDiscordUserId, ownerDiscordUserId);
    });

    it("excludes accepted invites", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Accepted Invite Feed",
        url: `https://example.com/accepted-invite-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      const found = body.results.find((r) => r.feed.id === feed.id);
      assert.strictEqual(found, undefined);
    });

    it("excludes declined invites", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Declined Invite Feed",
        url: `https://example.com/declined-invite-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Declined,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      const found = body.results.find((r) => r.feed.id === feed.id);
      assert.strictEqual(found, undefined);
    });

    it("excludes invites for other users", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherInviteeDiscordUserId = generateSnowflake();
      const myDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(myDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Invite Feed",
        url: `https://example.com/other-user-invite-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: otherInviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      const found = body.results.find((r) => r.feed.id === feed.id);
      assert.strictEqual(found, undefined);
    });

    it("returns multiple pending invites", async () => {
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      await ctx.container.userFeedRepository.create({
        title: "Multi Invite Feed 1",
        url: `https://example.com/multi-invite-1-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: generateSnowflake() },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      await ctx.container.userFeedRepository.create({
        title: "Multi Invite Feed 2",
        url: `https://example.com/multi-invite-2-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: generateSnowflake() },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.Transfer,
            },
          ],
        },
      });

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      assert.ok(body.results.length >= 2);
    });

    it("correctly returns CO_MANAGE type", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "CoManage Type Feed",
        url: `https://example.com/comanage-type-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.CoManage,
            },
          ],
        },
      });

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      const invite = body.results.find((r) => r.feed.id === feed.id);
      assert.ok(invite);
      assert.strictEqual(invite.type, "CO_MANAGE");
    });

    it("correctly returns TRANSFER type", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Transfer Type Feed",
        url: `https://example.com/transfer-type-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        shareManageOptions: {
          invites: [
            {
              discordUserId: inviteeDiscordUserId,
              status: UserFeedManagerStatus.Pending,
              type: UserFeedManagerInviteType.Transfer,
            },
          ],
        },
      });

      const response = await user.fetch("/api/v1/user-feed-management-invites");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInvitesResponse;
      const invite = body.results.find((r) => r.feed.id === feed.id);
      assert.ok(invite);
      assert.strictEqual(invite.type, "TRANSFER");
    });
  },
);
