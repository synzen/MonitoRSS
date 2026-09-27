import { describe, it } from "node:test";
import assert from "node:assert";
import {
  SCHEDULED_CATCHUP_WINDOW_MS,
  SCHEDULED_JITTER_SLOTS,
  SCHEDULER_WINDOW_SIZE_MS,
} from "../../../src/shared/constants/scheduler.constants";
import {
  isScheduledTime,
  selectDueScheduledFeeds,
  type ScheduledFeedClockInput,
} from "../../../src/shared/utils/scheduled-feed-computation";
import { urlWithSlot } from "../../helpers/schedule-slots";

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

    it("fires a slot-1 URL only at or after its jittered fire time", () => {
      const feed = makeFeed({
        id: "second-tick",
        url: urlWithSlot(1, "second-tick"),
      });

      const beforeFireTime = selectDueScheduledFeeds(
        [feed],
        SCHEDULED_TIME_2100_UTC + 1,
      );
      const atFireTime = selectDueScheduledFeeds(
        [feed],
        SCHEDULED_TIME_2100_UTC + SCHEDULER_WINDOW_SIZE_MS,
      );

      assert.strictEqual(beforeFireTime.length, 0);
      assert.strictEqual(atFireTime.length, 1);
      assert.strictEqual(
        atFireTime[0]?.scheduledAt,
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
    it("assigns different URLs different slots within the jitter window", () => {
      const feedA = makeFeed({
        id: "spread-a",
        url: urlWithSlot(0, "spread-a"),
      });
      const feedB = makeFeed({
        id: "spread-b",
        url: urlWithSlot(1, "spread-b"),
      });

      const firstTick = selectDueScheduledFeeds(
        [feedA, feedB],
        SCHEDULED_TIME_2100_UTC,
      );
      const secondTick = selectDueScheduledFeeds(
        [feedA, feedB],
        SCHEDULED_TIME_2100_UTC + SCHEDULER_WINDOW_SIZE_MS,
      );

      assert.deepStrictEqual(
        firstTick.map((d) => d.feed.id),
        [feedA.id],
        "slot-0 URL fires on its slot; slot-1 URL must wait",
      );
      assert.deepStrictEqual(
        secondTick.map((d) => d.feed.id),
        [feedA.id, feedB.id],
        "an unclaimed occurrence stays due on later ticks within catch-up; feed B fires once its slot arrives",
      );
    });

    it("keys the slot by URL so feeds sharing a URL fire together", () => {
      const sharedUrl = urlWithSlot(3, "shared-slot");
      const feedA = makeFeed({ id: "a", url: sharedUrl });
      const feedB = makeFeed({ id: "b", url: sharedUrl });

      const beforeSlot = selectDueScheduledFeeds(
        [feedA, feedB],
        SCHEDULED_TIME_2100_UTC + SCHEDULER_WINDOW_SIZE_MS,
      );
      const atSlot = selectDueScheduledFeeds(
        [feedA, feedB],
        SCHEDULED_TIME_2100_UTC + 3 * SCHEDULER_WINDOW_SIZE_MS,
      );

      assert.strictEqual(beforeSlot.length, 0);
      assert.strictEqual(atSlot.length, 2);
    });

    it("fires a late-slot URL on recovery once its slot has passed, within catch-up", () => {
      // The emitter was down at the URL's slot tick; on the first tick after
      // recovery the occurrence is still within catch-up of its fire time, so
      // it fires late rather than waiting for the next occurrence.
      const lastSlot = SCHEDULED_JITTER_SLOTS - 1;
      const feed = makeFeed({
        id: "late-slot",
        url: urlWithSlot(lastSlot, "late-slot"),
      });

      const justAfterSlot = selectDueScheduledFeeds(
        [feed],
        SCHEDULED_TIME_2100_UTC + lastSlot * SCHEDULER_WINDOW_SIZE_MS,
      );
      const afterSlotPassed = selectDueScheduledFeeds(
        [feed],
        SCHEDULED_TIME_2100_UTC + (lastSlot + 4) * SCHEDULER_WINDOW_SIZE_MS,
      );

      assert.strictEqual(justAfterSlot.length, 1);
      assert.strictEqual(afterSlotPassed.length, 1);
      assert.strictEqual(
        afterSlotPassed[0]?.scheduledAt,
        SCHEDULED_TIME_2100_UTC,
      );
    });

    it("measures the catch-up bound against the jittered fire time", () => {
      // A last-slot URL's catch-up window ends one jitter window after the
      // wall-clock minute's own catch-up would: the two windows do not stack
      // into 25 minutes of allowed lateness beyond the design bound of
      // jitter + catch-up measured from the fire time.
      const lastSlot = SCHEDULED_JITTER_SLOTS - 1;
      const feed = makeFeed({
        id: "late-slot-bound",
        url: urlWithSlot(lastSlot, "late-slot-bound"),
      });
      const fireAt =
        SCHEDULED_TIME_2100_UTC + lastSlot * SCHEDULER_WINDOW_SIZE_MS;

      const withinBound = selectDueScheduledFeeds(
        [feed],
        fireAt + SCHEDULED_CATCHUP_WINDOW_MS,
      );
      const pastBound = selectDueScheduledFeeds(
        [feed],
        fireAt + SCHEDULED_CATCHUP_WINDOW_MS + SCHEDULER_WINDOW_SIZE_MS,
      );

      assert.strictEqual(withinBound.length, 1);
      assert.strictEqual(pastBound.length, 0);
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

  // 2026-09-26 is a Saturday; 2026-09-27 is the Sunday after it.
  describe("selectDueScheduledFeeds - days of week", () => {
    it("fires when the occurrence's calendar date is an allowed day", () => {
      const feed = makeFeed({
        id: "saturday",
        url: urlWithSlot(0, "saturday"),
        schedule: { times: ["21:00"], timezone: "UTC", days: [6] },
      });

      const due = selectDueScheduledFeeds([feed], SCHEDULED_TIME_2100_UTC);

      assert.strictEqual(due.length, 1);
      assert.strictEqual(due[0]?.scheduledAt, SCHEDULED_TIME_2100_UTC);
    });

    it("does not fire on a disallowed day", () => {
      const feed = makeFeed({
        id: "sunday-only",
        url: urlWithSlot(0, "sunday-only"),
        schedule: { times: ["21:00"], timezone: "UTC", days: [0] },
      });

      const due = selectDueScheduledFeeds([feed], SCHEDULED_TIME_2100_UTC);

      assert.strictEqual(due.length, 0);
    });

    it("treats absent days as every day (pre-feature documents)", () => {
      const feed = makeFeed({
        id: "no-days",
        url: urlWithSlot(0, "no-days"),
        schedule: { times: ["21:00"], timezone: "UTC" },
      });

      const due = selectDueScheduledFeeds([feed], SCHEDULED_TIME_2100_UTC);

      assert.strictEqual(due.length, 1);
    });

    it("evaluates the day on the schedule zone's calendar, not the emitter's", () => {
      // 21:00 Asia/Shanghai on Saturday 2026-09-26 is 13:00 UTC Saturday; on
      // Sunday it is 13:00 UTC Sunday. A Sunday-only feed must fire on the
      // second one.
      const feed = makeFeed({
        id: "zone-day",
        url: urlWithSlot(0, "zone-day"),
        schedule: { times: ["21:00"], timezone: "Asia/Shanghai", days: [0] },
      });

      const saturday = selectDueScheduledFeeds(
        [feed],
        Date.parse("2026-09-26T13:00:00Z"),
      );
      const sunday = selectDueScheduledFeeds(
        [feed],
        Date.parse("2026-09-27T13:00:00Z"),
      );

      assert.strictEqual(saturday.length, 0);
      assert.strictEqual(sunday.length, 1);
      assert.strictEqual(sunday[0]?.scheduledAt, Date.parse("2026-09-27T13:00:00Z"));
    });

    it("catches up a missed occurrence whose own date was an allowed day, even after midnight", () => {
      // Sunday-only feed, 23:55 Sunday. The process is back within the
      // catch-up window at 00:10 Monday: the occurrence's date (Sunday) is
      // what governs, so it still fires.
      const feed = makeFeed({
        id: "midnight-catchup",
        url: urlWithSlot(0, "midnight-catchup"),
        schedule: { times: ["23:55"], timezone: "UTC", days: [0] },
      });
      const scheduledAt = Date.parse("2026-09-27T23:55:00Z");
      const lateNow = scheduledAt + SCHEDULED_CATCHUP_WINDOW_MS;

      const due = selectDueScheduledFeeds([feed], lateNow);

      assert.strictEqual(due.length, 1);
      assert.strictEqual(due[0]?.scheduledAt, scheduledAt);
    });

    it("does not fire a disallowed day's time even within the catch-up window", () => {
      const feed = makeFeed({
        id: "wrong-day-catchup",
        url: urlWithSlot(0, "wrong-day-catchup"),
        schedule: { times: ["21:00"], timezone: "UTC", days: [0] },
      });
      const lateNow = SCHEDULED_TIME_2100_UTC + SCHEDULED_CATCHUP_WINDOW_MS;

      const due = selectDueScheduledFeeds([feed], lateNow);

      assert.strictEqual(due.length, 0);
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

    it("rejects the same wall time on a disallowed day and accepts it on an allowed one", () => {
      const schedule = { times: ["21:00"], timezone: "UTC", days: [0] };

      // 2026-09-26 is a Saturday, 2026-09-27 the Sunday after it.
      assert.strictEqual(
        isScheduledTime(schedule, Date.parse("2026-09-26T21:00:00Z")),
        false,
      );
      assert.strictEqual(
        isScheduledTime(schedule, Date.parse("2026-09-27T21:00:00Z")),
        true,
      );
    });
  });
});
