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

export const getNextCheckText = (nextRetryAtIso?: string | null): string => {
  if (!nextRetryAtIso) {
    return "";
  }

  const nextRetryMs = new Date(nextRetryAtIso).getTime();

  if (Number.isNaN(nextRetryMs)) {
    return "";
  }

  const secondsRemaining = (nextRetryMs - Date.now()) / 1000;

  if (secondsRemaining <= 0) {
    return "Next check expected shortly.";
  }

  const humanized = dayjs.duration(secondsRemaining, "seconds").humanize();

  return `Next check expected in about ${humanized}.`;
};
