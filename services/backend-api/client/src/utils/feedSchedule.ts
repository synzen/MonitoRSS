import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const MAX_SCHEDULE_TIMES = 10;

// 24h "HH:mm", matching the format the scheduler consumes and the server
// validates against.
export const SCHEDULE_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export interface FeedScheduleShape {
  scheduleMode?: string;
  schedule?: {
    times: string[];
    timezone: string;
  } | null;
}

export const formatScheduleSummary = (feed: FeedScheduleShape): string | null => {
  if (feed.scheduleMode !== "scheduled" || !feed.schedule) {
    return null;
  }

  // Rendered under the "Delivery Schedule" overview label, which already
  // conveys the mode — the value carries only the times and zone.
  return `${feed.schedule.times.join(", ")} (${feed.schedule.timezone})`;
};

/**
 * "GMT+8" / "GMT-5" / "GMT+5:30" for the zone's current offset. Null when the
 * zone is not a valid IANA timezone.
 */
export const getTimezoneOffsetLabel = (timezone: string): string | null => {
  try {
    const offset = dayjs().tz(timezone).format("Z");

    if (!/^[+-]\d{2}:\d{2}$/.test(offset)) {
      return null;
    }

    const sign = offset.startsWith("-") ? "-" : "+";
    const [hours, minutes] = offset.replace(/^[+-]/, "").split(":");
    const trimmedHours = String(parseInt(hours, 10));

    return `GMT${sign}${trimmedHours}${minutes !== "00" ? `:${minutes}` : ""}`;
  } catch {
    return null;
  }
};

export const browserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

interface TimezoneGroup {
  region: string;
  zones: string[];
}

export const buildTimezoneGroups = (): TimezoneGroup[] => {
  let zones: string[];

  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }

  // UTC is the fallback default, so it must always be selectable even when the
  // platform's zone list omits it (Node's ICU list does).
  if (!zones.includes("UTC")) {
    zones = [...zones, "UTC"];
  }

  const groups = new Map<string, string[]>();

  for (const zone of zones) {
    const region = zone.includes("/") ? zone.split("/")[0] : "Other";
    const existing = groups.get(region);

    if (existing) {
      existing.push(zone);
    } else {
      groups.set(region, [zone]);
    }
  }

  return [...groups.entries()]
    .map(([region, groupZones]) => ({ region, zones: groupZones.sort() }))
    .sort((a, b) => a.region.localeCompare(b.region));
};

// Next calendar date via pure UTC arithmetic: re-parsing the date string in
// the schedule zone keeps DST offsets correct (a zone-local day is not always
// 24h, but a UTC day is), matching the backend's scheduled-feed computation.
const nextCalendarDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

/**
 * The next occurrence across `times` in `timezone`, as
 * "Next fetch: tomorrow at 21:00". "Today"/"tomorrow" are the schedule zone's
 * calendar dates, not the browser's. Null when no time is usable or the
 * timezone is invalid.
 */
export const getNextScheduledFetchText = (times: string[], timezone: string): string | null => {
  const usableTimes = times.filter((t) => SCHEDULE_TIME_PATTERN.test(t));

  if (!usableTimes.length || !timezone) {
    return null;
  }

  let zoneNow: dayjs.Dayjs;

  try {
    zoneNow = dayjs().tz(timezone);
  } catch {
    return null;
  }

  if (!zoneNow.isValid()) {
    return null;
  }

  const todayStr = zoneNow.format("YYYY-MM-DD");
  const tomorrowStr = nextCalendarDate(todayStr);
  const nowMs = Date.now();
  let next: { dateStr: string; at: dayjs.Dayjs } | null = null;

  for (const time of usableTimes) {
    let at: dayjs.Dayjs | null = null;
    let dateStr = todayStr;

    try {
      const todayCandidate = dayjs.tz(`${todayStr} ${time}`, "YYYY-MM-DD HH:mm", timezone);

      if (!todayCandidate.isValid()) {
        return null;
      }

      if (todayCandidate.valueOf() > nowMs) {
        at = todayCandidate;
      } else {
        dateStr = tomorrowStr;
        at = dayjs.tz(`${tomorrowStr} ${time}`, "YYYY-MM-DD HH:mm", timezone);
      }
    } catch {
      return null;
    }

    if (!at.isValid()) {
      return null;
    }

    if (!next || at.valueOf() < next.at.valueOf()) {
      next = { dateStr, at };
    }
  }

  if (!next) {
    return null;
  }

  const dateLabel =
    next.dateStr === todayStr
      ? "today"
      : next.dateStr === tomorrowStr
        ? "tomorrow"
        : next.at.format("MMM D");

  return `Next fetch: ${dateLabel} at ${next.at.format("HH:mm")}`;
};
