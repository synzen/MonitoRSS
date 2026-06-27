import { useState } from "react";
import { Box, Link as ChakraLink, Text } from "@chakra-ui/react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { ConfirmModal, SettingsSection } from "@/components";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { pages } from "@/constants";
import { ApiErrorCode, getStandardErrorCodeMessage } from "@/utils/getStandardErrorCodeMessage";
import { useCurrentWorkspace } from "../../contexts";
import { useDeleteWorkspace } from "../../hooks";
import { WorkspaceSubscription } from "../../types";

// Mirrors the backend's hasBlockingSubscription: a live subscription (any
// status other than fully cancelled, and not yet scheduled to cancel) must be
// cancelled before the workspace can be deleted. A subscription already
// scheduled to cancel (cancellationDate set) no longer blocks.
const hasBlockingSubscription = (subscription?: WorkspaceSubscription | null) =>
  !!subscription && subscription.status !== "CANCELLED" && !subscription.cancellationDate;

// Owner-only; hidden (not disabled) for admins, matching the rest of the app's
// no-dead-UI posture.
export const WorkspaceDeleteSection = () => {
  const workspace = useCurrentWorkspace();
  const navigate = useNavigate();
  const { mutateAsync: deleteWorkspace, error, reset } = useDeleteWorkspace();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!workspace || workspace.myRole !== "owner") {
    return null;
  }

  const isBlockedBySubscription = hasBlockingSubscription(workspace.subscription);

  const onConfirm = async () => {
    await deleteWorkspace(workspace.slug);
    // The feeds page reads this on mount and raises a persistent (dismissable)
    // alert there; a page-scoped alert raised here would unmount on navigate.
    navigate(pages.userFeeds(), {
      state: {
        alertTitle: "Workspace deleted",
        alertDescription: `${workspace.name} and all of its feeds have been deleted.`,
      },
    });
  };

  return (
    <SettingsSection
      title="Delete workspace"
      description="Permanently delete this workspace and all of its feeds for every member. This cannot be undone."
    >
      <Box>
        <DestructiveActionButton
          onClick={() => setConfirmOpen(true)}
          disabled={isBlockedBySubscription}
        >
          Delete workspace
        </DestructiveActionButton>
        {isBlockedBySubscription && (
          <Text mt={2} fontSize="sm" color="fg.muted">
            Cancel this workspace&apos;s subscription on the{" "}
            <ChakraLink asChild color="text.link" textDecoration="underline">
              <RouterLink to={pages.workspaceBilling(workspace.slug)}>billing page</RouterLink>
            </ChakraLink>{" "}
            before deleting it.
          </Text>
        )}
      </Box>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);

          // Clear a stale failure so reopening starts clean.
          if (!open) {
            reset();
          }
        }}
        title="Delete this workspace?"
        description={`This will permanently delete ${workspace.name} and all of its feeds for every member. This cannot be undone.`}
        confirmationPhrase={workspace.name}
        colorScheme="red"
        okText="Delete workspace"
        error={
          error
            ? (error.errorCode && getStandardErrorCodeMessage(error.errorCode as ApiErrorCode)) ||
              error.message
            : undefined
        }
        onConfirm={onConfirm}
      />
    </SettingsSection>
  );
};
