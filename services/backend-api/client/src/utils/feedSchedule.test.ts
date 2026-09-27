import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatScheduleSummary,
  getNextScheduledFetchText,
  getTimezoneOffsetLabel,
  buildTimezoneGroups,
  browserTimezone,
} from "./feedSchedule";

describe("formatScheduleSummary", () => {
  it("formats a daily schedule with times and timezone", () => {
    expect(
      formatScheduleSummary({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00", "21:00"], timezone: "Asia/Shanghai" },
      }),
    ).toBe("Every day at 09:00, 21:00 (Asia/Shanghai)");
  });

  it("formats all seven days as every day", () => {
    expect(
      formatScheduleSummary({
        scheduleMode: "scheduled",
        schedule: {
          times: ["09:00"],
          timezone: "UTC",
          days: [0, 1, 2, 3, 4, 5, 6],
        },
      }),
    ).toBe("Every day at 09:00 (UTC)");
  });

  it("lists selected days in Monday-first order", () => {
    expect(
      formatScheduleSummary({
        scheduleMode: "scheduled",
        schedule: {
          times: ["09:00"],
          timezone: "UTC",
          days: [0, 1, 3],
        },
      }),
    ).toBe("Mon, Wed, Sun at 09:00 (UTC)");
  });

  it("treats an empty days array as every day", () => {
    expect(
      formatScheduleSummary({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00"], timezone: "UTC", days: [] },
      }),
    ).toBe("Every day at 09:00 (UTC)");
  });

  it("returns null for interval mode", () => {
    expect(
      formatScheduleSummary({ scheduleMode: "interval", schedule: null }),
    ).toBe(null);
  });

  it("returns null when scheduleMode is absent (pre-feature documents)", () => {
    expect(formatScheduleSummary({ schedule: null })).toBe(null);
  });

  it("returns null when schedule is missing despite scheduled mode", () => {
    expect(formatScheduleSummary({ scheduleMode: "scheduled" })).toBe(null);
  });
});

describe("getTimezoneOffsetLabel", () => {
  it("returns GMT+8 for Asia/Shanghai", () => {
    expect(getTimezoneOffsetLabel("Asia/Shanghai")).toBe("GMT+8");
  });

  it("returns a negative offset for western zones", () => {
    expect(getTimezoneOffsetLabel("America/New_York")).toMatch(/^GMT-[45](:30)?$/);
  });

  it("returns GMT+0 formatting for UTC", () => {
    expect(getTimezoneOffsetLabel("UTC")).toBe("GMT+0");
  });

  it("returns null for an unknown timezone", () => {
    expect(getTimezoneOffsetLabel("Mars/Olympus_Mons")).toBe(null);
  });
});

describe("browserTimezone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to UTC when detection throws", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("unavailable");
    });

    expect(browserTimezone()).toBe("UTC");
  });
});

describe("buildTimezoneGroups", () => {
  it("groups zones by region and includes UTC", () => {
    const groups = buildTimezoneGroups();
    const regions = groups.map((g) => g.region);

    expect(regions).toContain("Asia");
    expect(regions).toContain("Europe");
    expect(regions).toContain("Other");

    const utc = groups.find((g) => g.region === "Other")!;
    expect(utc.zones).toContain("UTC");
  });

  it("sorts zones within each group", () => {
    const groups = buildTimezoneGroups();
    const asia = groups.find((g) => g.region === "Asia")!;
    const sorted = [...asia.zones].sort();

    expect(asia.zones).toEqual(sorted);
  });
});

describe("getNextScheduledFetchText", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes the next occurrence today for a later time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));

    expect(getNextScheduledFetchText(["21:00"], "UTC")).toBe(
      "Next fetch: today at 21:00",
    );
  });

  it("rolls to tomorrow when today's occurrence has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T21:30:00Z"));

    expect(getNextScheduledFetchText(["21:00"], "UTC")).toBe(
      "Next fetch: tomorrow at 21:00",
    );
  });

  it("picks the earliest of multiple times", () => {
    vi.useFakeTimers();
    // 10:00 UTC: today's 21:00 (11h away) beats tomorrow's 03:00 (17h away).
    vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));

    expect(getNextScheduledFetchText(["21:00", "03:00"], "UTC")).toBe(
      "Next fetch: today at 21:00",
    );
  });

  it("uses the schedule zone's calendar date, not the browser's", () => {
    vi.useFakeTimers();
    // 2026-09-27 05:00 in Shanghai is 2026-09-26 21:00 UTC: the browser is on
    // the 26th while the schedule zone is already on the 27th.
    vi.setSystemTime(new Date("2026-09-26T21:00:00Z"));

    expect(getNextScheduledFetchText(["06:00"], "Asia/Shanghai")).toBe(
      "Next fetch: today at 06:00",
    );
  });

  it("returns null when the timezone is invalid", () => {
    expect(getNextScheduledFetchText(["09:00"], "Not/AZone")).toBe(null);
  });

  it("returns null when no times are usable", () => {
    expect(getNextScheduledFetchText(["", "bad"], "UTC")).toBe(null);
  });

  it("skips to the next allowed day when today is not scheduled", () => {
    vi.useFakeTimers();
    // 2026-09-26 is a Saturday.
    vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));

    expect(getNextScheduledFetchText(["21:00"], "UTC", [0])).toBe(
      "Next fetch: tomorrow at 21:00",
    );
  });

  it("skips with a weekday label when the next allowed day is beyond tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));

    expect(getNextScheduledFetchText(["21:00"], "UTC", [1])).toBe(
      "Next fetch: Mon, Sep 28 at 21:00",
    );
  });

  it("stays on today when today is an allowed day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));

    expect(getNextScheduledFetchText(["21:00"], "UTC", [6])).toBe(
      "Next fetch: today at 21:00",
    );
  });

  it("evaluates days on the schedule zone's calendar, not the browser's", () => {
    vi.useFakeTimers();
    // 05:00 Shanghai on Sunday 2026-09-27 is 21:00 UTC Saturday 2026-09-26:
    // the browser is still on Saturday while the schedule zone is on Sunday.
    // A Sunday-only schedule is live "today" in the zone.
    vi.setSystemTime(new Date("2026-09-26T21:00:00Z"));

    expect(getNextScheduledFetchText(["06:00"], "Asia/Shanghai", [0])).toBe(
      "Next fetch: today at 06:00",
    );
  });

  it("rolls a full week when no listed day remains ahead", () => {
    vi.useFakeTimers();
    // Saturday 21:30 UTC: today's 21:00 has passed and the only allowed day
    // is next Saturday.
    vi.setSystemTime(new Date("2026-09-26T21:30:00Z"));

    expect(getNextScheduledFetchText(["21:00"], "UTC", [6])).toBe(
      "Next fetch: Sat, Oct 3 at 21:00",
    );
  });

  it("ignores days when absent", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T21:30:00Z"));

    expect(getNextScheduledFetchText(["21:00"], "UTC")).toBe(
      "Next fetch: tomorrow at 21:00",
    );
  });
});
