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
