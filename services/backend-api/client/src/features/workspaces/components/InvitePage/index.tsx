import { useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { pages } from "@/constants";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useUserMe } from "@/features/discordUser";
import { getStandardErrorCodeMessage, ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { notifySuccess } from "@/utils/notifySuccess";
import {
  useAcceptWorkspaceInvite,
  useDeclineWorkspaceInvite,
  useSendInviteVerification,
  useWorkspaceInvite,
} from "../../hooks";
import { VerifyEmailStep } from "../VerifyEmailStep";

// Client-side guardrail for the verify step when the invited address is withheld
// (caller's verified email doesn't match, so we only have the redacted hint like
// `a***@example.com`). Blocks sending a code to an address that can't be the
// invited one, so the invite flow never emails an unrelated inbox. NOT a security
// boundary — the server enforces the real match and the hint is already shown.
const matchesEmailHint = (email: string, hint: string): boolean => {
  const at = hint.lastIndexOf("@");

  if (at <= 0) {
    return false;
  }

  const hintFirstChar = hint[0]?.toLowerCase();
  const hintDomain = hint.slice(at + 1).toLowerCase();
  const trimmed = email.trim().toLowerCase();
  const emailAt = trimmed.lastIndexOf("@");

  if (emailAt <= 0) {
    return false;
  }

  return trimmed[0] === hintFirstChar && trimmed.slice(emailAt + 1) === hintDomain;
};

/**
 * Invitation landing page (`/invites/:inviteId`). A logged-out user reaching this
 * route is sent through Discord OAuth by `RequireAuth`, which preserves the path,
 * and returns here. The invited email is resolved from the invitation itself,
 * never the URL: if it doesn't match the user's verified email, the page guides
 * them to verify the invited address before accepting.
 */
export const InvitePage = () => {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { invite, status, error, refetch } = useWorkspaceInvite({ inviteId });
  const { data: userMe } = useUserMe();
  const verifiedEmail = userMe?.result.verifiedEmail;
  const discordEmail = userMe?.result.email;

  const { mutateAsync: accept, status: acceptStatus } = useAcceptWorkspaceInvite();
  const { mutateAsync: decline, status: declineStatus } = useDeclineWorkspaceInvite();
  const { mutateAsync: sendInviteVerification } = useSendInviteVerification();
  // The accept/decline failure is persisted inline (not a transient toast) so the
  // reason — e.g. you are already a member of this workspace — stays on screen
  // next to the action that produced it.
  const [actionError, setActionError] = useState<{ title: string; description: string } | null>(
    null,
  );

  if (status === "loading") {
    return (
      <Box width="100%" maxW="640px" px={4} py={12} aria-busy="true">
        <HStack justifyContent="center">
          <VisuallyHidden aria-live="polite">Loading invitation</VisuallyHidden>
          <Spinner />
        </HStack>
      </Box>
    );
  }

  if (status === "error" || !invite) {
    return (
      <Box width="100%" maxW="640px" px={4} py={12}>
        <Stack gap={4}>
          <Heading as="h1" size="lg">
            Invitation unavailable
          </Heading>
          <InlineErrorAlert
            title="Couldn't load this invitation"
            description={
              error?.message ??
              "This invitation no longer exists. It may have already been accepted, declined, or revoked."
            }
          />
          <Box>
            <Button onClick={() => refetch()}>Try again</Button>
          </Box>
        </Stack>
      </Box>
    );
  }

  // The caller already belongs to this workspace (the case an owner hits opening
  // their own invite). Short-circuit BEFORE the verify step: pushing them through
  // email verification would overwrite their verified email for an accept the
  // server rejects anyway. Leave the invite pending so the intended person can
  // still claim it on a different account.
  if (invite.alreadyMember) {
    return (
      <Box width="100%" maxW="640px" px={4} py={12}>
        <Stack gap={4}>
          <Heading as="h1" size="lg">
            {invite.workspaceName}
          </Heading>
          <Text color="fg.muted">
            You&apos;re already a member of <strong>{invite.workspaceName}</strong>, so there&apos;s
            nothing to accept. This invitation stays open for whoever it was sent to.
          </Text>
          <Box>
            <Button onClick={() => navigate(pages.userFeeds())}>Go to your feeds</Button>
          </Box>
        </Stack>
      </Box>
    );
  }

  // The invited address. The GET endpoint returns the full `email` ONLY when the
  // server has confirmed the caller's verified email matches; otherwise we get a
  // redacted `emailHint` so a prober cannot harvest the address. So a present
  // full email is itself the authoritative match signal.
  const invitedEmailDisplay = invite.email ?? invite.emailHint;
  const emailMatches = !!invite.email;
  // The user has proven ownership of some email, but it isn't the invited one
  // (so the server withheld the full address and returned only the hint).
  const hasMismatchedVerifiedEmail = !!verifiedEmail && !emailMatches;
  const isAccepting = acceptStatus === "loading";
  const isDeclining = declineStatus === "loading";

  const resolveErrorMessage = (err: unknown): string => {
    const code = (err as ApiAdapterError)?.errorCode as ApiErrorCode | undefined;

    return code ? getStandardErrorCodeMessage(code) : (err as Error).message;
  };

  const onAccept = async () => {
    setActionError(null);

    try {
      const { result } = await accept(invite.id);
      notifySuccess(`You've joined ${invite.workspaceName}.`);
      // Drop the invitee straight into the workspace they just joined, rather
      // than their personal feeds — that's the place they came here to reach.
      navigate(pages.userFeeds({ workspaceSlug: result.workspaceSlug }));
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
      navigate(pages.userFeeds());
    } catch (err) {
      setActionError({
        title: "Failed to decline the invitation",
        description: resolveErrorMessage(err),
      });
    }
  };

  return (
    <Box width="100%" maxW="640px" px={4} py={12}>
      <Stack gap={6}>
        <Stack gap={2}>
          <Text color="fg.muted" fontSize="sm">
            You&apos;ve been invited to join
          </Text>
          <Heading as="h1" size="lg">
            {invite.workspaceName}
          </Heading>
          <Text color="fg.muted">
            This invitation was sent to <strong>{invitedEmailDisplay}</strong>.
          </Text>
        </Stack>
        {emailMatches ? (
          <Stack gap={4}>
            {actionError && (
              <InlineErrorAlert title={actionError.title} description={actionError.description} />
            )}
            <HStack gap={3} flexWrap="wrap">
              <PrimaryActionButton
                onClick={onAccept}
                loading={isAccepting}
                loadingText="Accepting..."
                disabled={isDeclining}
              >
                Accept invitation
              </PrimaryActionButton>
              <Button
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
        ) : (
          <Box borderWidth={1} borderColor="border.emphasized" rounded="md" p={5}>
            <VerifyEmailStep
              defaultEmail={invite.email || discordEmail}
              lockEmail={!!invite.email}
              onSendCode={(email) =>
                sendInviteVerification({ inviteId: invite.id, details: { email } })
              }
              validateEmail={(email) =>
                // When the address is withheld (only the hint is known), block a
                // send to anything that can't be the invited address before it
                // leaves the browser. When invite.email is present the field is
                // locked, so this guard never rejects the correct value.
                invite.email || matchesEmailHint(email, invite.emailHint)
                  ? undefined
                  : `Enter the address this invitation was sent to (${invite.emailHint}).`
              }
              intro={
                hasMismatchedVerifiedEmail ? (
                  <>
                    You&apos;ve verified <strong>{verifiedEmail}</strong>, but this invitation was
                    sent to <strong>{invitedEmailDisplay}</strong>. Verify the invited address to
                    continue.
                  </>
                ) : (
                  <>
                    To accept this invitation, verify that you own{" "}
                    <strong>{invitedEmailDisplay}</strong>, the address it was sent to. We&apos;ll
                    send a one-time code to confirm it.
                  </>
                )
              }
              onVerified={() => {
                queryClient.invalidateQueries({ queryKey: ["user-me"] });
                // Re-fetch the invite: now that the invited email is verified,
                // the server discloses the full address and the match unlocks
                // the accept action (emailMatches derives from invite.email).
                refetch();
              }}
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
};
