import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatScheduleSummary,
  getNextScheduledFetchText,
  getTimezoneOffsetLabel,
  buildTimezoneGroups,
  browserTimezone,
} from "./feedSchedule";

describe("formatScheduleSummary", () => {
  it("formats a scheduled feed with times and timezone", () => {
    expect(
      formatScheduleSummary({
        scheduleMode: "scheduled",
        schedule: { times: ["09:00", "21:00"], timezone: "Asia/Shanghai" },
      }),
    ).toBe("09:00, 21:00 (Asia/Shanghai)");
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
});
