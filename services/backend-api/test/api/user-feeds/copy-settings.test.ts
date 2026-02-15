import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { UserFeedManagerStatus } from "../../../src/repositories/shared/enums";
import { UserFeedCopyableSetting } from "../../../src/services/user-feeds/types";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

describe(
  "POST /api/v1/user-feeds/:feedId/copy-settings",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/copy-settings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedIds: [generateTestId()],
          }),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed ID", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const nonExistentId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${nonExistentId}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedIds: [generateTestId()],
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for feed owned by another user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(otherDiscordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Another User Feed",
        url: "https://example.com/copy-settings-not-owned.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedIds: [generateTestId()],
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 when settings field is missing", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for Missing Settings",
        url: "https://example.com/copy-settings-missing.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            targetFeedIds: [generateTestId()],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for invalid enum value in settings", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for Invalid Settings",
        url: "https://example.com/copy-settings-invalid-enum.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: ["invalidSetting"],
            targetFeedIds: [generateTestId()],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when targetFeedSelectionType is omitted and no targetFeedIds", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for No Targets",
        url: "https://example.com/copy-settings-no-targets.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when targetFeedSelectionType is selected and no targetFeedIds", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for Selected No Targets",
        url: "https://example.com/copy-settings-selected-no-targets.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedSelectionType: "selected",
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 204 with targetFeedIds (specific targets)", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source Feed",
        url: "https://example.com/copy-settings-source.xml",
        user: { id: generateTestId(), discordUserId },
        passingComparisons: ["title"],
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target Feed",
        url: "https://example.com/copy-settings-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);
    });

    it("returns 204 with targetFeedSelectionType all", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source Feed All",
        url: "https://example.com/copy-settings-source-all.xml",
        user: { id: generateTestId(), discordUserId },
        passingComparisons: ["title"],
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedSelectionType: "all",
          }),
        },
      );
      assert.strictEqual(response.status, 204);
    });

    it("copies passingComparisons to target feed", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source Feed DB Check",
        url: "https://example.com/copy-settings-db-source.xml",
        user: { id: generateTestId(), discordUserId },
        passingComparisons: ["title"],
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target Feed DB Check",
        url: "https://example.com/copy-settings-db-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updatedTarget = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updatedTarget);
      assert.deepStrictEqual(updatedTarget.passingComparisons, ["title"]);
    });

    it("returns 204 when accepted shared manager copies settings", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(sharedManagerDiscordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Copy Settings",
        url: "https://example.com/copy-settings-shared.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        passingComparisons: ["title"],
        shareManageOptions: {
          invites: [
            {
              discordUserId: sharedManagerDiscordUserId,
              status: UserFeedManagerStatus.Accepted,
            },
          ],
        },
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target Feed Shared",
        url: "https://example.com/copy-settings-shared-target.xml",
        user: {
          id: generateTestId(),
          discordUserId: sharedManagerDiscordUserId,
        },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);
    });

    it("returns 204 when admin copies settings on another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(adminDiscordUserId);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Admin Copy Settings Feed",
        url: "https://example.com/copy-settings-admin.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
        passingComparisons: ["title"],
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedSelectionType: "all",
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("copies blockingComparisons to target feed", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source BlockingComp",
        url: "https://example.com/copy-blocking-source.xml",
        user: { id: generateTestId(), discordUserId },
        blockingComparisons: ["guid", "link"],
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target BlockingComp",
        url: "https://example.com/copy-blocking-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.BlockingComparisons],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updated);
      assert.deepStrictEqual(updated.blockingComparisons, ["guid", "link"]);
    });

    it("copies externalProperties with regenerated IDs", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceExtProps = [
        {
          id: generateTestId(),
          sourceField: "title",
          cssSelector: ".headline",
          label: "Headline",
        },
        {
          id: generateTestId(),
          sourceField: "description",
          cssSelector: ".summary",
          label: "Summary",
        },
      ];

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source ExtProps",
        url: "https://example.com/copy-extprops-source.xml",
        user: { id: generateTestId(), discordUserId },
        externalProperties: sourceExtProps,
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target ExtProps",
        url: "https://example.com/copy-extprops-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.ExternalProperties],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updated);
      assert.ok(updated.externalProperties);
      assert.strictEqual(updated.externalProperties.length, 2);

      const prop0 = updated.externalProperties[0]!;
      const prop1 = updated.externalProperties[1]!;

      assert.strictEqual(prop0.sourceField, "title");
      assert.strictEqual(prop0.cssSelector, ".headline");
      assert.strictEqual(prop0.label, "Headline");
      assert.notStrictEqual(prop0.id, sourceExtProps[0]!.id);

      assert.strictEqual(prop1.sourceField, "description");
      assert.notStrictEqual(prop1.id, sourceExtProps[1]!.id);
    });

    it("copies dateCheckOptions to target feed", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source DateChecks",
        url: "https://example.com/copy-datechecks-source.xml",
        user: { id: generateTestId(), discordUserId },
        dateCheckOptions: { oldArticleDateDiffMsThreshold: 86400000 },
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target DateChecks",
        url: "https://example.com/copy-datechecks-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.DateChecks],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updated);
      assert.deepStrictEqual(updated.dateCheckOptions, {
        oldArticleDateDiffMsThreshold: 86400000,
      });
    });

    it("copies datePlaceholderSettings to target feed", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source DatePlaceholder",
        url: "https://example.com/copy-dateplaceholder-source.xml",
        user: { id: generateTestId(), discordUserId },
        formatOptions: {
          dateFormat: "YYYY-MM-DD",
          dateTimezone: "America/New_York",
          dateLocale: "fr",
        },
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target DatePlaceholder",
        url: "https://example.com/copy-dateplaceholder-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.DatePlaceholderSettings],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updated);
      assert.ok(updated.formatOptions);
      assert.strictEqual(updated.formatOptions.dateFormat, "YYYY-MM-DD");
      assert.strictEqual(
        updated.formatOptions.dateTimezone,
        "America/New_York",
      );
      assert.strictEqual(updated.formatOptions.dateLocale, "fr");
    });

    it("copies refreshRate to target feed", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source RefreshRate",
        url: "https://example.com/copy-refreshrate-source.xml",
        user: { id: generateTestId(), discordUserId },
        userRefreshRateSeconds: 120,
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target RefreshRate",
        url: "https://example.com/copy-refreshrate-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.RefreshRate],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updated);
      assert.strictEqual(updated.userRefreshRateSeconds, 120);
    });

    it("unsets refreshRate on target when source has none", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source No RefreshRate",
        url: "https://example.com/copy-norefreshrate-source.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target Has RefreshRate",
        url: "https://example.com/copy-norefreshrate-target.xml",
        user: { id: generateTestId(), discordUserId },
        userRefreshRateSeconds: 300,
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.RefreshRate],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updated);
      assert.strictEqual(updated.userRefreshRateSeconds, undefined);
    });

    it("copies connections with regenerated IDs", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceConnectionId = generateTestId();
      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source Connections",
        url: "https://example.com/copy-connections-source.xml",
        user: { id: generateTestId(), discordUserId },
        connections: {
          discordChannels: [
            {
              id: sourceConnectionId,
              name: "Test Connection",
              details: {
                embeds: [],
                formatter: {},
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never,
          ],
        },
      });

      const targetFeed = await ctx.container.userFeedRepository.create({
        title: "Target Connections",
        url: "https://example.com/copy-connections-target.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.Connections],
            targetFeedIds: [targetFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        targetFeed.id,
      );
      assert.ok(updated);
      assert.strictEqual(updated.connections.discordChannels.length, 1);
      const copiedConn = updated.connections.discordChannels[0]!;
      assert.strictEqual(copiedConn.name, "Test Connection");
      assert.notStrictEqual(copiedConn.id, sourceConnectionId);
    });

    it("copies settings to all feeds with targetFeedSelectionType all", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source All Targets",
        url: "https://example.com/copy-all-source.xml",
        user: { id: generateTestId(), discordUserId },
        blockingComparisons: ["guid"],
      });

      const targetFeed1 = await ctx.container.userFeedRepository.create({
        title: "Target All 1",
        url: "https://example.com/copy-all-target1.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const targetFeed2 = await ctx.container.userFeedRepository.create({
        title: "Target All 2",
        url: "https://example.com/copy-all-target2.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.BlockingComparisons],
            targetFeedSelectionType: "all",
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated1 = await ctx.container.userFeedRepository.findById(
        targetFeed1.id,
      );
      const updated2 = await ctx.container.userFeedRepository.findById(
        targetFeed2.id,
      );
      assert.ok(updated1);
      assert.ok(updated2);
      assert.deepStrictEqual(updated1.blockingComparisons, ["guid"]);
      assert.deepStrictEqual(updated2.blockingComparisons, ["guid"]);

      const sourceAfter = await ctx.container.userFeedRepository.findById(
        sourceFeed.id,
      );
      assert.ok(sourceAfter);
      assert.deepStrictEqual(sourceAfter.blockingComparisons, ["guid"]);
    });

    it("does not copy settings to feeds owned by other users", async () => {
      const discordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source Ownership Check",
        url: "https://example.com/copy-ownership-source.xml",
        user: { id: generateTestId(), discordUserId },
        passingComparisons: ["title"],
      });

      const otherUserFeed = await ctx.container.userFeedRepository.create({
        title: "Other User Feed",
        url: "https://example.com/copy-ownership-other.xml",
        user: { id: generateTestId(), discordUserId: otherDiscordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedIds: [otherUserFeed.id],
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updated = await ctx.container.userFeedRepository.findById(
        otherUserFeed.id,
      );
      assert.ok(updated);
      assert.strictEqual(updated.passingComparisons?.length, 0);
    });

    it("filters target feeds by search when using targetFeedSelectionType all", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const uniqueTag = generateTestId();

      const sourceFeed = await ctx.container.userFeedRepository.create({
        title: "Source Search Filter",
        url: "https://example.com/copy-search-source.xml",
        user: { id: generateTestId(), discordUserId },
        passingComparisons: ["title"],
      });

      const matchingFeed = await ctx.container.userFeedRepository.create({
        title: `Matching ${uniqueTag}`,
        url: "https://example.com/copy-search-matching.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const nonMatchingFeed = await ctx.container.userFeedRepository.create({
        title: "Non Matching Feed",
        url: "https://example.com/copy-search-nonmatching.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${sourceFeed.id}/copy-settings`,
        {
          method: "POST",
          body: JSON.stringify({
            settings: [UserFeedCopyableSetting.PassingComparisons],
            targetFeedSelectionType: "all",
            targetFeedSearch: uniqueTag,
          }),
        },
      );
      assert.strictEqual(response.status, 204);

      const updatedMatching = await ctx.container.userFeedRepository.findById(
        matchingFeed.id,
      );
      assert.ok(updatedMatching);
      assert.deepStrictEqual(updatedMatching.passingComparisons, ["title"]);

      const updatedNonMatching =
        await ctx.container.userFeedRepository.findById(nonMatchingFeed.id);
      assert.ok(updatedNonMatching);
      assert.strictEqual(updatedNonMatching.passingComparisons?.length, 0);
    });
  },
);
