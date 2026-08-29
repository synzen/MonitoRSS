import { VisibilityState } from "@tanstack/react-table";
import { UserFeedComputedStatus } from "../../types";

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [50, 100] as const;
export const FEED_TABLE_FOCUS_KEY = "monitorss.feed-table-focus";

/**
 * The "Shared with Me" column. It distinguishes feeds shared into a user's
 * personal view from their own, which only has meaning in personal scope: every
 * feed in a workspace is shared with members by definition. Workspace-scoped
 * tables omit it.
 */
export const SHARED_WITH_ME_COLUMN_ID = "ownedByUser";

export const PREFERENCE_DEBOUNCE_MS = 500;

export const STATUS_FILTERS = [
  {
    label: "Ok",
    description: "Working as expected",
    value: UserFeedComputedStatus.Ok,
  },
  {
    label: "Failed",
    description: "Disabled after too many failures",
    value: UserFeedComputedStatus.RequiresAttention,
  },
  {
    label: "Pending Retry",
    description: "Currently unable to fetch the feed and is pending a retry",
    value: UserFeedComputedStatus.Retrying,
  },
  {
    label: "Manually Disabled",
    description: "Manually disabled",
    value: UserFeedComputedStatus.ManuallyDisabled,
  },
  {
    label: "Feed Limit Exceeded",
    description: "Disabled because the feed limit was exceeded",
    value: UserFeedComputedStatus.FeedLimitExceeded,
  },
] as const;

export const TOGGLEABLE_COLUMNS = [
  { id: "computedStatus", label: "Status" },
  { id: "url", label: "URL" },
  { id: "createdAt", label: "Added On" },
  { id: "refreshRateSeconds", label: "Refresh Rate" },
  { id: SHARED_WITH_ME_COLUMN_ID, label: "Shared with Me" },
] as const;

export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  computedStatus: true,
  url: true,
  createdAt: true,
  refreshRateSeconds: false,
  ownedByUser: true,
};

export const DEFAULT_COLUMN_ORDER = [
  "select",
  "computedStatus",
  "title",
  "url",
  "createdAt",
  "refreshRateSeconds",
  "ownedByUser",
  "configure",
];

export const FIXED_COLUMNS = ["select", "configure"] as const;
