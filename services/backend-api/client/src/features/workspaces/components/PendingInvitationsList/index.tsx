import { useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Skeleton,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { getStandardErrorCodeMessage, ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { notifySuccess } from "@/utils/notifySuccess";
import {
  useAcceptWorkspaceInvite,
  useDeclineWorkspaceInvite,
  useMyWorkspaceInvites,
} from "../../hooks";
import { WorkspaceInvite } from "../../types";

const LIVE_STATUS_TEXT: Record<string, string> = {
  loading: "Loading your invitations",
  success: "Invitations loaded",
};

/**
 * A single pending invitation. The accept/decline mutations are instantiated per row
 * so each invitation tracks its own in-flight state — accepting one doesn't disable
 * the controls on the others, and the row that's mutating can't be double-submitted.
 */
const InviteRow = ({ invite }: { invite: WorkspaceInvite }) => {
  const { mutateAsync: accept, status: acceptStatus } = useAcceptWorkspaceInvite();
  const { mutateAsync: decline, status: declineStatus } = useDeclineWorkspaceInvite();
  // Persisted inline (not a toast) so the failure reason stays on the row that
  // produced it — e.g. you are already a member of this workspace.
  const [actionError, setActionError] = useState<{ title: string; description: string } | null>(
    null,
  );

  const isAccepting = acceptStatus === "loading";
  const isDeclining = declineStatus === "loading";

  const resolveErrorMessage = (err: unknown): string => {
    const code = (err as ApiAdapterError)?.errorCode as ApiErrorCode | undefined;

    return code ? getStandardErrorCodeMessage(code) : (err as Error).message;
  };

  const onAccept = async () => {
    setActionError(null);

    try {
      await accept(invite.id);
      notifySuccess(`You've joined ${invite.workspaceName}.`);
    } catch (err) {
      setActionError({
        title: "Failed to accept the invitation",
        description: resolveErrorMessage(err),
      });
    }
  };

  const onDecline = async () => {
    setActionError(null);

    try {
      await decline(invite.id);
      notifySuccess("Invitation declined.");
    } catch (err) {
      setActionError({
        title: "Failed to decline the invitation",
        description: resolveErrorMessage(err),
      });
    }
  };

  return (
    <Stack as="li" borderWidth={1} borderColor="border.emphasized" rounded="md" p={4} gap={3}>
      <Box>
        <Text fontWeight={600}>{invite.workspaceName}</Text>
        <Text color="fg.muted" fontSize="sm">
          Invited as {invite.role} · {invite.email}
        </Text>
      </Box>
      {actionError && (
        <InlineErrorAlert title={actionError.title} description={actionError.description} />
      )}
      <HStack gap={2} flexWrap="wrap">
        <PrimaryActionButton
          size="sm"
          onClick={onAccept}
          loading={isAccepting}
          loadingText="Accepting..."
          disabled={isDeclining}
        >
          Accept
        </PrimaryActionButton>
        <Button
          size="sm"
          variant="outline"
          onClick={onDecline}
          loading={isDeclining}
          loadingText="Declining..."
          disabled={isAccepting}
        >
          Decline
        </Button>
      </HStack>
    </Stack>
  );
};

/**
 * The caller's pending workspace invitations (keyed server-side on their verified
 * email). A user invited to multiple workspaces under the same email sees them all
 * and can accept or decline each independently. Renders nothing when there are no
 * pending invitations, so it can sit unobtrusively on the Account Settings page.
 */
export const PendingInvitationsList = () => {
  const { invites, status, error, refetch } = useMyWorkspaceInvites();

  if (status === "loading") {
    return (
      <Stack gap={3} aria-busy="true">
        <VisuallyHidden aria-live="polite">{LIVE_STATUS_TEXT[status]}</VisuallyHidden>
        <Skeleton height="60px" borderRadius="md" />
      </Stack>
    );
  }

  if (status === "error") {
    return (
      <Box>
        <InlineErrorAlert title="Failed to load your invitations" description={error?.message} />
        <Button size="sm" mt={3} onClick={() => refetch()}>
          Try again
        </Button>
      </Box>
    );
  }

  if (!invites?.length) {
    return null;
  }

  return (
    <Stack as="section" aria-label="Pending invitations" gap={4}>
      <VisuallyHidden aria-live="polite">{LIVE_STATUS_TEXT[status] ?? ""}</VisuallyHidden>
      <Heading as="h2" size="md">
        Pending invitations
      </Heading>
      <Stack as="ul" role="list" listStyleType="none" gap={3}>
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
      </Stack>
    </Stack>
  );
};
