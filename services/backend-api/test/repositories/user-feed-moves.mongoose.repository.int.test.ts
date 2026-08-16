import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { Types } from "mongoose";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import {
  PersonalFeedMoveCapacityExceededError,
  PersonalFeedMoveFeedMissingError,
  PersonalFeedMoveInvalidSelectionError,
  PersonalFeedMoveOwnershipChangedError,
} from "../../src/repositories/interfaces/user-feed.types";
import {
  UserFeedDisabledCode,
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "../helpers/test-context";
import { generateSnowflake, generateTestId } from "../helpers/test-id";

describe("UserFeedMongooseRepository personal feed moves", () => {
  let ctx: ServiceTestContext;
  let repository: UserFeedMongooseRepository;

  before(async () => {
    ctx = await createServiceTestContext();
    repository = new UserFeedMongooseRepository(ctx.connection);
  });

  after(() => ctx.teardown());

  async function createWorkspace(): Promise<string> {
    const workspaceId = new Types.ObjectId();
    await ctx.connection.collection("workspaces").insertOne({
      _id: workspaceId,
      name: "Feed move destination",
      slug: `feed-move-${generateTestId()}`,
      createdByUserId: new Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return workspaceId.toString();
  }

  it("moves owned personal feeds in place and clears personal sharing", async () => {
    const discordUserId = generateSnowflake();
    const creatorUserId = generateTestId();
    const workspaceId = await createWorkspace();
    const connectionId = generateTestId();
    const feed = await repository.create({
      title: "Preserved title",
      inputUrl: "https://example.com/original.xml",
      url: "https://example.com/resolved.xml",
      user: { id: creatorUserId, discordUserId },
      disabledCode: UserFeedDisabledCode.Manual,
      passingComparisons: ["title contains release"],
      blockingComparisons: ["title contains beta"],
      formatOptions: { dateFormat: "YYYY-MM-DD", dateTimezone: "UTC" },
      connections: {
        discordChannels: [
          {
            id: connectionId,
            name: "Announcements",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            details: { embeds: [], formatter: { content: "{{title}}" } },
          } as never,
        ],
      },
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
            connections: [{ connectionId }],
          },
        ],
      },
    } as never);
    const beforeMove = await repository.findById(feed.id);

    const receipt = await repository.movePersonalFeedsToWorkspace({
      feedIds: [feed.id],
      discordUserId,
      workspaceId,
      maxWorkspaceFeeds: 1,
    });

    const moved = await repository.findById(feed.id);
    assert.ok(beforeMove);
    assert.ok(moved);
    assert.strictEqual(moved.id, beforeMove.id);
    assert.strictEqual(moved.workspaceId, workspaceId);
    assert.strictEqual(moved.user.id, creatorUserId);
    assert.strictEqual(moved.user.discordUserId, discordUserId);
    assert.strictEqual(moved.title, beforeMove.title);
    assert.strictEqual(moved.inputUrl, beforeMove.inputUrl);
    assert.strictEqual(moved.url, beforeMove.url);
    assert.strictEqual(moved.disabledCode, beforeMove.disabledCode);
    assert.strictEqual(moved.healthStatus, beforeMove.healthStatus);
    assert.deepStrictEqual(
      moved.passingComparisons,
      beforeMove.passingComparisons,
    );
    assert.deepStrictEqual(
      moved.blockingComparisons,
      beforeMove.blockingComparisons,
    );
    assert.deepStrictEqual(moved.formatOptions, beforeMove.formatOptions);
    assert.deepStrictEqual(moved.connections, beforeMove.connections);
    assert.strictEqual(moved.shareManageOptions, undefined);
    assert.deepStrictEqual(
      receipt.feeds[0]?.shareManageOptions,
      beforeMove.shareManageOptions,
    );
  });

  it("restores personal ownership and sharing from a move receipt", async () => {
    const discordUserId = generateSnowflake();
    const workspaceId = await createWorkspace();
    const feed = await repository.create({
      title: "Shared feed",
      url: "https://example.com/shared.xml",
      user: { id: generateTestId(), discordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: generateSnowflake(),
            type: UserFeedManagerInviteType.CoManage,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });
    const original = await repository.findById(feed.id);
    const receipt = await repository.movePersonalFeedsToWorkspace({
      feedIds: [feed.id],
      discordUserId,
      workspaceId,
      maxWorkspaceFeeds: 1,
    });

    await repository.restorePersonalFeedsFromWorkspace(receipt);

    const restored = await repository.findById(feed.id);
    assert.strictEqual(restored?.workspaceId, undefined);
    assert.deepStrictEqual(
      restored?.shareManageOptions,
      original?.shareManageOptions,
    );
  });

  it("rejects an invalid batch without moving any selected feed", async () => {
    const discordUserId = generateSnowflake();
    const workspaceId = await createWorkspace();
    const ownedFeed = await repository.create({
      title: "Owned feed",
      url: "https://example.com/owned.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const otherUsersFeed = await repository.create({
      title: "Other user's feed",
      url: "https://example.com/other.xml",
      user: { id: generateTestId(), discordUserId: generateSnowflake() },
      shareManageOptions: {
        invites: [
          {
            discordUserId,
            type: UserFeedManagerInviteType.CoManage,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    await assert.rejects(
      repository.movePersonalFeedsToWorkspace({
        feedIds: [ownedFeed.id, otherUsersFeed.id],
        discordUserId,
        workspaceId,
        maxWorkspaceFeeds: 2,
      }),
      (error) => error instanceof PersonalFeedMoveOwnershipChangedError,
    );

    assert.strictEqual(
      (await repository.findById(ownedFeed.id))?.workspaceId,
      undefined,
    );
    assert.strictEqual(
      (await repository.findById(otherUsersFeed.id))?.workspaceId,
      undefined,
    );
  });

  it("rejects missing, malformed, duplicate, and already-workspace-owned feeds", async () => {
    const discordUserId = generateSnowflake();
    const workspaceId = await createWorkspace();
    const feed = await repository.create({
      title: "Selected feed",
      url: "https://example.com/selected.xml",
      user: { id: generateTestId(), discordUserId },
    });
    const workspaceFeed = await repository.create({
      title: "Already moved",
      url: "https://example.com/already-moved.xml",
      user: { id: generateTestId(), discordUserId },
      workspaceId,
    });

    for (const [feedIds, expectedError] of [
      [[generateTestId()], PersonalFeedMoveFeedMissingError],
      [["not-an-object-id"], PersonalFeedMoveInvalidSelectionError],
      [[feed.id, feed.id], PersonalFeedMoveInvalidSelectionError],
      [[workspaceFeed.id], PersonalFeedMoveOwnershipChangedError],
    ] as const) {
      await assert.rejects(
        repository.movePersonalFeedsToWorkspace({
          feedIds: [...feedIds],
          discordUserId,
          workspaceId,
          maxWorkspaceFeeds: 5,
        }),
        (error) => error instanceof expectedError,
      );
    }

    assert.strictEqual(
      (await repository.findById(feed.id))?.workspaceId,
      undefined,
    );
    assert.strictEqual(
      (await repository.findById(workspaceFeed.id))?.workspaceId,
      workspaceId,
    );
  });

  it("rechecks total workspace document capacity inside the move", async () => {
    const discordUserId = generateSnowflake();
    const workspaceId = await createWorkspace();
    const disabledWorkspaceFeed = await repository.create({
      title: "Disabled workspace feed",
      url: "https://example.com/existing.xml",
      user: { id: generateTestId(), discordUserId },
      workspaceId,
    });
    await repository.updateById(disabledWorkspaceFeed.id, {
      $set: { disabledCode: UserFeedDisabledCode.Manual },
    });
    const feeds = await Promise.all(
      ["a", "b"].map((suffix) =>
        repository.create({
          title: `Personal ${suffix}`,
          url: `https://example.com/${suffix}.xml`,
          user: { id: generateTestId(), discordUserId },
        }),
      ),
    );

    await assert.rejects(
      repository.movePersonalFeedsToWorkspace({
        feedIds: feeds.map((feed) => feed.id),
        discordUserId,
        workspaceId,
        maxWorkspaceFeeds: 2,
      }),
      (error) => error instanceof PersonalFeedMoveCapacityExceededError,
    );

    assert.deepStrictEqual(
      await Promise.all(
        feeds.map(
          async (feed) => (await repository.findById(feed.id))?.workspaceId,
        ),
      ),
      [undefined, undefined],
    );
  });

  it("serializes concurrent moves so only one batch can claim the last slot", async () => {
    const discordUserId = generateSnowflake();
    const workspaceId = await createWorkspace();
    const feeds = await Promise.all(
      ["first", "second"].map((suffix) =>
        repository.create({
          title: suffix,
          url: `https://example.com/${suffix}.xml`,
          user: { id: generateTestId(), discordUserId },
        }),
      ),
    );

    const results = await Promise.allSettled(
      feeds.map((feed) =>
        repository.movePersonalFeedsToWorkspace({
          feedIds: [feed.id],
          discordUserId,
          workspaceId,
          maxWorkspaceFeeds: 1,
        }),
      ),
    );

    assert.strictEqual(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.strictEqual(
      results.filter(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof PersonalFeedMoveCapacityExceededError,
      ).length,
      1,
    );
    assert.strictEqual(await repository.countByWorkspace(workspaceId), 1);
  });

  it("serializes a move against concurrent workspace feed creation", async () => {
    const discordUserId = generateSnowflake();
    const workspaceId = await createWorkspace();
    const feedToMove = await repository.create({
      title: "Move contender",
      url: "https://example.com/move.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const results = await Promise.allSettled([
      repository.movePersonalFeedsToWorkspace({
        feedIds: [feedToMove.id],
        discordUserId,
        workspaceId,
        maxWorkspaceFeeds: 1,
      }),
      repository.createWithLimitEnforcement(
        {
          title: "Create contender",
          url: "https://example.com/create.xml",
          user: { id: generateTestId(), discordUserId },
          workspaceId,
        },
        { scope: "workspace", workspaceId, maxFeeds: 1 },
      ),
    ]);

    assert.strictEqual(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.strictEqual(await repository.countByWorkspace(workspaceId), 1);
  });
});
