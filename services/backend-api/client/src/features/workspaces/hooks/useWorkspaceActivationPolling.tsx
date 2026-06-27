import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../types";

// Pending activation must survive a navigate-away-and-back while the webhook
// is in flight: payment already succeeded, so the page must not fall back to
// the "activate this workspace" pitch. Session-scoped, keyed per workspace.
const pendingActivationKey = (workspaceId: string) => `workspacePendingActivation:${workspaceId}`;

interface Props {
  workspaceId: string | undefined;
  subscription: Workspace["subscription"] | null;
  refetch: () => void;
}

// Shared post-payment activation state for both the workspace billing page and
// the feeds-page activation empty state. After checkout (or a personal-plan
// conversion) completes, the webhook activates the workspace asynchronously;
// this polls the workspace read until the subscription shows up and drives a
// two-stage polite announcement (payment captured, then provisioning complete).
export const useWorkspaceActivationPolling = ({ workspaceId, subscription, refetch }: Props) => {
  const [awaitingActivation, setAwaitingActivation] = useState(
    () =>
      !!workspaceId && window.sessionStorage.getItem(pendingActivationKey(workspaceId)) !== null,
  );
  const [billingAnnouncement, setBillingAnnouncement] = useState("");

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!awaitingActivation || subscription) {
      // Stage two of the announcement: the subscription landing while we were
      // awaiting activation is the genuine provisioning-complete transition.
      if (awaitingActivation && subscription) {
        // What provisions here is the workspace (the container the plan
        // unlocks), so the announcement names the workspace, not the plan.
        setBillingAnnouncement("Your workspace is now active.");

        // The feed-list refetch on activation is owned by
        // useRefetchFeedsOnWorkspaceActivation at the scope-layout level: this
        // hook's host (the dormant activation empty state) unmounts in the same
        // transition the subscription lands, so a refetch fired here would race
        // its own unmount and the re-homed feeds would not appear.
      }

      if (subscription) {
        setAwaitingActivation(false);

        if (workspaceId) {
          window.sessionStorage.removeItem(pendingActivationKey(workspaceId));
        }
      }

      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refetchRef.current();
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [awaitingActivation, !!subscription]);

  // The checkout path announces payment was captured first; the conversion path
  // has no payment step, so it announces only that confirmation is in flight.
  const beginActivation = (announcement = "Payment successful. Confirming your subscription…") => {
    if (workspaceId) {
      window.sessionStorage.setItem(pendingActivationKey(workspaceId), "1");
    }

    setAwaitingActivation(true);
    setBillingAnnouncement(announcement);
  };

  return { awaitingActivation, beginActivation, billingAnnouncement };
};
