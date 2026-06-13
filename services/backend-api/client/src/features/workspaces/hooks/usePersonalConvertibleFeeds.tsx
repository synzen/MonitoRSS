import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getUserFeeds, type UserFeedSummary } from "@/features/feed";

// The owner's personal feeds (workspace scope deliberately omitted, so this is
// the personal list regardless of the page's current feed scope) — the
// candidates for a personal→workspace conversion. Only fetched while the
// convert dialog is open.
export const usePersonalConvertibleFeeds = (opts?: { enabled?: boolean }) => {
  const { data, status, error } = useQuery<{ results: UserFeedSummary[] }, ApiAdapterError>(
    ["personal-convertible-feeds"],
    () => getUserFeeds({ workspaceId: undefined, limit: 1000 }),
    {
      enabled: opts?.enabled !== false,
    },
  );

  return {
    feeds: data?.results ?? [],
    status,
    error,
  };
};
