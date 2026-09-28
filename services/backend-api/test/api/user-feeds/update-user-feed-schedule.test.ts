import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

const SCHEDULED_PAYLOAD = {
  scheduleMode: "scheduled",
  schedule: { times: ["09:00", "21:00"], timezone: "Asia/Shanghai" },
};

interface ScheduleResponseBody {
  result: {
    scheduleMode: string;
    schedule: { times: string[]; timezone: string; days?: number[] } | null;
    userRefreshRateSeconds?: number;
  };
}

async function createFeedForUser(discordUserId: string, title: string) {
  return ctx.container.userFeedRepository.create({
    title,
    url: `https://example.com/${title.toLowerCase().replace(/\s+/g, "-")}.xml`,
    user: { id: generateTestId(), discordUserId },
  });
}

describe("PATCH /api/v1/user-feeds/:feedId schedule validation", { concurrency: true }, () => {
  it("accepts a valid scheduled-mode payload and echoes the normalized schedule", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Accept");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...SCHEDULED_PAYLOAD,
        schedule: { times: ["21:00", "09:00"], timezone: "Asia/Shanghai" },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as ScheduleResponseBody;
    assert.strictEqual(body.result.scheduleMode, "scheduled");
    assert.deepStrictEqual(body.result.schedule, {
      times: ["09:00", "21:00"],
      timezone: "Asia/Shanghai",
    });
  });

  it("accepts a schedule at the cap of 10 times", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Cap");

    const times = Array.from({ length: 10 }, (_, i) =>
      `0${i % 10}:00`.slice(-5),
    );

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times, timezone: "UTC" },
      }),
    });

    assert.strictEqual(response.status, 200);
  });

  it("rejects a time with a bad format", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Bad Format");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["9:00"], timezone: "UTC" },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects an out-of-range time", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Out Of Range");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["24:00"], timezone: "UTC" },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects more than 10 times", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Too Many");

    const times = Array.from({ length: 11 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times, timezone: "UTC" },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects duplicate times", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Duplicates");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00", "09:00"], timezone: "UTC" },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects an unknown timezone", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Bad Timezone");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00"], timezone: "Mars/Olympus_Mons" },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects a schedule object without scheduleMode", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Missing Mode");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        schedule: { times: ["09:00"], timezone: "UTC" },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects scheduleMode scheduled without a schedule object", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Mode Only");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduleMode: "scheduled" }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects scheduleMode interval with a schedule object", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Interval With Schedule");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "interval",
        schedule: { times: ["09:00"], timezone: "UTC" },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("accepts days and echoes them normalized and sorted", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Days Accept");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: {
          times: ["09:00"],
          timezone: "UTC",
          days: [3, 0, 1],
        },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as ScheduleResponseBody;
    assert.deepStrictEqual(body.result.schedule?.days, [0, 1, 3]);
  });

  it("rejects duplicate days", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Days Duplicates");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00"], timezone: "UTC", days: [1, 1] },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("treats an empty days array as every day by omitting it", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Days Empty");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00"], timezone: "UTC", days: [] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as ScheduleResponseBody;
    assert.strictEqual(body.result.schedule?.days, undefined);
  });

  it("rejects a weekday outside 0-6", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Days Range");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00"], timezone: "UTC", days: [7] },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects more than 7 days", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Days Cap");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: {
          times: ["09:00"],
          timezone: "UTC",
          days: [0, 1, 2, 3, 4, 5, 6, 0],
        },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("rejects non-integer weekdays", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Days Non Integer");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00"], timezone: "UTC", days: [1.5] },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  it("preserves the interval value through a round trip into and out of scheduled mode", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Round Trip");

    const setRate = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ userRefreshRateSeconds: 900 }),
    });
    assert.strictEqual(setRate.status, 200);

    const toScheduled = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify(SCHEDULED_PAYLOAD),
    });
    assert.strictEqual(toScheduled.status, 200);

    const toInterval = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduleMode: "interval" }),
    });
    assert.strictEqual(toInterval.status, 200);
    const body = (await toInterval.json()) as ScheduleResponseBody;
    assert.strictEqual(body.result.scheduleMode, "interval");
    assert.strictEqual(body.result.schedule, null);
    assert.strictEqual(body.result.userRefreshRateSeconds, 900);

    const persisted = (await ctx.container.userFeedRepository.findById(
      feed.id,
    ))!;
    assert.strictEqual(persisted.scheduleMode, undefined);
    assert.strictEqual(persisted.schedule, undefined);
    assert.strictEqual(persisted.userRefreshRateSeconds, 900);
  });

  it("defaults scheduleMode to interval on feeds with no schedule fields", async () => {
    const discordUserId = generateSnowflake();
    const user = await ctx.asUser(discordUserId);
    const feed = await createFeedForUser(discordUserId, "Schedule Default Mode");

    const response = await user.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as ScheduleResponseBody;
    assert.strictEqual(body.result.scheduleMode, "interval");
    assert.strictEqual(body.result.schedule, null);
  });
});
