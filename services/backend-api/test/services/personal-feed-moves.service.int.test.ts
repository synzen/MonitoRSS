import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import {
  UserExternalCredentialType,
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateSnowflake } from "../helpers/test-id";

describe("PersonalFeedMovesService", () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(() => ctx.teardown());

  it("moves a feed, reconciles its credential route, and can restore it", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.container.userRepository.create({ discordUserId });
    const workspace =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name: "Move destination",
        slug: `move-${randomUUID()}`,
        ownerUserId: user.id,
      });
    await ctx.container.userRepository.setExternalCredential(user.id, {
      type: UserExternalCredentialType.Reddit,
      data: { accessToken: "personal-token", refreshToken: "personal-refresh" },
      expireAt: new Date(Date.now() + 60_000),
    });
    const feed = await ctx.container.userFeedRepository.create({
      title: "Credentialed personal feed",
      url: "https://www.reddit.com/r/monitorss.rss",
      feedRequestLookupKey: randomUUID(),
      user: { id: user.id, discordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: generateSnowflake(),
            type: UserFeedManagerInviteType.CoManage,
            status: UserFeedManagerStatus.Pending,
          },
          {
            discordUserId: generateSnowflake(),
            type: UserFeedManagerInviteType.CoManage,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });
    const original = await ctx.container.userFeedRepository.findById(feed.id);
    const personalCredentialBefore =
      await ctx.container.userRepository.getExternalCredentials(
        user.id,
        UserExternalCredentialType.Reddit,
      );

    const receipt =
      await ctx.container.personalFeedMovesService.moveToWorkspace({
        discordUserId,
        feedIds: [feed.id],
        workspaceId: workspace.id,
        maxWorkspaceFeeds: 1,
      });

    const moved = await ctx.container.userFeedRepository.findById(feed.id);
    const personalCredentialAfter =
      await ctx.container.userRepository.getExternalCredentials(
        user.id,
        UserExternalCredentialType.Reddit,
      );
    assert.strictEqual(moved?.workspaceId, workspace.id);
    assert.strictEqual(moved?.shareManageOptions, undefined);
    assert.strictEqual(moved?.feedRequestLookupKey, undefined);
    assert.deepStrictEqual(personalCredentialAfter, personalCredentialBefore);

    await ctx.container.personalFeedMovesService.rollback(receipt);

    const restored = await ctx.container.userFeedRepository.findById(feed.id);
    assert.strictEqual(restored?.workspaceId, undefined);
    assert.deepStrictEqual(
      restored?.shareManageOptions,
      original?.shareManageOptions,
    );
    assert.ok(restored?.feedRequestLookupKey);
    assert.deepStrictEqual(
      await ctx.container.userRepository.getExternalCredentials(
        user.id,
        UserExternalCredentialType.Reddit,
      ),
      personalCredentialBefore,
    );
  });
});
