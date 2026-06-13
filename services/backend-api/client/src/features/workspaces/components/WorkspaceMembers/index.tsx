import { useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Skeleton,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { InferType, object, string } from "yup";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { ConfirmModal, SettingsSection } from "@/components";
import { Field } from "@/components/ui/field";
import { pages } from "@/constants";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { DiscordUsername, useDiscordUser, useUserMe } from "@/features/discordUser";
import { getStandardErrorCodeMessage, ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { useCurrentWorkspace } from "../../contexts";
import {
  useCreateWorkspaceInvite,
  useLeaveWorkspace,
  useRemoveWorkspaceMember,
  useResendWorkspaceInvite,
  useRevokeWorkspaceInvite,
  useTransferWorkspaceOwnership,
  useWorkspaceInvitesForWorkspace,
  useWorkspaceMembers,
} from "../../hooks";
import { WorkspaceManagedInvite, WorkspaceMember } from "../../types";

dayjs.extend(relativeTime);

// Prefer the standardized, friendly message for a known error code (e.g.
// CANNOT_REMOVE_LAST_OWNER) over the raw server string. Mirrors the InviteForm
// handler so every member-management mutation reports failures consistently.
const resolveErrorMessage = (err?: ApiAdapterError | null): string | undefined => {
  if (!err) {
    return undefined;
  }

  const code = err.errorCode as ApiErrorCode | undefined;

  return code ? getStandardErrorCodeMessage(code) : err.message;
};

const inviteFormSchema = object({
  email: string()
    .required("Email address is required")
    .email("Enter a valid email address")
    .max(254, "Email address is too long"),
});

type InviteFormData = InferType<typeof inviteFormSchema>;

const LIVE_STATUS_TEXT: Record<string, string> = {
  loading: "Loading members",
  success: "Members loaded",
};

const InviteForm = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { createSuccessAlert } = usePageAlertContext();
  const { mutateAsync } = useCreateWorkspaceInvite();
  const {
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({
    resolver: yupResolver(inviteFormSchema),
    mode: "onSubmit",
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: InviteFormData) => {
    try {
      await mutateAsync({ workspaceSlug, email });
      reset({ email: "" });
      createSuccessAlert({
        title: "Invitation sent",
        description: `An invitation email has been sent to ${email}.`,
      });
    } catch (err) {
      const apiError = err as ApiAdapterError;
      const code = apiError?.errorCode as ApiErrorCode | undefined;
      setError("email", {
        message: code ? getStandardErrorCodeMessage(code) : (err as Error).message,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Inputs stay readable-width even though the section row spans the page. */}
      <Stack gap={3} maxW="xl">
        <Field
          label="Invite by email"
          invalid={!!errors.email}
          errorText={errors.email?.message}
          helperText="The invitee will receive an email to join this team."
        >
          <HStack gap={2} alignItems="flex-start">
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input {...field} type="email" placeholder="name@example.com" />
              )}
            />
            <PrimaryActionButton type="submit" loading={isSubmitting} loadingText="Sending...">
              Send invite
            </PrimaryActionButton>
          </HStack>
        </Field>
      </Stack>
    </form>
  );
};

const MemberRow = ({
  member,
  isSelf,
  canManageOthers,
  workspaceSlug,
}: {
  member: WorkspaceMember;
  isSelf: boolean;
  canManageOthers: boolean;
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  const { createSuccessAlert } = usePageAlertContext();
  const workspace = useCurrentWorkspace();
  // Resolve the same username DiscordUsername shows, so each row's controls get a
  // human-readable accessible name instead of an undifferentiated "Remove" or a
  // raw snowflake. React Query dedupes this against the DiscordUsername fetch.
  const { data: discordUser } = useDiscordUser({ userId: member.discordUserId });
  const memberName = discordUser?.result.username ?? "this member";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const {
    mutateAsync: removeMember,
    error: removeError,
    reset: resetRemove,
  } = useRemoveWorkspaceMember();
  const { mutateAsync: leave, error: leaveError, reset: resetLeave } = useLeaveWorkspace();
  const {
    mutateAsync: transferOwnership,
    error: transferError,
    reset: resetTransfer,
  } = useTransferWorkspaceOwnership();

  const onConfirm = async () => {
    if (isSelf) {
      await leave(workspaceSlug);
      // The feeds page reads this on mount and raises a persistent (dismissable)
      // alert there; a page-scoped alert raised here would unmount on navigate.
      navigate(pages.userFeeds(), {
        state: {
          alertTitle: "Left team",
          alertDescription: workspace?.name
            ? `You are no longer a member of ${workspace.name}.`
            : undefined,
        },
      });
    } else {
      await removeMember({ workspaceSlug, userId: member.userId });
      createSuccessAlert({
        title: "Member removed",
        description: workspace?.name
          ? `This member no longer has access to ${workspace.name} and its feeds.`
          : "This member no longer has access to this team and its feeds.",
      });
    }
  };

  const onConfirmTransfer = async () => {
    await transferOwnership({ workspaceSlug, userId: member.userId });
    createSuccessAlert({
      title: "Ownership transferred",
      description: workspace?.name
        ? `This member is now the owner of ${workspace.name}. You are now an admin.`
        : "This member is now the owner of this team. You are now an admin.",
    });
  };

  const error = isSelf ? leaveError : removeError;
  const showRemove = isSelf || canManageOthers;
  // Ownership can only be handed to another admin (never to oneself or to a
  // co-owner). The server re-checks eligibility, including the verified-email
  // gate the client cannot see, so this only governs whether the affordance is
  // offered, not the authorization itself.
  const showTransfer = !isSelf && canManageOthers && member.role === "admin";
  // The workspace's subscription stays on the previous owner's payment method
  // after a transfer until the new owner updates it, so warn only when there is
  // actually a live subscription to bill.
  const hasSubscription = !!workspace?.subscription;

  const onOpenChange = (open: boolean) => {
    setConfirmOpen(open);

    if (!open) {
      resetLeave();
      resetRemove();
    }
  };

  const onTransferOpenChange = (open: boolean) => {
    setTransferOpen(open);

    if (!open) {
      resetTransfer();
    }
  };

  return (
    <Stack
      as="li"
      borderWidth={1}
      borderColor="border.emphasized"
      rounded="md"
      p={4}
      gap={2}
      direction={{ base: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ base: "flex-start", sm: "center" }}
    >
      <Box>
        <Text fontWeight={600}>
          <DiscordUsername userId={member.discordUserId} />
          {isSelf ? " (you)" : ""}
        </Text>
        <Text color="fg.muted" fontSize="sm" textTransform="capitalize">
          {member.role}
        </Text>
      </Box>
      {(showRemove || showTransfer) && (
        <HStack gap={2}>
          {showTransfer && (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Make ${memberName} the owner`}
              onClick={() => setTransferOpen(true)}
            >
              Make owner
            </Button>
          )}
          {showRemove && (
            <DestructiveActionButton
              size="sm"
              aria-label={isSelf ? "Leave team" : `Remove ${memberName} from the team`}
              onClick={() => setConfirmOpen(true)}
            >
              {isSelf ? "Leave team" : "Remove"}
            </DestructiveActionButton>
          )}
        </HStack>
      )}
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={onOpenChange}
        title={isSelf ? "Leave this team?" : "Remove this member?"}
        description={
          isSelf
            ? "You will lose access to this team and its feeds. You can rejoin only if invited again."
            : "This member will lose access to this team and its feeds. They can rejoin only if invited again."
        }
        colorScheme="red"
        okText={isSelf ? "Leave team" : "Remove member"}
        error={resolveErrorMessage(error)}
        onConfirm={onConfirm}
      />
      {showTransfer && (
        <ConfirmModal
          open={transferOpen}
          onOpenChange={onTransferOpenChange}
          title="Transfer ownership?"
          descriptionNode={
            <Stack gap={3}>
              <Text>
                This member will become the owner of this team, and you will become an admin. Only
                the owner can delete the team or manage its billing.
              </Text>
              {hasSubscription && (
                <Text>
                  This team&apos;s subscription will keep billing your payment method until the new
                  owner updates it from the billing settings.
                </Text>
              )}
            </Stack>
          }
          confirmationPhrase={workspace?.name}
          okText="Transfer ownership"
          error={resolveErrorMessage(transferError)}
          onConfirm={onConfirmTransfer}
        />
      )}
    </Stack>
  );
};

const InviteRow = ({
  invite,
  invitedByYou,
  workspaceSlug,
}: {
  invite: WorkspaceManagedInvite;
  invitedByYou: boolean;
  workspaceSlug: string;
}) => {
  const { createSuccessAlert } = usePageAlertContext();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const {
    mutateAsync: revoke,
    error: revokeError,
    reset: resetRevoke,
  } = useRevokeWorkspaceInvite();
  const {
    mutateAsync: resend,
    error: resendError,
    reset: resetResend,
  } = useResendWorkspaceInvite();

  const onRevokeOpenChange = (open: boolean) => {
    setRevokeOpen(open);

    if (!open) {
      resetRevoke();
    }
  };

  const onResendOpenChange = (open: boolean) => {
    setResendOpen(open);

    if (!open) {
      resetResend();
    }
  };

  return (
    <Stack
      as="li"
      borderWidth={1}
      borderColor="border.emphasized"
      rounded="md"
      p={4}
      gap={2}
      direction={{ base: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ base: "flex-start", sm: "center" }}
    >
      <Box>
        <Text fontWeight={600}>{invite.email}</Text>
        <Text color="fg.muted" fontSize="sm">
          Invited {invitedByYou ? "by you " : ""}
          {dayjs(invite.createdAt).fromNow()} · {invite.role}
        </Text>
      </Box>
      <HStack gap={2}>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Resend invitation to ${invite.email}`}
          onClick={() => setResendOpen(true)}
        >
          Resend
        </Button>
        <DestructiveActionButton
          size="sm"
          aria-label={`Revoke invitation to ${invite.email}`}
          onClick={() => setRevokeOpen(true)}
        >
          Revoke
        </DestructiveActionButton>
      </HStack>
      <ConfirmModal
        open={resendOpen}
        onOpenChange={onResendOpenChange}
        title="Resend this invitation?"
        description={`Another invitation email will be sent to ${invite.email}.`}
        okText="Resend invitation"
        error={resolveErrorMessage(resendError)}
        onConfirm={async () => {
          await resend({ workspaceSlug, inviteId: invite.id });
          createSuccessAlert({
            title: "Invitation resent",
            description: `Another invitation email has been sent to ${invite.email}.`,
          });
        }}
      />
      <ConfirmModal
        open={revokeOpen}
        onOpenChange={onRevokeOpenChange}
        title="Revoke this invitation?"
        description={`The invitation to ${invite.email} will be revoked.`}
        colorScheme="red"
        okText="Revoke invitation"
        error={resolveErrorMessage(revokeError)}
        onConfirm={async () => {
          await revoke({ workspaceSlug, inviteId: invite.id });
        }}
      />
    </Stack>
  );
};

/**
 * The owner/admin member-management view. Lists current members with roles and
 * outstanding pending invitations, and provides invite/revoke/remove/leave
 * controls. Remove-other is owner-only (gated on the caller's role from the
 * workspace detail); every member can leave.
 */
export const WorkspaceMembers = () => {
  const workspace = useCurrentWorkspace();
  const { data: userMe } = useUserMe({ enabled: true });
  const {
    members,
    status: membersStatus,
    error: membersError,
    refetch: refetchMembers,
  } = useWorkspaceMembers({ workspaceSlug: workspace?.slug });
  const {
    invites,
    status: invitesStatus,
    error: invitesError,
    refetch: refetchInvites,
  } = useWorkspaceInvitesForWorkspace({ workspaceSlug: workspace?.slug });

  if (!workspace) {
    return null;
  }

  const selfUserId = userMe?.result.id;
  const canManageOthers = workspace.myRole === "owner";

  return (
    <SettingsSection
      title="Members"
      description="People with access to this team and its feeds. Invitations that haven't been accepted yet can be resent or revoked."
    >
      <VisuallyHidden aria-live="polite">{LIVE_STATUS_TEXT[membersStatus] ?? ""}</VisuallyHidden>
      <InviteForm workspaceSlug={workspace.slug} />
      {membersStatus === "loading" && (
        <Stack gap={3} aria-busy="true">
          <Skeleton height="60px" borderRadius="md" />
          <Skeleton height="60px" borderRadius="md" />
        </Stack>
      )}
      {membersStatus === "error" && (
        <Box>
          <InlineErrorAlert title="Failed to load members" description={membersError?.message} />
          <Button size="sm" mt={3} onClick={() => refetchMembers()}>
            Try again
          </Button>
        </Box>
      )}
      {membersStatus === "success" && (
        <Stack as="ul" role="list" listStyleType="none" gap={3}>
          {members?.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isSelf={!!selfUserId && member.userId === selfUserId}
              canManageOthers={canManageOthers}
              workspaceSlug={workspace.slug}
            />
          ))}
        </Stack>
      )}
      {/* A facet of member management, not a peer section: the invite sent just
          above lands here, so the loop closes within the same row. */}
      <Stack as="section" aria-label="Pending invitations" gap={3} marginTop={4}>
        <VisuallyHidden aria-live="polite">
          {invitesStatus === "loading" ? "Loading invitations" : ""}
        </VisuallyHidden>
        <Heading as="h3" size="sm">
          Pending invitations
        </Heading>
        {invitesStatus === "loading" && (
          <Stack gap={3} aria-busy="true">
            <Skeleton height="60px" borderRadius="md" />
          </Stack>
        )}
        {invitesStatus === "error" && (
          <Box>
            <InlineErrorAlert
              title="Failed to load invitations"
              description={invitesError?.message}
            />
            <Button size="sm" mt={3} onClick={() => refetchInvites()}>
              Try again
            </Button>
          </Box>
        )}
        {invitesStatus === "success" &&
          (invites?.length ? (
            <Stack as="ul" role="list" listStyleType="none" gap={3}>
              {invites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  invitedByYou={!!selfUserId && invite.invitedByUserId === selfUserId}
                  workspaceSlug={workspace.slug}
                />
              ))}
            </Stack>
          ) : (
            <Text color="fg.muted">There are no pending invitations.</Text>
          ))}
      </Stack>
    </SettingsSection>
  );
};
