import dayjs from "dayjs";

export const getEffectiveRefreshRateSeconds = (feed: {
  userRefreshRateSeconds?: number;
  refreshRateSeconds: number;
}): number => feed.userRefreshRateSeconds || feed.refreshRateSeconds;

export const formatRefreshRateSeconds = (num: number) => {
  let displayDuration = `${num} seconds`;

  if (num >= 3600) {
    const hours = num / 60 / 60;
    displayDuration = `${hours} hour${hours > 1 ? "s" : ""}`;
  } else if (num >= 60) {
    const minutes = num / 60;
    displayDuration = `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }

  return displayDuration;
};

export const getNextCheckText = (
  lastRequestAtUnix: number | undefined,
  refreshRateSeconds: number,
): string => {
  if (!lastRequestAtUnix) {
    return "";
  }

  const nowSeconds = Date.now() / 1000;
  const secondsSinceLastCheck = nowSeconds - lastRequestAtUnix;
  const secondsRemaining = refreshRateSeconds - secondsSinceLastCheck;

  if (secondsRemaining <= 0) {
    return "Next check expected shortly.";
  }

  const humanized = dayjs.duration(secondsRemaining, "seconds").humanize();

  return `Next check expected in about ${humanized}.`;
};
