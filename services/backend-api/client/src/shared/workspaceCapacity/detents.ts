export const WORKSPACE_MIN_FEEDS = 70;
export const WORKSPACE_MAX_FEEDS = 1100;
export const WORKSPACE_CAPACITY_QUICK_PICKS = [70, 140, 300, 500, 1100];

export const formatWorkspaceFeedNumber = (feeds: number) => new Intl.NumberFormat().format(feeds);

export const formatWorkspaceFeedCount = (feeds: number) =>
  `${formatWorkspaceFeedNumber(feeds)} feeds`;
