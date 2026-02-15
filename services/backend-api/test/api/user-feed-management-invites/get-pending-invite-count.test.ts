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

interface GetPendingInviteCountResponse {
  total: number;
}

describe(
  "GET /api/v1/user-feed-management-invites/pending",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        "/api/v1/user-feed-management-invites/pending",
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 0 when user has no pending invites", async () => {
      const user = await ctx.asUser(generateSnowflake());

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites/pending",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInviteCountResponse;
      assert.strictEqual(body.total, 0);
    });

    it("returns correct count of pending invites", async () => {
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      await ctx.container.userFeedRepository.create({
        title: "Count Test Feed 1",
        url: `https://example.com/count-test-1-${generateSnowflake()}.xml`,
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
        title: "Count Test Feed 2",
        url: `https://example.com/count-test-2-${generateSnowflake()}.xml`,
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

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites/pending",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInviteCountResponse;
      assert.ok(body.total >= 2);
    });

    it("excludes non-pending invites from count", async () => {
      const inviteeDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(inviteeDiscordUserId);

      await ctx.container.userFeedRepository.create({
        title: "Accepted Count Feed",
        url: `https://example.com/accepted-count-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: generateSnowflake() },
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

      await ctx.container.userFeedRepository.create({
        title: "Declined Count Feed",
        url: `https://example.com/declined-count-${generateSnowflake()}.xml`,
        user: { id: generateTestId(), discordUserId: generateSnowflake() },
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

      const response = await user.fetch(
        "/api/v1/user-feed-management-invites/pending",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as GetPendingInviteCountResponse;
      assert.strictEqual(body.total, 0);
    });
  },
);
