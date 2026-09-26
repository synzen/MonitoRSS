import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  SCHEDULED_CATCHUP_WINDOW_MS,
  SCHEDULER_WINDOW_SIZE_MS,
} from "../constants/scheduler.constants";
import { fnv1aHash } from "./fnv1a-hash";

dayjs.extend(utc);
dayjs.extend(timezone);

const MS_PER_MINUTE = 60_000;
const TICKS_PER_MINUTE = MS_PER_MINUTE / SCHEDULER_WINDOW_SIZE_MS;

// Scheduled times are zero-padded 24h "HH:mm".
const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * A repeating daily rule: every day, the feed fires once at each of `times`
 * (24h "HH:mm") in `timezone`. Each firing of a time on a calendar date is one
 * concrete epoch ms — e.g. "21:00" firing on 2026-09-26 in Shanghai is
 * 2026-09-26T13:00:00Z.
 */
export interface FeedSchedule {
  times: string[];
  timezone: string;
}

export interface ScheduledFeedClockInput {
  id: string;
  url: string;
  schedule?: FeedSchedule | null;
  // Epoch ms of the last delivered scheduled time (the fan-out's
  // once-per-scheduled-time marker). When it is at or past a scheduled time,
  // that time has been handled and must not fire again.
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

/**
 * The epoch ms of the firing of `time` (a single "HH:mm" from a schedule) on
 * calendar date `today` in `timezone`. When that wall-clock time is still
 * ahead of `now`, the most recent firing of this time was yesterday's, so
 * `yesterday`'s epoch is returned instead. The date is passed in (rather than
 * subtracting 24h from an epoch) so DST offsets stay correct.
 */
function scheduledTimeToEpoch(
  time: string,
  timezone: string,
  today: string,
  yesterday: string,
  now: number,
): number | null {
  const parts = parseTimeParts(time);

  if (!parts) {
    return null;
  }

  const candidate = dayjs.tz(`${today} ${time}`, "YYYY-MM-DD HH:mm", timezone).valueOf();

  if (candidate <= now) {
    return candidate;
  }

  // The scheduled time is still ahead today; its most recent firing was
  // yesterday's. Rebuilt from the calendar date so DST offsets stay correct
  // instead of subtracting 24h from the epoch.
  return dayjs.tz(`${yesterday} ${time}`, "YYYY-MM-DD HH:mm", timezone).valueOf();
}

/**
 * Today's and yesterday's calendar dates ("YYYY-MM-DD") in `timezone` — the
 * two dates whose firings can be the most recent one at `epochMs`. Returns
 * null for an unknown IANA timezone: nothing can be scheduled.
 */
function calendarDatesInTimezone(
  timezone: string,
  epochMs: number,
): { today: string; yesterday: string } | null {
  try {
    const localNow = dayjs(epochMs).tz(timezone);

    return {
      today: localNow.format("YYYY-MM-DD"),
      yesterday: localNow.subtract(1, "day").format("YYYY-MM-DD"),
    };
  } catch {
    // Unknown IANA timezone: nothing can be scheduled.
    return null;
  }
}

/**
 * Stand at `epochMs` on the timeline of the schedule's daily firings and
 * return the latest one that has already happened ("at or before"). The
 * schedule's times repeat every day, so this is the most recent concrete
 * firing of any of them — today's if one has passed, otherwise yesterday's.
 * Minute-aligned in the schedule's timezone. Returns null when the schedule
 * has no usable times or the timezone is unknown.
 */
export function getMostRecentScheduledTime(
  schedule: FeedSchedule | null | undefined,
  epochMs: number,
): number | null {
  if (!schedule || schedule.times.length === 0) {
    return null;
  }

  const dates = calendarDatesInTimezone(schedule.timezone, epochMs);

  if (!dates) {
    return null;
  }

  let mostRecent: number | null = null;

  for (const time of schedule.times) {
    const scheduledAt = scheduledTimeToEpoch(
      time,
      schedule.timezone,
      dates.today,
      dates.yesterday,
      epochMs,
    );

    if (scheduledAt !== null && (mostRecent === null || scheduledAt > mostRecent)) {
      mostRecent = scheduledAt;
    }
  }

  return mostRecent;
}

/**
 * Whether `timestampMs` is exactly one of the schedule's daily firings in its
 * timezone. Works by standing at `timestampMs` and asking for the most recent
 * firing: if the most recent firing IS this moment, the moment is a firing
 * time; otherwise it lands strictly behind it and the timestamps differ.
 * Checked against the trigger's time (not fan-out wall clock) so a fetch
 * completing late within the bounds still delivers.
 */
export function isScheduledTime(
  schedule: FeedSchedule | null | undefined,
  timestampMs: number,
): boolean {
  return getMostRecentScheduledTime(schedule, timestampMs) === timestampMs;
}

/**
 * Select the scheduled feeds that must fire on the tick at time `now`.
 *
 * Pure function of (feeds, now) — seam for the schedule emitter's clock branch
 * (ADR-009). A feed is due when:
 * - `now` is the feed's most recent scheduled minute in its timezone (wall
 *   clock, DST-aware),
 * - the scheduled time is no older than the catch-up window (missed times
 *   still fire on recovery; older ones wait for the next scheduled time),
 * - the feed's last fired scheduled time is strictly earlier (already
 *   delivered times never re-fire),
 * - and the URL's stable hash slot matches this tick's index within the wall
 *   clock minute (hot-minute spreading: a minute's due URLs are distributed
 *   across the minute's ticks instead of bursting on the first one). The slot
 *   is keyed by URL — the fetch batching unit — so feeds sharing a URL always
 *   fire together and cost a single fetch.
 */
export function selectDueScheduledFeeds<T extends ScheduledFeedClockInput>(
  feeds: T[],
  now: number,
): Array<ScheduledDueFeed<T>> {
  const tickIndex = Math.floor((now % MS_PER_MINUTE) / SCHEDULER_WINDOW_SIZE_MS);

  // Group by timezone so the per-timezone calendar-date conversion runs once
  // per timezone instead of once per feed.
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
    const dates = calendarDatesInTimezone(timezone, now);

    if (!dates) {
      continue;
    }

    for (const feed of feedsInTimezone) {
      if (!feed.schedule?.times) {
        continue;
      }

      for (const time of feed.schedule.times) {
        const scheduledAt = scheduledTimeToEpoch(
          time,
          timezone,
          dates.today,
          dates.yesterday,
          now,
        );

        if (scheduledAt === null || scheduledAt > now) {
          continue;
        }

        if (now - scheduledAt > SCHEDULED_CATCHUP_WINDOW_MS) {
          continue;
        }

        if (
          feed.lastScheduledFiredAt != null &&
          feed.lastScheduledFiredAt >= scheduledAt
        ) {
          continue;
        }

        if (fnv1aHash(feed.url) % TICKS_PER_MINUTE !== tickIndex) {
          continue;
        }

        due.push({ feed, scheduledAt });
      }
    }
  }

  return due;
}
