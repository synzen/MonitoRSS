import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "../types";

interface Props {
  subscription: Workspace["subscription"] | null | undefined;
}

/**
 * Refetches the workspace feed list the moment a workspace's subscription first
 * appears (dormant -> active), so feeds re-homed during a personal-plan
 * conversion surface without a manual refresh.
 *
 * This deliberately lives at the scope-layout level rather than inside the
 * activation empty state: that empty state unmounts in the same transition the
 * subscription lands (the gate that renders it closes), so a refetch hosted
 * there races its own unmount. The layout stays mounted across the transition.
 *
 * The invalidation uses refetchType "all" because the feed TABLE query only
 * mounts after the activation gate opens; a default ("active"-only) refetch
 * would skip the not-yet-observed table and it would render stale empty cache.
 */
export const useRefetchFeedsOnWorkspaceActivation = ({ subscription }: Props) => {
  const queryClient = useQueryClient();
  const wasSubscribedRef = useRef(!!subscription);

  useEffect(() => {
    const isSubscribed = !!subscription;

    if (isSubscribed && !wasSubscribedRef.current) {
      queryClient.invalidateQueries({ queryKey: ["user-feeds"], refetchType: "all" });
    }

    wasSubscribedRef.current = isSubscribed;
  }, [!!subscription, queryClient]);
};
