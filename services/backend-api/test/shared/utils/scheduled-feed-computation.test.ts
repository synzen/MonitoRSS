import { describe, it } from "node:test";
import assert from "node:assert";
import {
  SCHEDULED_CATCHUP_WINDOW_MS,
  SCHEDULER_WINDOW_SIZE_MS,
} from "../../../src/shared/constants/scheduler.constants";
import { fnv1aHash } from "../../../src/shared/utils/fnv1a-hash";
import {
  isScheduledTime,
  selectDueScheduledFeeds,
  type ScheduledFeedClockInput,
} from "../../../src/shared/utils/scheduled-feed-computation";

// Independent oracle for "what wall-clock time is this epoch in this zone" —
// deliberately not the dayjs.tz machinery the implementation uses.
function localHHMM(epochMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(epochMs));

  return parts === "24:00" ? "00:00" : parts;
}

// The spreading slot is keyed by URL, so tests pick URLs with a known slot.
function urlWithSlot(slot: number, base: string): string {
  for (let i = 0; i < 1000; ++i) {
    const url = `https://example.com/${base}-${i}.xml`;

    if (fnv1aHash(url) % 2 === slot) {
      return url;
    }
  }

  throw new Error(`No url found for slot ${slot}`);
}

function makeFeed(
  overrides: Partial<ScheduledFeedClockInput> & { id: string; url: string },
): ScheduledFeedClockInput {
  return {
    schedule: { times: ["21:00"], timezone: "UTC" },
    ...overrides,
  };
}

const SCHEDULED_TIME_2100_UTC = Date.parse("2026-09-26T21:00:00Z");

