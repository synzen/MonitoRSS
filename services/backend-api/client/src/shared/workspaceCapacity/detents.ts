export const WORKSPACE_MIN_FEEDS = 70;
export const WORKSPACE_MAX_FEEDS = 2000;
export const WORKSPACE_CAPACITY_QUICK_PICKS = [70, 140, 300, 500, 1000, 2000];
// Coarse stops for the change-capacity dialog's slider, which is the one surface
// still on a detent model (the buy surfaces use the exact CapacityPicker). The
// list ends at the capacity ceiling so even a non-detent capacity can be raised.
// The slice-2 picker rework of that dialog retires this list.
export const WORKSPACE_DETENTS = [70, 100, 140, 200, 300, 500, 1000, 2000];

export const formatWorkspaceFeedNumber = (feeds: number) => new Intl.NumberFormat().format(feeds);

export const formatWorkspaceFeedCount = (feeds: number) =>
  `${formatWorkspaceFeedNumber(feeds)} feeds`;
