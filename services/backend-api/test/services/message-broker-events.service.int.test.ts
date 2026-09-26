import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import type { IUserFeed } from "../../src/repositories/interfaces/user-feed.types";
import {
  UserFeedScheduleMode,
  UserFeedHealthStatus,
  UserFeedDisabledCode,
} from "../../src/repositories/shared/enums";
import type { Config } from "../../src/config";
import type { FeedSchedule } from "../../src/shared/utils/scheduled-feed-computation";
import { MessageBrokerEventsService } from "../../src/services/message-broker-events/message-broker-events.service";
import { MessageBrokerQueue } from "../../src/infra/rabbitmq";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "../helpers/test-context";
import { generateTestId } from "../helpers/test-id";

// 21:00 Asia/Shanghai on 2026-09-26 = 13:00 UTC.
const OCCURRENCE = Date.parse("2026-09-26T13:00:00Z");
const FANOUT_NOW = OCCURRENCE + 5 * 60 * 1000;
const SHANGHAI_21 = { times: ["21:00"], timezone: "Asia/Shanghai" };

describe("MessageBrokerEventsService - scheduled fan-out (integration)", () => {
  let ctx: ServiceTestContext;
  let userFeedRepository: UserFeedMongooseRepository;
  let userRepository: UserMongooseRepository;

  before(async () => {
    ctx = await createServiceTestContext();
    userFeedRepository = new UserFeedMongooseRepository(ctx.connection);
    userRepository = new UserMongooseRepository(ctx.connection);
  });

  after(async () => {
    await ctx.teardown();
  });

  interface DepsOverrides {
    now?: () => number;
  }

  function createService(deps: DepsOverrides = {}) {
    const publishMessage = mock.fn(async () => {});

    const service = new MessageBrokerEventsService({
      config: {} as Config,
      connection: ctx.connection,
      userFeedRepository,
      supportersService: {
        resolveFeedBenefits: async () => ({
          maxFeeds: 0,
          maxDailyArticles: 100,
          refreshRateSeconds: 600,
          allowWebhooks: false,
          allowCustomPlaceholders: false,
          allowExternalProperties: false,
          articleRateLimits: [],
          dormant: false,
        }),
      },
      notificationsService: {
        sendDisabledFeedsAlert: async () => {},
        sendDisabledFeedConnectionAlert: async () => {},
      },
      publishMessage: publishMessage as never,
      now: deps.now ?? (() => FANOUT_NOW),
    } as never);

    return { service, publishMessage };
  }

  async function createScheduledFeed(input: {
    url: string;
    schedule?: FeedSchedule;
    feedRequestLookupKey?: string;
    refreshRateSeconds?: number;
  }): Promise<IUserFeed> {
    const discordUserId = generateTestId();
    const user = await userRepository.create({ discordUserId });

    const feed = await userFeedRepository.create({
      title: "Test Feed",
      url: input.url,
      user: { id: user.id, discordUserId },
      refreshRateSeconds: input.refreshRateSeconds ?? 600,
      slotOffsetMs: 0,
      feedRequestLookupKey: input.feedRequestLookupKey,
    });

    await userFeedRepository.updateById(feed.id, {
      $set: {
        scheduleMode: UserFeedScheduleMode.Scheduled,
        schedule: input.schedule ?? SHANGHAI_21,
        "connections.discordChannels": [
          {
            id: generateTestId(),
            name: "Test Channel",
            details: {
              channel: { id: generateTestId(), guildId: generateTestId() },
              embeds: [],
              formatter: {},
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    });

    const updated = await userFeedRepository.findById(feed.id);
    assert.ok(updated);
    return updated;
  }

  async function createIntervalFeed(input: {
    url: string;
    refreshRateSeconds?: number;
  }): Promise<IUserFeed> {
    const discordUserId = generateTestId();
    const user = await userRepository.create({ discordUserId });

    const feed = await userFeedRepository.create({
      title: "Test Feed",
      url: input.url,
      user: { id: user.id, discordUserId },
      refreshRateSeconds: input.refreshRateSeconds ?? 600,
      slotOffsetMs: 0,
    });

    await userFeedRepository.updateById(feed.id, {
      $set: {
        "connections.discordChannels": [
          {
            id: generateTestId(),
            name: "Test Channel",
            details: {
              channel: { id: generateTestId(), guildId: generateTestId() },
              embeds: [],
              formatter: {},
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    });

    const updated = await userFeedRepository.findById(feed.id);
    assert.ok(updated);
    return updated;
  }

  function runFetchCompleted(
    service: MessageBrokerEventsService,
    data: {
      url: string;
      lookupKey?: string;
      rateSeconds?: number;
      trigger?: { kind: "scheduled" | "interval"; occurredAt: number };
    },
  ) {
    return service.handleUrlFetchCompletedEvent({
      data: {
        rateSeconds: 3600,
        ...data,
      } as never,
    });
  }

  function emittedFeedIds(publishMessage: ReturnType<typeof mock.fn>) {
    return publishMessage.mock.calls.map(
      (call) =>
        (call.arguments[1] as { data: { feed: { id: string } } }).data.feed.id,
    );
  }

  it("delivers to the scheduled feed sharing the URL and records the claimed occurrence", async () => {
    const feed = await createScheduledFeed({
      url: `https://example.com/${generateTestId()}.xml`,
    });
    const { service, publishMessage } = createService();

    await runFetchCompleted(service, {
      url: feed.url,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });

    assert.deepStrictEqual(emittedFeedIds(publishMessage), [feed.id]);
    assert.strictEqual(
      publishMessage.mock.calls[0]?.arguments[0],
      MessageBrokerQueue.FeedDeliverArticles,
    );

    const after = await userFeedRepository.findById(feed.id);
    assert.strictEqual(after?.lastScheduledFiredAt?.getTime(), OCCURRENCE);
  });

  it("does not deliver twice for the same occurrence", async () => {
    const feed = await createScheduledFeed({
      url: `https://example.com/${generateTestId()}.xml`,
    });
    const { service, publishMessage } = createService();

    await runFetchCompleted(service, {
      url: feed.url,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });
    await runFetchCompleted(service, {
      url: feed.url,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });

    assert.strictEqual(publishMessage.mock.callCount(), 1);
  });

  it("delivers exactly once when two consumers process the same occurrence concurrently", async () => {
    const feed = await createScheduledFeed({
      url: `https://example.com/${generateTestId()}.xml`,
    });
    const { service, publishMessage } = createService();

    await Promise.all([
      runFetchCompleted(service, {
        url: feed.url,
        trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
      }),
      runFetchCompleted(service, {
        url: feed.url,
        trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
      }),
    ]);

    assert.strictEqual(publishMessage.mock.callCount(), 1);
  });

  it("does not deliver an interval-mode feed sharing the URL via a scheduled trigger", async () => {
    const url = `https://example.com/${generateTestId()}.xml`;
    const scheduledFeed = await createScheduledFeed({ url });
    const intervalFeed = await createIntervalFeed({ url });
    const { service, publishMessage } = createService();

    await runFetchCompleted(service, {
      url,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });

    assert.deepStrictEqual(emittedFeedIds(publishMessage), [scheduledFeed.id]);

    const after = await userFeedRepository.findById(intervalFeed.id);
    assert.strictEqual(after?.lastScheduledFiredAt, undefined);
  });

  it("does not deliver a scheduled feed sharing the URL via an interval trigger", async () => {
    const url = `https://example.com/${generateTestId()}.xml`;
    const scheduledFeed = await createScheduledFeed({ url });
    const intervalFeed = await createIntervalFeed({ url });
    const { service, publishMessage } = createService();

    await runFetchCompleted(service, {
      url,
      rateSeconds: 600,
      trigger: { kind: "interval", occurredAt: Date.now() },
    });

    assert.deepStrictEqual(emittedFeedIds(publishMessage), [intervalFeed.id]);

    const after = await userFeedRepository.findById(scheduledFeed.id);
    assert.strictEqual(after?.lastScheduledFiredAt, undefined);
  });

  it("delivers only the scheduled feed whose lookup key matches the trigger", async () => {
    const url = `https://example.com/${generateTestId()}.xml`;
    const keyedFeed = await createScheduledFeed({
      url,
      feedRequestLookupKey: `lookup-${generateTestId()}`,
    });
    const otherKeyedFeed = await createScheduledFeed({
      url,
      feedRequestLookupKey: `lookup-${generateTestId()}`,
    });
    const { service, publishMessage } = createService();

    await runFetchCompleted(service, {
      url,
      lookupKey: keyedFeed.feedRequestLookupKey,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });

    assert.deepStrictEqual(emittedFeedIds(publishMessage), [keyedFeed.id]);

    const after = await userFeedRepository.findById(otherKeyedFeed.id);
    assert.strictEqual(after?.lastScheduledFiredAt, undefined);
  });

  it("skips scheduled feeds sharing the URL that run a different schedule", async () => {
    const url = `https://example.com/${generateTestId()}.xml`;
    const dueFeed = await createScheduledFeed({ url });
    const otherScheduleFeed = await createScheduledFeed({
      url,
      schedule: { times: ["09:00"], timezone: "Asia/Shanghai" },
    });
    const { service, publishMessage } = createService();

    await runFetchCompleted(service, {
      url,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });

    assert.deepStrictEqual(emittedFeedIds(publishMessage), [dueFeed.id]);

    const after = await userFeedRepository.findById(otherScheduleFeed.id);
    assert.strictEqual(after?.lastScheduledFiredAt, undefined);
  });

  it("rejects scheduled triggers older than the staleness cap", async () => {
    const feed = await createScheduledFeed({
      url: `https://example.com/${generateTestId()}.xml`,
    });
    const { service, publishMessage } = createService({
      now: () => OCCURRENCE + 2 * 60 * 60 * 1000,
    });

    await runFetchCompleted(service, {
      url: feed.url,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });

    assert.strictEqual(publishMessage.mock.callCount(), 0);

    const after = await userFeedRepository.findById(feed.id);
    assert.strictEqual(after?.lastScheduledFiredAt, undefined);
  });

  it("does not deliver disabled scheduled feeds", async () => {
    const feed = await createScheduledFeed({
      url: `https://example.com/${generateTestId()}.xml`,
    });
    await userFeedRepository.updateById(feed.id, {
      $set: {
        disabledCode: UserFeedDisabledCode.FailedRequests,
        healthStatus: UserFeedHealthStatus.Failing,
      },
    });
    const { service, publishMessage } = createService();

    await runFetchCompleted(service, {
      url: feed.url,
      trigger: { kind: "scheduled", occurredAt: OCCURRENCE },
    });

    assert.strictEqual(publishMessage.mock.callCount(), 0);
  });
});
