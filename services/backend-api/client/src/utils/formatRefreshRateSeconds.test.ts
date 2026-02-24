import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  getEffectiveRefreshRateSeconds,
  formatRefreshRateSeconds,
  getNextCheckText,
} from "./formatRefreshRateSeconds";

dayjs.extend(duration);
dayjs.extend(relativeTime);

describe("getEffectiveRefreshRateSeconds", () => {
  it("returns userRefreshRateSeconds when set", () => {
    expect(
      getEffectiveRefreshRateSeconds({ userRefreshRateSeconds: 120, refreshRateSeconds: 600 }),
    ).toBe(120);
  });

  it("falls back to refreshRateSeconds when userRefreshRateSeconds is undefined", () => {
    expect(getEffectiveRefreshRateSeconds({ refreshRateSeconds: 600 })).toBe(600);
  });

  it("falls back to refreshRateSeconds when userRefreshRateSeconds is 0", () => {
    expect(
      getEffectiveRefreshRateSeconds({ userRefreshRateSeconds: 0, refreshRateSeconds: 600 }),
    ).toBe(600);
  });
});

describe("formatRefreshRateSeconds", () => {
  it("formats seconds for values under 60", () => {
    expect(formatRefreshRateSeconds(30)).toBe("30 seconds");
  });

  it("formats minutes for values 60 and above", () => {
    expect(formatRefreshRateSeconds(60)).toBe("1 minute");
    expect(formatRefreshRateSeconds(120)).toBe("2 minutes");
    expect(formatRefreshRateSeconds(600)).toBe("10 minutes");
  });

  it("formats hours for values 3600 and above", () => {
    expect(formatRefreshRateSeconds(3600)).toBe("1 hour");
    expect(formatRefreshRateSeconds(7200)).toBe("2 hours");
  });
});

describe("getNextCheckText", () => {
  it("returns empty string when lastRequestAtUnix is undefined", () => {
    expect(getNextCheckText(undefined, 600)).toBe("");
  });

  it("returns 'expected shortly' when overdue", () => {
    const fifteenMinutesAgo = Date.now() / 1000 - 900;
    expect(getNextCheckText(fifteenMinutesAgo, 600)).toBe("Next check expected shortly.");
  });

  it("returns 'expected shortly' when exactly at refresh rate", () => {
    const tenMinutesAgo = Date.now() / 1000 - 600;
    expect(getNextCheckText(tenMinutesAgo, 600)).toBe("Next check expected shortly.");
  });

  it("returns humanized time remaining when within refresh window", () => {
    const twoMinutesAgo = Date.now() / 1000 - 120;
    const result = getNextCheckText(twoMinutesAgo, 600);
    expect(result).toMatch(/^Next check expected in about .+\.$/);
    expect(result).not.toContain("shortly");
  });

  it("returns humanized time for short remaining duration", () => {
    const nineMinutesAgo = Date.now() / 1000 - 540;
    const result = getNextCheckText(nineMinutesAgo, 600);
    expect(result).toMatch(/^Next check expected in about .+\.$/);
  });
});
