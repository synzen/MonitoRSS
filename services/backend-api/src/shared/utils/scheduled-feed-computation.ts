import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  SCHEDULED_CATCHUP_WINDOW_MS,
  SCHEDULED_JITTER_SLOTS,
  SCHEDULER_WINDOW_SIZE_MS,
} from "../constants/scheduler.constants";
import { fnv1aHash } from "./fnv1a-hash";

dayjs.extend(utc);
dayjs.extend(timezone);

// Scheduled times are zero-padded 24h "HH:mm".
const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * A schedule: the feed fires once at each time in `times` ("HH:mm", 24h) on
 * each day in `days`, read on the wall clock of `timezone`. So "21:00" in
 * Shanghai means 2026-09-26T13:00:00Z on 2026-09-26.
 */
export interface FeedSchedule {
  times: string[];
  timezone: string;
  // Weekdays 0-6, Sunday = 0 (getDay()). Absent or empty = every day.
  days?: number[];
}

export interface ScheduledFeedClockInput {
  id: string;
  url: string;
  schedule?: FeedSchedule | null;
  // Epoch ms of the last delivered scheduled firing. When it is at or past a
  // firing, that firing already happened and must not fire again.
  lastScheduledFiredAt?: number | null;
}

export interface ScheduledDueFeed<T extends ScheduledFeedClockInput> {
  feed: T;
  scheduledAt: number;
}

function parseTimeParts(time: string): { hour: number; minute: number } | null {
  const match = TIME_FORMAT.exec(time);

  if (!match) {
    return null;
  }

  return { hour: Number(match[1]), minute: Number(match[2]) };
}

