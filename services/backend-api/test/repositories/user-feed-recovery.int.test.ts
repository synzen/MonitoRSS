import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import {
  UserFeedComputedStatus,
} from "../../src/repositories/interfaces/user-feed.types";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../src/repositories/shared/enums";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "../helpers/test-context";
import { generateSnowflake, generateTestId } from "../helpers/test-id";

const REFRESH_RATE_SECONDS = 600;

describe("UserFeedMongooseRepository bulk recovery state transitions", () => {
  let ctx: ServiceTestContext;
  let repository: UserFeedMongooseRepository;

  before(async () => {
    ctx = await createServiceTestContext();
    repository = new UserFeedMongooseRepository(ctx.connection);
  });

  after(() => ctx.teardown());

  async function createFeed(input: { url: string; title: string }) {
    const feed = await repository.create({
      title: input.title,
      inputUrl: input.url,
      url: input.url,
      user: { id: generateTestId(), discordUserId: generateSnowflake() },
      refreshRateSeconds: REFRESH_RATE_SECONDS,
      slotOffsetMs: 0,
    } as never);

    await repository.updateById(feed.id, {
      $set: {
        "connections.discordChannels": [
          {
            id: generateTestId(),
            name: "Test Channel",
            details: { embeds: [], formatter: {} },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    });

    return feed.id;
  }

  async function setRawFields(id: string, fields: Record<string, unknown>) {
    await repository.updateById(id, { $set: fields });
  }

  const slotWindow = {
    windowStartMs: 0,
    windowEndMs: REFRESH_RATE_SECONDS * 1000,
    wrapsAroundInterval: false,
    refreshRateMs: REFRESH_RATE_SECONDS * 1000,
  };

  it("computes a recovering feed as Pending Retry while it stays disabled for delivery", async () => {
    const discordUserId = generateSnowflake();
    const url = `https://example.com/recovery-status-${generateTestId()}.xml`;
    const feed = await repository.create({
      title: "Recovering feed",
      inputUrl: url,
      url,
      user: { id: generateTestId(), discordUserId },
      refreshRateSeconds: REFRESH_RATE_SECONDS,
      slotOffsetMs: 0,
    } as never);

    await setRawFields(feed.id, {
      disabledCode: UserFeedDisabledCode.FailedRequests,
      healthStatus: UserFeedHealthStatus.Failing,
      recoveryStartedAt: new Date(),
    });

    const listing = await repository.getUserFeedsListing({
      discordUserId,
      limit: 100,
      offset: 0,
    });
    const statusOf = listing.find((item) => item.id === feed.id)
      ?.computedStatus;

    assert.strictEqual(statusOf, UserFeedComputedStatus.Retrying);
  });

  it("keeps recovery feeds schedulable but not deliverable", async () => {
    const sharedUrl = `https://example.com/recovery-${generateTestId()}.xml`;
    const recoveryStartedAt = new Date(Date.now() - 5_000);

    const recoveryFeedId = await createFeed({
      url: sharedUrl,
      title: "Recovering feed",
    });
    await setRawFields(recoveryFeedId, {
      disabledCode: UserFeedDisabledCode.FailedRequests,
      healthStatus: UserFeedHealthStatus.Failing,
      recoveryStartedAt,
    });

    const terminalFeedId = await createFeed({
      url: sharedUrl,
      title: "Terminally failed feed",
    });
    await setRawFields(terminalFeedId, {
      disabledCode: UserFeedDisabledCode.FailedRequests,
      healthStatus: UserFeedHealthStatus.Failed,
    });

    const healthyFeedId = await createFeed({
      url: sharedUrl,
      title: "Healthy feed",
    });

    const delivered: string[] = [];

    for await (const feed of repository.iterateFeedsForDelivery({
      url: sharedUrl,
      refreshRateSeconds: REFRESH_RATE_SECONDS,
    })) {
      delivered.push(feed.id);
    }

    assert.ok(delivered.includes(healthyFeedId));
    assert.ok(!delivered.includes(recoveryFeedId));
    assert.ok(!delivered.includes(terminalFeedId));

    const scheduledUrls: Array<{
      url: string;
      recoveryStartedAt?: number;
    }> = [];

    for await (const item of repository.iterateUrlsForRefreshRate(
      REFRESH_RATE_SECONDS,
      slotWindow,
    )) {
      if (item.url === sharedUrl) {
        scheduledUrls.push(item);
      }
    }

    assert.strictEqual(scheduledUrls.length, 1);
    assert.strictEqual(
      scheduledUrls[0].recoveryStartedAt,
      recoveryStartedAt.getTime(),
    );
  });

  it("drops a recovery feed from scheduling once it reverts to the terminal state", async () => {
    const url = `https://example.com/recovery-revert-${generateTestId()}.xml`;
    const recoveryFeedId = await createFeed({ url, title: "Recovering feed" });
    await setRawFields(recoveryFeedId, {
      disabledCode: UserFeedDisabledCode.FailedRequests,
      healthStatus: UserFeedHealthStatus.Failing,
      recoveryStartedAt: new Date(Date.now() - 5_000),
    });

    await repository.revertRecoveryFeedsToFailed({ url });

    const reverted = await repository.findById(recoveryFeedId);

    assert.ok(reverted);
    assert.strictEqual(reverted.healthStatus, UserFeedHealthStatus.Failed);
    assert.strictEqual(
      reverted.disabledCode,
      UserFeedDisabledCode.FailedRequests,
    );
    assert.ok(!reverted.recoveryStartedAt);

    const scheduledUrls: string[] = [];

    for await (const item of repository.iterateUrlsForRefreshRate(
      REFRESH_RATE_SECONDS,
      slotWindow,
    )) {
      scheduledUrls.push(item.url);
    }

    assert.ok(!scheduledUrls.includes(url));
  });

  it("restores a recovered feed to delivery eligibility without stale recovery state", async () => {
    const lookupKey = `recovery-lookup-${generateTestId()}`;
    const url = `https://example.com/recovery-restored-${generateTestId()}.xml`;
    const feedId = await repository.create({
      title: "Recovering feed",
      inputUrl: url,
      url,
      user: { id: generateTestId(), discordUserId: generateSnowflake() },
      refreshRateSeconds: REFRESH_RATE_SECONDS,
      slotOffsetMs: 0,
      feedRequestLookupKey: lookupKey,
    } as never).then(async (feed) => {
      await repository.updateById(feed.id, {
        $set: {
          "connections.discordChannels": [
            {
              id: generateTestId(),
              name: "Test Channel",
              details: { embeds: [], formatter: {} },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      });
      return feed.id;
    });

    await setRawFields(feedId, {
      disabledCode: UserFeedDisabledCode.FailedRequests,
      healthStatus: UserFeedHealthStatus.Failing,
      recoveryStartedAt: new Date(Date.now() - 5_000),
    });

    const deliveredBefore: string[] = [];

    for await (const feed of repository.iterateFeedsWithLookupKeysForDelivery({
      lookupKey,
      refreshRateSeconds: REFRESH_RATE_SECONDS,
    })) {
      deliveredBefore.push(feed.id);
    }

    assert.ok(!deliveredBefore.includes(feedId));

    await repository.clearDisabledCodeForRecoveredFeeds({ lookupKey });

    const restored = await repository.findById(feedId);

    assert.ok(restored);
    assert.strictEqual(restored.healthStatus, UserFeedHealthStatus.Ok);
    assert.ok(!restored.disabledCode);
    assert.ok(!restored.recoveryStartedAt);

    const deliveredAfter: string[] = [];

    for await (const feed of repository.iterateFeedsWithLookupKeysForDelivery({
      lookupKey,
      refreshRateSeconds: REFRESH_RATE_SECONDS,
    })) {
      deliveredAfter.push(feed.id);
    }

    assert.ok(deliveredAfter.includes(feedId));
  });
});
