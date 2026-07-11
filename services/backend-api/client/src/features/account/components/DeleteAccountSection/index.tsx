import { useEffect, useId, useRef, useState } from "react";
import { Box, Button, Input, List, Stack, Text, VisuallyHidden, chakra } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { SettingsSection } from "@/components/SettingsSection";
import { getStandardErrorCodeMessage, ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import type ApiAdapterError from "@/utils/ApiAdapterError";
import { ProductKey } from "@/constants";
import { useUserMe } from "../../../discordUser";
import { getLogout } from "../../../auth";
import { useSendAccountDeletionCode, useDeleteMyAccount } from "../../hooks";

const CODE_REGEX = /^[0-9]{6}$/;
// Mirrors the server's resend cooldown and code TTL. UX disclosures only; the
// server remains the source of truth for both limits.
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_TTL_MINUTES = 10;

// Same inline-prose action link as VerifyEmailStep's resend, so the Resend
// action reads as part of the helper sentence rather than as a button.
const InlineLink = chakra("button", {
  base: {
    display: "inline",
    p: 0,
    minW: 0,
    h: "auto",
    verticalAlign: "baseline",
    fontSize: "inherit",
    lineHeight: "inherit",
    fontWeight: "inherit",
    color: "text.link",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    bg: "transparent",
    cursor: "pointer",
  },
});

const resolveErrorMessage = (err: ApiAdapterError): string => {
  const code = err.errorCode as ApiErrorCode | undefined;

  return code ? getStandardErrorCodeMessage(code) : err.message;
};

type Stage = "consequences" | "code" | "deleted";

/**
 * GDPR right-to-erasure entry point: a danger section that opens a staged
 * confirmation dialog. Stage 1 spells out what erasure destroys and sends a
 * one-time code to the verified email; stage 2 consumes the code with the
 * final destructive confirm; stage 3 confirms success and routes every exit
 * through logout, since the session now points at an erased user.
 */
export const DeleteAccountSection = () => {
  const { data } = useUserMe();
  const [isOpen, setIsOpen] = useState(false);

  const user = data?.result;
  const verifiedEmail = user?.verifiedEmail;
  // Mirrors the server-side ACCOUNT_DELETE_ACTIVE_SUBSCRIPTION guard so the
  // common blockers are explained up front instead of as a failed request. A
  // guardrail only — the server re-checks at send and delete time.
  const hasBlockingSubscription =
    !!user?.enableBilling &&
    user.subscription.product.key !== ProductKey.Free &&
    user.subscription.status !== "CANCELLED" &&
    !user.subscription.cancellationDate;

  return (
    <SettingsSection
      title="Delete Account"
      description="Permanently erase your account and its data from MonitoRSS. This cannot be undone."
    >
      <Box>
        <DestructiveActionButton size="sm" onClick={() => setIsOpen(true)}>
          <span>Delete account</span>
        </DestructiveActionButton>
      </Box>
      {/* Keyed on open so an abandoned attempt (e.g. code sent, then closed)
          restarts from the first stage on the next open instead of resuming on
          the code-entry screen with stale state. */}
      <DeleteAccountDialog
        key={isOpen ? "open" : "closed"}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        verifiedEmail={verifiedEmail}
        hasBlockingSubscription={hasBlockingSubscription}
        isOnPatreon={!!user?.isOnPatreon}
      />
    </SettingsSection>
  );
};

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  verifiedEmail?: string;
  hasBlockingSubscription: boolean;
  isOnPatreon: boolean;
}

