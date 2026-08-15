import { getUserFeeds, type GetUserFeedsInput } from "../api";
import { useUserFeedsInfinite } from "./useUserFeedsInfinite";

type OwnedPersonalFeedsInput = Omit<GetUserFeedsInput, "filters" | "search" | "workspaceId">;

export const useOwnedPersonalFeeds = (input: OwnedPersonalFeedsInput) => {
  const query = useUserFeedsInfinite(
    { ...input, filters: { ownedByUser: true } },
    { forcePersonal: true },
  );

  const getByAge = (direction: "newest" | "oldest", limit: number) =>
    getUserFeeds({
      filters: { ownedByUser: true },
      limit,
      offset: 0,
      sort: direction === "newest" ? "-createdAt" : "createdAt",
    });

  return { ...query, getByAge };
};
