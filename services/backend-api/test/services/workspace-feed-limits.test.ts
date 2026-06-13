import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  FeedConnectionDisabledCode,
  UserFeedDisabledCode,
} from "../../src/repositories/shared/enums";
import { FeedLimitReachedException } from "../../src/shared/exceptions/user-feeds.exceptions";
import { createUserFeedsHarness } from "../helpers/user-feeds.harness";
import { createMockDiscordChannelConnection } from "../helpers/mock-factories";

// NOT concurrent: enforceAllWorkspaceFeedLimits sweeps every workspace in the
// file-shared database, so it would disable feeds belonging to concurrently
// running tests (their digest then goes to the sweeper's notifier, not theirs).
describe("Workspace feed limit enforcement", () => {
  const harness = createUserFeedsHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("enforceWorkspaceFeedLimit", () => {
    it("disables oldest workspace feeds first when over limit", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 2 });
      const workspace = await ctx.createWorkspace();

      const oldest = await ctx.createWorkspaceFeed(workspace.id);
      const middle = await ctx.createWorkspaceFeed(workspace.id);
      const newest = await ctx.createWorkspaceFeed(workspace.id);

      await ctx.setCreatedAt(oldest.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(middle.id, new Date("2021-01-01"));
      await ctx.setCreatedAt(newest.id, new Date("2022-01-01"));

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      assert.strictEqual(
        (await ctx.findById(oldest.id))?.disabledCode,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
      assert.strictEqual((await ctx.findById(middle.id))?.disabledCode, undefined);
      assert.strictEqual((await ctx.findById(newest.id))?.disabledCode, undefined);
    });

    it("re-enables newest ExceededFeedLimit feeds first when under limit", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 3 });
      const workspace = await ctx.createWorkspace();

      const enabled = await ctx.createWorkspaceFeed(workspace.id);
      const oldDisabled = await ctx.createWorkspaceFeed(workspace.id);
      const newDisabled = await ctx.createWorkspaceFeed(workspace.id);

      await ctx.setCreatedAt(enabled.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(oldDisabled.id, new Date("2021-01-01"));
      await ctx.setCreatedAt(newDisabled.id, new Date("2022-01-01"));
      await ctx.setDisabledCode(
        oldDisabled.id,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
      await ctx.setDisabledCode(
        newDisabled.id,
        UserFeedDisabledCode.ExceededFeedLimit,
      );

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      assert.strictEqual(
        (await ctx.findById(oldDisabled.id))?.disabledCode,
        undefined,
      );
      assert.strictEqual(
        (await ctx.findById(newDisabled.id))?.disabledCode,
        undefined,
      );
    });

    it("does not re-enable manually disabled feeds or feeds disabled for other reasons", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 5 });
      const workspace = await ctx.createWorkspace();

      const manual = await ctx.createWorkspaceFeed(workspace.id);
      const badFormat = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setDisabledCode(manual.id, UserFeedDisabledCode.Manual);
      await ctx.setDisabledCode(badFormat.id, UserFeedDisabledCode.BadFormat);

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      assert.strictEqual(
        (await ctx.findById(manual.id))?.disabledCode,
        UserFeedDisabledCode.Manual,
      );
      assert.strictEqual(
        (await ctx.findById(badFormat.id))?.disabledCode,
        UserFeedDisabledCode.BadFormat,
      );
    });

    it("does not disable the creator's personal feeds when the workspace is over limit", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      const personal = await ctx.createFeed();
      const ws1 = await ctx.createWorkspaceFeed(workspace.id);
      const ws2 = await ctx.createWorkspaceFeed(workspace.id);

      await ctx.setCreatedAt(personal.id, new Date("2019-01-01"));
      await ctx.setCreatedAt(ws1.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(ws2.id, new Date("2021-01-01"));

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      assert.strictEqual(
        (await ctx.findById(personal.id))?.disabledCode,
        undefined,
      );
      assert.strictEqual(
        (await ctx.findById(ws1.id))?.disabledCode,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
    });

    it("sends a digest for the disabled feeds", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      const oldest = await ctx.createWorkspaceFeed(workspace.id, {
        title: "Oldest Feed",
      });
      const newest = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setCreatedAt(oldest.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(newest.id, new Date("2021-01-01"));

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      assert.strictEqual(ctx.workspaceDigests.length, 1);
      assert.strictEqual(ctx.workspaceDigests[0]!.workspaceId, workspace.id);
      assert.deepStrictEqual(
        ctx.workspaceDigests[0]!.disabledFeeds.map((f) => f.id),
        [oldest.id],
      );
      assert.strictEqual(
        ctx.workspaceDigests[0]!.disabledFeeds[0]!.title,
        "Oldest Feed",
      );
    });

    it("does not send a digest when nothing is disabled", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 5 });
      const workspace = await ctx.createWorkspace();

      await ctx.createWorkspaceFeed(workspace.id);
      const disabled = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setDisabledCode(
        disabled.id,
        UserFeedDisabledCode.ExceededFeedLimit,
      );

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      // The run re-enabled a feed but disabled none — no digest.
      assert.strictEqual(
        (await ctx.findById(disabled.id))?.disabledCode,
        undefined,
      );
      assert.strictEqual(ctx.workspaceDigests.length, 0);
    });

    it("disables webhook connections when workspace benefits disallow webhooks", async () => {
      const ctx = harness.createContext({
        workspaceMaxFeeds: 5,
        workspaceAllowWebhooks: false,
      });
      const workspace = await ctx.createWorkspace();

      const feed = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setFields(feed.id, {
        "connections.discordChannels": [
          createMockDiscordChannelConnection({
            details: { webhook: { id: "1", guildId: "1", token: "1" } },
          }),
        ],
      });

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      const updated = await ctx.findById(feed.id);
      assert.strictEqual(
        updated?.connections.discordChannels[0]?.disabledCode,
        FeedConnectionDisabledCode.NotPaidSubscriber,
      );
    });

    it("re-enables webhook connections when workspace benefits allow webhooks", async () => {
      const ctx = harness.createContext({
        workspaceMaxFeeds: 5,
        workspaceAllowWebhooks: true,
      });
      const workspace = await ctx.createWorkspace();

      const feed = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setFields(feed.id, {
        "connections.discordChannels": [
          {
            ...createMockDiscordChannelConnection({
              details: { webhook: { id: "1", guildId: "1", token: "1" } },
            }),
            disabledCode: FeedConnectionDisabledCode.NotPaidSubscriber,
          },
        ],
      });

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      const updated = await ctx.findById(feed.id);
      assert.strictEqual(
        updated?.connections.discordChannels[0]?.disabledCode,
        undefined,
      );
    });

    it("removes the supporter-rate refresh override when workspace benefits do not grant it", async () => {
      const ctx = harness.createContext({
        workspaceMaxFeeds: 5,
        workspaceRefreshRateSeconds: 600,
        defaultSupporterRefreshRateSeconds: 120,
      });
      const workspace = await ctx.createWorkspace();

      const feed = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setFields(feed.id, { userRefreshRateSeconds: 120 });

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      const updated = await ctx.findById(feed.id);
      assert.strictEqual(updated?.userRefreshRateSeconds, undefined);
    });
  });

  // While a personal→workspace conversion is in flight, the feeds have already
  // been re-parented to the workspace but the subscription record hasn't landed
  // yet (it arrives by webhook). A transient guard suppresses the disable step
  // so the just-moved feeds aren't flicked off in that window; a stale guard
  // must not exempt a workspace forever.
  describe("conversion-in-progress guard", () => {
    it("does not disable over-limit workspace feeds while a fresh guard is set", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      const feedA = await ctx.createWorkspaceFeed(workspace.id);
      const feedB = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setCreatedAt(feedA.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(feedB.id, new Date("2021-01-01"));

      await ctx.setConversionInProgress(workspace.id);

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      assert.strictEqual((await ctx.findById(feedA.id))?.disabledCode, undefined);
      assert.strictEqual((await ctx.findById(feedB.id))?.disabledCode, undefined);
      assert.strictEqual(ctx.workspaceDigests.length, 0);
    });

    it("disables over-limit workspace feeds when the guard has expired (TTL)", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      const oldest = await ctx.createWorkspaceFeed(workspace.id);
      const newest = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setCreatedAt(oldest.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(newest.id, new Date("2021-01-01"));

      // A guard far older than the TTL: a dropped webhook must never exempt a
      // workspace from enforcement indefinitely.
      await ctx.setConversionInProgress(
        workspace.id,
        new Date(Date.now() - 60 * 60 * 1000),
      );

      await ctx.service.enforceWorkspaceFeedLimit(workspace.id);

      assert.strictEqual(
        (await ctx.findById(oldest.id))?.disabledCode,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
      assert.strictEqual((await ctx.findById(newest.id))?.disabledCode, undefined);
    });
  });

  describe("enforceAllWorkspaceFeedLimits", () => {
    it("enforces every workspace independently and digests per workspace", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspaceA = await ctx.createWorkspace();
      const workspaceB = await ctx.createWorkspace();

      const a1 = await ctx.createWorkspaceFeed(workspaceA.id);
      const a2 = await ctx.createWorkspaceFeed(workspaceA.id);
      const b1 = await ctx.createWorkspaceFeed(workspaceB.id);
      const bDisabled = await ctx.createWorkspaceFeed(workspaceB.id);

      await ctx.setCreatedAt(a1.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(a2.id, new Date("2021-01-01"));
      // Workspace B is under limit once b1 is manually disabled, so its
      // ExceededFeedLimit feed comes back.
      await ctx.setDisabledCode(b1.id, UserFeedDisabledCode.Manual);
      await ctx.setDisabledCode(
        bDisabled.id,
        UserFeedDisabledCode.ExceededFeedLimit,
      );

      await ctx.service.enforceAllWorkspaceFeedLimits();

      assert.strictEqual(
        (await ctx.findById(a1.id))?.disabledCode,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
      assert.strictEqual((await ctx.findById(a2.id))?.disabledCode, undefined);
      assert.strictEqual(
        (await ctx.findById(bDisabled.id))?.disabledCode,
        undefined,
      );

      const digestsForA = ctx.workspaceDigests.filter(
        (d) => d.workspaceId === workspaceA.id,
      );
      assert.strictEqual(digestsForA.length, 1);
      assert.deepStrictEqual(
        digestsForA[0]!.disabledFeeds.map((f) => f.id),
        [a1.id],
      );
      assert.strictEqual(
        ctx.workspaceDigests.filter((d) => d.workspaceId === workspaceB.id)
          .length,
        0,
      );
    });

    it("skips disabling for a fresh-guarded workspace but reconciles an expired-guard one", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const fresh = await ctx.createWorkspace();
      const expired = await ctx.createWorkspace();

      const freshA = await ctx.createWorkspaceFeed(fresh.id);
      const freshB = await ctx.createWorkspaceFeed(fresh.id);
      const expiredA = await ctx.createWorkspaceFeed(expired.id);
      const expiredB = await ctx.createWorkspaceFeed(expired.id);
      await ctx.setCreatedAt(expiredA.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(expiredB.id, new Date("2021-01-01"));

      await ctx.setConversionInProgress(fresh.id);
      await ctx.setConversionInProgress(
        expired.id,
        new Date(Date.now() - 60 * 60 * 1000),
      );

      await ctx.service.enforceAllWorkspaceFeedLimits();

      // Fresh guard: both feeds survive the sweep.
      assert.strictEqual((await ctx.findById(freshA.id))?.disabledCode, undefined);
      assert.strictEqual((await ctx.findById(freshB.id))?.disabledCode, undefined);

      // Expired guard: the sweep reconciles it normally (oldest disabled).
      assert.strictEqual(
        (await ctx.findById(expiredA.id))?.disabledCode,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
      assert.strictEqual(
        (await ctx.findById(expiredB.id))?.disabledCode,
        undefined,
      );
    });
  });

  describe("mutation-triggered enforcement", () => {
    it("re-enables a workspace feed after deleting another workspace feed", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      const active = await ctx.createWorkspaceFeed(workspace.id);
      const disabled = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setDisabledCode(
        disabled.id,
        UserFeedDisabledCode.ExceededFeedLimit,
      );

      await ctx.service.deleteFeedById(active.id);

      assert.strictEqual(
        (await ctx.findById(disabled.id))?.disabledCode,
        undefined,
      );
    });

    it("disables the oldest feed and digests when bulk enable pushes the workspace over limit", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      const oldest = await ctx.createWorkspaceFeed(workspace.id);
      const manuallyDisabled = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setCreatedAt(oldest.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(manuallyDisabled.id, new Date("2021-01-01"));
      await ctx.setDisabledCode(
        manuallyDisabled.id,
        UserFeedDisabledCode.Manual,
      );

      await ctx.service.bulkEnable([manuallyDisabled.id]);

      assert.strictEqual(
        (await ctx.findById(manuallyDisabled.id))?.disabledCode,
        undefined,
      );
      assert.strictEqual(
        (await ctx.findById(oldest.id))?.disabledCode,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
      assert.strictEqual(ctx.workspaceDigests.length, 1);
      assert.deepStrictEqual(
        ctx.workspaceDigests[0]!.disabledFeeds.map((f) => f.id),
        [oldest.id],
      );
    });

    it("re-enables a workspace feed after bulk disabling another", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      const active = await ctx.createWorkspaceFeed(workspace.id);
      const disabled = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setDisabledCode(
        disabled.id,
        UserFeedDisabledCode.ExceededFeedLimit,
      );

      await ctx.service.bulkDisable([active.id]);

      assert.strictEqual(
        (await ctx.findById(active.id))?.disabledCode,
        UserFeedDisabledCode.Manual,
      );
      assert.strictEqual(
        (await ctx.findById(disabled.id))?.disabledCode,
        undefined,
      );
    });

    it("does not let personal-feed enforcement touch workspace feeds", async () => {
      const ctx = harness.createContext({
        maxUserFeeds: 1,
        defaultMaxUserFeeds: 1,
        workspaceMaxFeeds: 5,
      });
      const workspace = await ctx.createWorkspace();

      const wsFeed = await ctx.createWorkspaceFeed(workspace.id);
      const personal1 = await ctx.createFeed();
      const personal2 = await ctx.createFeed();
      await ctx.setCreatedAt(wsFeed.id, new Date("2019-01-01"));
      await ctx.setCreatedAt(personal1.id, new Date("2020-01-01"));
      await ctx.setCreatedAt(personal2.id, new Date("2021-01-01"));

      await ctx.service.enforceUserFeedLimit(ctx.discordUserId);

      // The oldest PERSONAL feed is disabled; the older workspace feed is not.
      assert.strictEqual(
        (await ctx.findById(wsFeed.id))?.disabledCode,
        undefined,
      );
      assert.strictEqual(
        (await ctx.findById(personal1.id))?.disabledCode,
        UserFeedDisabledCode.ExceededFeedLimit,
      );
    });

    it("blocks enabling a workspace feed via update when the workspace is at its limit", async () => {
      const ctx = harness.createContext({ workspaceMaxFeeds: 1 });
      const workspace = await ctx.createWorkspace();

      await ctx.createWorkspaceFeed(workspace.id);
      const disabled = await ctx.createWorkspaceFeed(workspace.id);
      await ctx.setDisabledCode(disabled.id, UserFeedDisabledCode.Manual);

      await assert.rejects(
        ctx.service.updateFeedById(
          { id: disabled.id, disabledCode: UserFeedDisabledCode.Manual },
          { disabledCode: null },
        ),
        FeedLimitReachedException,
      );
    });
  });
});