const DeleteAccountDialog = ({
  isOpen,
  onClose,
  verifiedEmail,
  hasBlockingSubscription,
  isOnPatreon,
}: DialogProps) => {
  const [stage, setStage] = useState<Stage>("consequences");
  const [code, setCode] = useState("");
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [sendAnnouncement, setSendAnnouncement] = useState("");
  const [sendError, setSendError] = useState<ApiAdapterError | undefined>(undefined);
  const [isLeaving, setIsLeaving] = useState(false);
  const sendCountRef = useRef(0);

  // A stable id lets the footer's destructive confirm (host-owned DOM outside
  // the form) submit the code-entry form, so Enter in the field also submits.
  const confirmFormId = `${useId()}-confirm`;

  const { mutateAsync: sendCode, status: sendStatus } = useSendAccountDeletionCode();
  const {
    mutateAsync: deleteAccount,
    status: deleteStatus,
    error: deleteError,
  } = useDeleteMyAccount();

  const trimmedCode = code.trim();
  const codeValid = CODE_REGEX.test(trimmedCode);
  const isSending = sendStatus === "loading";
  const isDeleting = deleteStatus === "loading";
  const inCooldown = cooldownRemaining > 0;
  const blocked = !verifiedEmail || hasBlockingSubscription;

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => setCooldownRemaining((prev) => prev - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // The only way out after erasure: the session cookie references a deleted
  // user, so every exit (button, Escape, close trigger) signs out and leaves
  // for the public site instead of returning to a broken authenticated app.
  const leaveAfterDeletion = async () => {
    if (isLeaving) {
      return;
    }

    setIsLeaving(true);

    try {
      await getLogout();
    } catch (err) {
      // The session may already be unusable; the redirect below still applies.
    }

    window.location.assign("https://monitorss.xyz");
  };

  const handleSendCode = async (event: React.SyntheticEvent) => {
    event.preventDefault();

    if (isSending || inCooldown || blocked) {
      return;
    }

    setSendError(undefined);

    try {
      await sendCode();
      setStage("code");
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      sendCountRef.current += 1;
      setSendAnnouncement(
        `${sendCountRef.current > 1 ? "New code sent" : "Code sent"} to ${verifiedEmail}. ` +
          `You can resend in ${RESEND_COOLDOWN_SECONDS} seconds.`,
      );
    } catch (err) {
      setSendError(err as ApiAdapterError);
    }
  };

  const handleDelete = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setConfirmAttempted(true);

    if (!codeValid || isDeleting) {
      return;
    }

    try {
      await deleteAccount({ details: { code: trimmedCode } });
      setStage("deleted");
    } catch {
      // Surfaced via deleteError below
    }
  };

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (stage === "consequences") {
    body = (
      <Stack gap={4}>
        <Text>Deleting your account permanently erases:</Text>
        <List.Root paddingLeft={4}>
          <List.Item>All of your personal feeds and their connections</List.Item>
          <List.Item>Your Reddit connection</List.Item>
          <List.Item>Your workspace memberships and pending invitations</List.Item>
          <List.Item>Your emails, notification settings, and preferences</List.Item>
        </List.Root>
        <Text fontSize="sm" color="fg.muted">
          Financial records required for legal compliance are retained with your email address
          removed. This cannot be undone.
        </Text>
        {isOnPatreon && (
          <Alert status="warning" role={undefined} title="You have a Patreon pledge">
            Deleting your account does not cancel your Patreon pledge. Cancel it on patreon.com to
            avoid further charges.
          </Alert>
        )}
        {!verifiedEmail && (
          <Alert status="warning" role={undefined} title="Verified email required">
            Deleting your account requires confirming a code sent to your verified email. Verify an
            email in the Email section of this page, then return here.
          </Alert>
        )}
        {verifiedEmail && hasBlockingSubscription && (
          <Alert status="warning" role={undefined} title="Active subscription">
            You have an active subscription. Cancel it in the Billing section of this page; once it
            is cancelled, you can delete your account.
          </Alert>
        )}
        {!blocked && (
          <Text>
            To continue, we&apos;ll send a one-time confirmation code to{" "}
            <chakra.strong>{verifiedEmail}</chakra.strong>.
          </Text>
        )}
        {sendError && (
          <InlineErrorAlert
            title="Failed to send code"
            description={resolveErrorMessage(sendError)}
          />
        )}
      </Stack>
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {!blocked && (
          <PrimaryActionButton
            loading={isSending}
            loadingText="Sending..."
            onClick={handleSendCode}
          >
            Send confirmation code
          </PrimaryActionButton>
        )}
      </>
    );
  } else if (stage === "code") {
    body = (
      <form id={confirmFormId} onSubmit={handleDelete} noValidate>
        <Stack gap={4}>
          <Text>
            We sent a 6-digit code to <chakra.strong>{verifiedEmail}</chakra.strong>. Enter it below
            to permanently delete your account.
          </Text>
          <VisuallyHidden aria-live="polite">{sendAnnouncement}</VisuallyHidden>
          <Field
            label="Confirmation code"
            invalid={confirmAttempted && !codeValid}
            required
            errorText={
              confirmAttempted && !codeValid ? "Enter the 6-digit code from your email." : undefined
            }
            helperText={
              confirmAttempted && !codeValid
                ? undefined
                : `The code expires in ${CODE_TTL_MINUTES} minutes.`
            }
          >
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          {deleteError && (
            <InlineErrorAlert
              title="Failed to delete account"
              description={resolveErrorMessage(deleteError)}
            />
          )}
          {sendError && (
            <InlineErrorAlert
              title="Failed to resend code"
              description={resolveErrorMessage(sendError)}
            />
          )}
          <Text fontSize="sm" color="fg.muted">
            Didn&apos;t get it?{" "}
            <InlineLink
              type="button"
              aria-label="Resend code"
              aria-disabled={isSending || inCooldown}
              onClick={(e) => {
                if (isSending || inCooldown) {
                  e.preventDefault();

                  return;
                }

                setSendAnnouncement("");
                handleSendCode(e);
              }}
            >
              {inCooldown ? `Resend code (${cooldownRemaining}s)` : "Resend code"}
            </InlineLink>
            .
          </Text>
        </Stack>
      </form>
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={confirmFormId}
          variant="solid"
          colorPalette="red"
          loading={isDeleting}
          loadingText="Deleting..."
        >
          Permanently delete account
        </Button>
      </>
    );
  } else {
    body = (
      <Stack gap={4}>
        <Text>Your account and its data have been deleted.</Text>
        <Text fontSize="sm" color="fg.muted">
          Thank you for using MonitoRSS. You will be signed out when you leave this page.
        </Text>
      </Stack>
    );
    footer = (
      <PrimaryActionButton
        loading={isLeaving}
        loadingText="Leaving..."
        onClick={leaveAfterDeletion}
      >
        Return to homepage
      </PrimaryActionButton>
    );
  }

  return (
    <DialogRoot
      role="alertdialog"
      open={isOpen}
      onOpenChange={(e) => {
        if (e.open) {
          return;
        }

        if (stage === "deleted") {
          leaveAfterDeletion();

          return;
        }

        onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>{body}</DialogBody>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