// The weekday of a "YYYY-MM-DD" date comes from plain UTC arithmetic:
// getUTCDay() on that date at UTC midnight. No timezone math involved.
function isDayAllowed(days: number[] | undefined | null, dateStr: string): boolean {
  if (!days || days.length === 0) {
    return true;
  }

  const [year = 0, month = 1, day = 1] = dateStr.split("-").map(Number);

  return days.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

/**
 * Where we stand in time: the moment we're asking about (`now`) and the two
 * calendar dates ("YYYY-MM-DD") in a schedule's timezone that could hold its
 * most recent firing — today and yesterday.
 */
interface CalendarContext {
  now: number;
  today: string;
  yesterday: string;
}

/**
 * When did `timeOfDay` last fire, as of `context.now`? Today's firing if it
 * already happened, otherwise yesterday's. Returns null when neither day is
 * scheduled (absent/empty `schedule.days` = every day). Dates are rebuilt
 * from the calendar date, never by subtracting 24 hours, so DST stays right.
 */
function mostRecentOccurrenceOf(
  schedule: FeedSchedule,
  timeOfDay: string,
  context: CalendarContext,
): number | null {
  const parts = parseTimeParts(timeOfDay);

  if (!parts) {
    return null;
  }

  if (isDayAllowed(schedule.days, context.today)) {
    const candidate = dayjs
      .tz(`${context.today} ${timeOfDay}`, "YYYY-MM-DD HH:mm", schedule.timezone)
      .valueOf();

    if (candidate <= context.now) {
      return candidate;
    }
  }

  // Today's firing is still ahead (or today isn't scheduled), so the most
  // recent one was yesterday's. Rebuilt from the calendar date, not by
  // subtracting 24 hours, so DST stays right.
  if (!isDayAllowed(schedule.days, context.yesterday)) {
    return null;
  }

  return dayjs
    .tz(`${context.yesterday} ${timeOfDay}`, "YYYY-MM-DD HH:mm", schedule.timezone)
    .valueOf();
}

/**
 * The CalendarContext for `timezone` at `now`. Returns null when the IANA
 * timezone is unknown — nothing can be scheduled.
 */
function calendarContextInTimezone(
  timezone: string,
  now: number,
): CalendarContext | null {
  try {
    const localNow = dayjs(now).tz(timezone);

    return {
      now,
      today: localNow.format("YYYY-MM-DD"),
      yesterday: localNow.subtract(1, "day").format("YYYY-MM-DD"),
    };
  } catch {
    // Unknown IANA timezone: nothing can be scheduled.
    return null;
  }
}

/**
 * The schedule's most recent firing at or before `epochMs` — the latest of
 * every time-of-day's most recent firing. Returns null when the schedule has
 * no usable times, the timezone is unknown, or neither today nor yesterday
 * is scheduled.
 */
export function getMostRecentScheduledTime(
  schedule: FeedSchedule | null | undefined,
  epochMs: number,
): number | null {
  if (!schedule || schedule.times.length === 0) {
    return null;
  }

  const context = calendarContextInTimezone(schedule.timezone, epochMs);

  if (!context) {
    return null;
  }

  let mostRecent: number | null = null;

  for (const timeOfDay of schedule.times) {
    const scheduledAt = mostRecentOccurrenceOf(schedule, timeOfDay, context);

    if (scheduledAt !== null && (mostRecent === null || scheduledAt > mostRecent)) {
      mostRecent = scheduledAt;
    }
  }

  return mostRecent;
}

/**
 * Is `timestampMs` exactly one of the schedule's firings? Checked by asking
 * for the most recent firing as of `timestampMs` and comparing. Uses the
 * trigger's time, not the fan-out wall clock, so a fetch that finishes late
 * still delivers.
 */
export function isScheduledTime(
  schedule: FeedSchedule | null | undefined,
  timestampMs: number,
): boolean {
  return getMostRecentScheduledTime(schedule, timestampMs) === timestampMs;
}

/**
 * Pick the feeds that must fire on the tick at time `now`.
 *
 * Pure function of (feeds, now) — seam for the schedule emitter's clock branch
 * (ADR-009). A feed is due when:
 * - one of its times has fired on the feed's own wall clock (DST-aware),
 * - the occurrence's effective fire time has arrived — the wall-clock minute
 *   plus a delay slot derived from the URL's hash inside the jitter window.
 *   Keyed by URL — the fetch batching unit — so feeds sharing a URL always
 *   fire together and cost a single fetch. Users cluster on round times, so
 *   spreading across the window is what keeps a host serving many scheduled
 *   subscriber URLs from receiving them all in one burst,
 * - that effective fire time is no older than the catch-up window (a firing
 *   missed while the process was down still fires; older ones wait for the
 *   next one),
 * - and it hasn't already fired (`lastScheduledFiredAt` is strictly earlier).
 * An unclaimed occurrence stays due on later ticks until the delivery claim
 * records it; the fetch layer's response reuse and the claim guard keep the
 * re-fires cheap and delivery at-most-once.
 */
export function selectDueScheduledFeeds<T extends ScheduledFeedClockInput>(
  feeds: T[],
  now: number,
): Array<ScheduledDueFeed<T>> {
  // Group by timezone: every feed in the zone shares one calendar conversion.
  const feedsByTimezone = new Map<string, T[]>();

  for (const feed of feeds) {
    if (!feed.schedule?.timezone) {
      continue;
    }

    const group = feedsByTimezone.get(feed.schedule.timezone);

    if (group) {
      group.push(feed);
    } else {
      feedsByTimezone.set(feed.schedule.timezone, [feed]);
    }
  }

  const due: Array<ScheduledDueFeed<T>> = [];

  for (const [timezone, feedsInTimezone] of feedsByTimezone) {
    const context = calendarContextInTimezone(timezone, now);

    if (!context) {
      continue;
    }

    for (const feed of feedsInTimezone) {
      if (!feed.schedule?.times) {
        continue;
      }

      for (const timeOfDay of feed.schedule.times) {
        const scheduledAt = mostRecentOccurrenceOf(feed.schedule, timeOfDay, context);

        if (scheduledAt === null || scheduledAt > now) {
          continue;
        }

        if (
          feed.lastScheduledFiredAt != null &&
          feed.lastScheduledFiredAt >= scheduledAt
        ) {
          continue;
        }

        const slot = fnv1aHash(feed.url) % SCHEDULED_JITTER_SLOTS;
        const fireAt = scheduledAt + slot * SCHEDULER_WINDOW_SIZE_MS;

        if (now < fireAt) {
          continue;
        }

        if (now - fireAt > SCHEDULED_CATCHUP_WINDOW_MS) {
          continue;
        }

        due.push({ feed, scheduledAt });
      }
    }
  }

  return due;
}