describe("scheduled-feed-computation", () => {
  describe("selectDueScheduledFeeds - minute matching", () => {
    it("selects a feed at exactly its scheduled local minute", () => {
      const feed = makeFeed({
        id: "match",
        url: urlWithSlot(0, "match"),
        schedule: { times: ["21:00"], timezone: "UTC" },
      });

      const due = selectDueScheduledFeeds([feed], SCHEDULED_TIME_2100_UTC);

      assert.strictEqual(due.length, 1);
      assert.strictEqual(due[0]?.feed.id, feed.id);
      assert.strictEqual(due[0]?.scheduledAt, SCHEDULED_TIME_2100_UTC);
    });

    it("does not select the feed at other times of day", () => {
      const feed = makeFeed({
        id: "other",
        url: urlWithSlot(0, "other"),
      });

      const before = selectDueScheduledFeeds(
        [feed],
        Date.parse("2026-09-26T20:59:00Z"),
      );
      const mid = selectDueScheduledFeeds(
        [feed],
        Date.parse("2026-09-26T22:00:00Z"),
      );

      assert.strictEqual(before.length, 0);
      assert.strictEqual(mid.length, 0);
    });

    it("fires on the second tick of the minute for feeds assigned to it", () => {
      const feed = makeFeed({
        id: "second-tick",
        url: urlWithSlot(1, "second-tick"),
      });

      const firstTick = selectDueScheduledFeeds(
        [feed],
        SCHEDULED_TIME_2100_UTC + 1,
      );
      const secondTick = selectDueScheduledFeeds(
        [feed],
        SCHEDULED_TIME_2100_UTC + SCHEDULER_WINDOW_SIZE_MS,
      );

      assert.strictEqual(firstTick.length, 0);
      assert.strictEqual(secondTick.length, 1);
      assert.strictEqual(
        secondTick[0]?.scheduledAt,
        SCHEDULED_TIME_2100_UTC,
        "the trigger carries the scheduled time, not the fire time",
      );
    });

    it("each of multiple times on one feed fires at its own local minute", () => {
      const feed = makeFeed({
        id: "multi",
        url: urlWithSlot(0, "multi"),
        schedule: { times: ["09:00", "21:00"], timezone: "UTC" },
      });

      const morning = selectDueScheduledFeeds(
        [feed],
        Date.parse("2026-09-26T09:00:00Z"),
      );
      const evening = selectDueScheduledFeeds(
        [feed],
        SCHEDULED_TIME_2100_UTC,
      );

      assert.strictEqual(morning.length, 1);
      assert.strictEqual(morning[0]?.scheduledAt, Date.parse("2026-09-26T09:00:00Z"));
      assert.strictEqual(evening.length, 1);
      assert.strictEqual(evening[0]?.scheduledAt, SCHEDULED_TIME_2100_UTC);
    });
  });

  describe("selectDueScheduledFeeds - timezone correctness", () => {
    it("fires feeds on their own zone's wall clock, not the emitter's", () => {
      // 13:00 UTC is 21:00 in Asia/Shanghai (UTC+8) but 13:00 in UTC.
      const shanghai = makeFeed({
        id: "shanghai",
        url: urlWithSlot(0, "shanghai"),
        schedule: { times: ["21:00"], timezone: "Asia/Shanghai" },
      });
      const utc = makeFeed({
        id: "utc",
        url: urlWithSlot(0, "utc"),
        schedule: { times: ["21:00"], timezone: "UTC" },
      });

      const at1300Utc = selectDueScheduledFeeds(
        [shanghai, utc],
        Date.parse("2026-09-26T13:00:00Z"),
      );

      assert.deepStrictEqual(
        at1300Utc.map((d) => d.feed.id),
        [shanghai.id],
      );
      assert.strictEqual(at1300Utc[0]?.scheduledAt, Date.parse("2026-09-26T13:00:00Z"));

      const at2100Utc = selectDueScheduledFeeds(
        [shanghai, utc],
        Date.parse("2026-09-26T21:00:00Z"),
      );

      assert.deepStrictEqual(at2100Utc.map((d) => d.feed.id), [utc.id]);
    });

    it("same wall time in different timezones produces different epochs", () => {
      const shanghai = makeFeed({
        id: "epoch-shanghai",
        url: urlWithSlot(0, "epoch-shanghai"),
        schedule: { times: ["21:00"], timezone: "Asia/Shanghai" },
      });
      const utc = makeFeed({
        id: "epoch-utc",
        url: urlWithSlot(0, "epoch-utc"),
        schedule: { times: ["21:00"], timezone: "UTC" },
      });

      const due = selectDueScheduledFeeds(
        [shanghai, utc],
        Date.parse("2026-09-26T13:00:00Z"),
      );
      const utcDue = selectDueScheduledFeeds(
        [utc],
        Date.parse("2026-09-26T21:00:00Z"),
      );

      const shanghaiEpoch = due[0]?.scheduledAt;
      const utcEpoch = utcDue[0]?.scheduledAt;
      assert.notStrictEqual(shanghaiEpoch, utcEpoch);
      assert.strictEqual(
        (shanghaiEpoch ?? 0) - (utcEpoch ?? 0),
        -8 * 60 * 60 * 1000,
      );
    });
  });

  describe("selectDueScheduledFeeds - daylight saving time", () => {
    const feed = makeFeed({
      id: "dst",
      url: urlWithSlot(0, "dst"),
      schedule: { times: ["21:00"], timezone: "America/New_York" },
    });

    it("keeps 21:00 on the wall clock across a DST boundary", () => {
      // EST (UTC-5) before 2026-03-08, EDT (UTC-4) after.
      const winterScheduledTime = Date.parse("2026-01-15T21:00:00-05:00");
      const summerScheduledTime = Date.parse("2026-07-15T21:00:00-04:00");

      const winter = selectDueScheduledFeeds([feed], winterScheduledTime);
      const summer = selectDueScheduledFeeds([feed], summerScheduledTime);

      assert.strictEqual(winter.length, 1);
      assert.strictEqual(winter[0]?.scheduledAt, winterScheduledTime);
      assert.strictEqual(localHHMM(winterScheduledTime, "America/New_York"), "21:00");

      assert.strictEqual(summer.length, 1);
      assert.strictEqual(summer[0]?.scheduledAt, summerScheduledTime);
      assert.strictEqual(localHHMM(summerScheduledTime, "America/New_York"), "21:00");
      assert.notStrictEqual(winterScheduledTime, summerScheduledTime);
    });

    it("finds the scheduled time inside the hour skipped or repeated by DST", () => {
      // 2026-11-01: clocks fall back at 02:00 EDT -> 01:00 EST. 21:00 local is
      // unambiguous but sits after the repeat; the scheduled time must resolve to
      // the correct epoch on the local (second) side of the transition.
      const afterFallBack = Date.parse("2026-11-01T21:00:00-05:00");

      const due = selectDueScheduledFeeds([feed], afterFallBack);

      assert.strictEqual(due.length, 1);
      assert.strictEqual(due[0]?.scheduledAt, afterFallBack);
      assert.strictEqual(localHHMM(afterFallBack, "America/New_York"), "21:00");
    });
  });

  describe("selectDueScheduledFeeds - catch-up bound", () => {
    it("still fires a scheduled time missed within the catch-up window", () => {
      const feed = makeFeed({
        id: "catchup",
        url: urlWithSlot(0, "catchup"),
      });
      const lateNow = SCHEDULED_TIME_2100_UTC + SCHEDULED_CATCHUP_WINDOW_MS;

      const due = selectDueScheduledFeeds([feed], lateNow);

      assert.strictEqual(due.length, 1);
      assert.strictEqual(due[0]?.scheduledAt, SCHEDULED_TIME_2100_UTC);
    });

    it("skips scheduled times older than the catch-up window", () => {
      const feed = makeFeed({
        id: "too-late",
        url: urlWithSlot(0, "too-late"),
      });
      const lateNow =
        SCHEDULED_TIME_2100_UTC + SCHEDULED_CATCHUP_WINDOW_MS + 60_000;

      const due = selectDueScheduledFeeds([feed], lateNow);

      assert.strictEqual(due.length, 0);
    });
  });

  describe("selectDueScheduledFeeds - once-per-scheduled-time guard input", () => {
    it("skips a feed whose last fired time equals this scheduled time", () => {
      const feed = makeFeed({
        id: "fired",
        url: urlWithSlot(0, "fired"),
        lastScheduledFiredAt: SCHEDULED_TIME_2100_UTC,
      });

      const due = selectDueScheduledFeeds([feed], SCHEDULED_TIME_2100_UTC);

      assert.strictEqual(due.length, 0);
    });

    it("skips a feed whose last fired time is newer than this scheduled time", () => {
      const feed = makeFeed({
        id: "skew",
        url: urlWithSlot(0, "skew"),
        lastScheduledFiredAt: SCHEDULED_TIME_2100_UTC + 60_000,
      });

      const due = selectDueScheduledFeeds([feed], SCHEDULED_TIME_2100_UTC);

      assert.strictEqual(due.length, 0);
    });

    it("fires a feed whose last fired time is an earlier scheduled time", () => {
      const feed = makeFeed({
        id: "next-scheduled-time",
        url: urlWithSlot(0, "next-scheduled-time"),
        schedule: { times: ["09:00", "21:00"], timezone: "UTC" },
        lastScheduledFiredAt: Date.parse("2026-09-26T09:00:00Z"),
      });

      const due = selectDueScheduledFeeds([feed], SCHEDULED_TIME_2100_UTC);

      assert.strictEqual(due.length, 1);
      assert.strictEqual(due[0]?.scheduledAt, SCHEDULED_TIME_2100_UTC);
    });
  });

  describe("selectDueScheduledFeeds - spreading", () => {
    it("spreads due feeds across the minute's ticks without overlap", () => {
      const slot0 = makeFeed({
        id: "spread-a",
        url: urlWithSlot(0, "spread-a"),
      });
      const slot1 = makeFeed({
        id: "spread-b",
        url: urlWithSlot(1, "spread-b"),
      });

      const firstTick = selectDueScheduledFeeds(
        [slot0, slot1],
        SCHEDULED_TIME_2100_UTC,
      );
      const secondTick = selectDueScheduledFeeds(
        [slot0, slot1],
        SCHEDULED_TIME_2100_UTC + SCHEDULER_WINDOW_SIZE_MS,
      );

      assert.deepStrictEqual(
        firstTick.map((d) => d.feed.id),
        [slot0.id],
      );
      assert.deepStrictEqual(
        secondTick.map((d) => d.feed.id),
        [slot1.id],
      );
    });
  });

  describe("selectDueScheduledFeeds - defensive handling", () => {
    it("never selects feeds without a schedule, times, or a valid timezone", () => {
      const noSchedule = makeFeed({
        id: "no-schedule",
        url: urlWithSlot(0, "no-schedule"),
      });
      noSchedule.schedule = undefined;
      const emptyTimes = makeFeed({
        id: "empty-times",
        url: urlWithSlot(0, "empty-times"),
        schedule: { times: [], timezone: "UTC" },
      });
      const badTimezone = makeFeed({
        id: "bad-tz",
        url: urlWithSlot(0, "bad-tz"),
        schedule: { times: ["21:00"], timezone: "Not/AZone" },
      });
      const malformedTime = makeFeed({
        id: "bad-time",
        url: urlWithSlot(0, "bad-time"),
        schedule: { times: ["21:0", "9am", "25:00"], timezone: "UTC" },
      });

      const due = selectDueScheduledFeeds(
        [noSchedule, emptyTimes, badTimezone, malformedTime],
        SCHEDULED_TIME_2100_UTC,
      );

      assert.strictEqual(due.length, 0);
    });

    it("handles a midnight time", () => {
      const feed = makeFeed({
        id: "midnight",
        url: urlWithSlot(0, "midnight"),
        schedule: { times: ["00:00"], timezone: "UTC" },
      });

      const due = selectDueScheduledFeeds(
        [feed],
        Date.parse("2026-09-27T00:00:00Z"),
      );

      assert.strictEqual(due.length, 1);
      assert.strictEqual(due[0]?.scheduledAt, Date.parse("2026-09-27T00:00:00Z"));
    });
  });

  describe("isScheduledTime", () => {
    it("accepts the feed's own scheduled minutes and rejects neighbours", () => {
      const schedule = { times: ["21:00"], timezone: "Asia/Shanghai" };
      const scheduledAt = Date.parse("2026-09-26T13:00:00Z"); // 21:00 local

      assert.strictEqual(isScheduledTime(schedule, scheduledAt), true);
      assert.strictEqual(
        isScheduledTime(schedule, scheduledAt - 60_000),
        false,
      );
      assert.strictEqual(
        isScheduledTime(schedule, scheduledAt + 60_000),
        false,
      );
    });

    it("checks the wall clock of the scheduled time, so DST shifts stay on-schedule", () => {
      const schedule = { times: ["21:00"], timezone: "America/New_York" };

      assert.strictEqual(
        isScheduledTime(schedule, Date.parse("2026-01-15T21:00:00-05:00")),
        true,
      );
      assert.strictEqual(
        isScheduledTime(schedule, Date.parse("2026-07-15T21:00:00-04:00")),
        true,
      );
      assert.strictEqual(
        // 21:00 UTC would be 17:00 or 16:00 local — off-schedule in both halves.
        isScheduledTime(schedule, Date.parse("2026-07-15T21:00:00Z")),
        false,
      );
    });

    it("rejects feeds without a usable schedule", () => {
      assert.strictEqual(isScheduledTime(undefined, Date.now()), false);
      assert.strictEqual(
        isScheduledTime({ times: [], timezone: "UTC" }, Date.now()),
        false,
      );
      assert.strictEqual(
        isScheduledTime(
          { times: ["21:00"], timezone: "Not/AZone" },
          Date.now(),
        ),
        false,
      );
    });
  });
});
