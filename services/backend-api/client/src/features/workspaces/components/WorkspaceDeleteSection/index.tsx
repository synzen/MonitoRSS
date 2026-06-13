import { useState } from "react";
import { Box } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal, SettingsSection } from "@/components";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { pages } from "@/constants";
import { ApiErrorCode, getStandardErrorCodeMessage } from "@/utils/getStandardErrorCodeMessage";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts";
import { useDeleteWorkspace } from "../../hooks";

// Owner-only; hidden (not disabled) for admins, matching the rest of the app's
// no-dead-UI posture.
export const WorkspaceDeleteSection = () => {
  const workspace = useCurrentWorkspace();
  const { isConfigured: isPaddleConfigured } = usePaddleContext();
  const navigate = useNavigate();
  const { mutateAsync: deleteWorkspace, error, reset } = useDeleteWorkspace();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!workspace || workspace.myRole !== "owner") {
    return null;
  }

  const onConfirm = async () => {
    await deleteWorkspace(workspace.slug);
    // The feeds page reads this on mount and raises a persistent (dismissable)
    // alert there; a page-scoped alert raised here would unmount on navigate.
    navigate(pages.userFeeds(), {
      state: {
        alertTitle: "Team deleted",
        alertDescription: `${workspace.name} and all of its feeds have been deleted.`,
      },
    });
  };

  return (
    <SettingsSection
      title="Delete team"
      description="Permanently delete this team and all of its feeds for every member. This cannot be undone."
    >
      <Box>
        <DestructiveActionButton onClick={() => setConfirmOpen(true)}>
          Delete team
        </DestructiveActionButton>
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
        title="Delete this team?"
        description={`This will permanently delete ${workspace.name} and all of its feeds for every member.${
          isPaddleConfigured ? " Any active subscription will be cancelled." : ""
        } This cannot be undone.`}
        confirmationPhrase={workspace.name}
        colorScheme="red"
        okText="Delete team"
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
