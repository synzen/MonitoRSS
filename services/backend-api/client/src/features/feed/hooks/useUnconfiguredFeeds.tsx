import { useUserFeeds } from "./useUserFeeds";

export const useUnconfiguredFeeds = (opts?: { enabled?: boolean }) => {
  return useUserFeeds(
    {
      limit: 100,
      offset: 0,
      filters: { hasConnections: false },
    },
    opts,
  );
};
