import { useEffect, useId, useRef, useState } from "react";
import { Box, chakra, Input, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Field } from "@/components/ui/field";
import { getStandardErrorCodeMessage, ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import type ApiAdapterError from "@/utils/ApiAdapterError";
import { useSendEmailVerification, useConfirmEmailVerification } from "../../hooks";
import { useVerifyEmailFooter } from "./VerifyEmailFooterContext";

export { VerifyEmailFooterHost, VerifyEmailFooterActions } from "./VerifyEmailFooterContext";

interface Props {
  defaultEmail?: string;
  onVerified: () => void;
  /**
   * Replaces the default "verify an email to create a workspace" intro. Used by the
   * invitation flow, where the email being verified is the invited address.
   */
  intro?: React.ReactNode;
  /**
   * When the email to verify is fixed (e.g. the invited address), lock the field
   * so it can't be changed — verifying a different address wouldn't claim the
   * invitation.
   */
  lockEmail?: boolean;
  /**
   * Overrides how the verification code is requested. Defaults to the generic
   * `/@me/email-verification` send. The invitation flow passes the invite-scoped
   * send so the server only ever emails the invited address.
   */
  onSendCode?: (email: string) => Promise<void>;
  /**
   * Client-side guard run before sending. Return an error message to block the
   * send (e.g. the typed address doesn't match the invited one), or undefined to
   * allow it. A guardrail only — the real enforcement is server-side.
   */
  validateEmail?: (email: string) => string | undefined;
}

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_REGEX = /^[0-9]{6}$/;
// Mirrors the server's RESEND_COOLDOWN_MS / CODE_TTL_MS. These are UX disclosures,
// not enforcement — the server remains the source of truth for both limits.
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_TTL_MINUTES = 10;

// An inline text link that inherits the surrounding sentence's typography, so the
// Resend / Change email actions read as part of the helper prose rather than as
// buttons with their own type scale (which sit off the sentence's baseline).
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

// Prefer the standardized, friendly message for a known error code (e.g. the 429
// resend cooldown, an invalid/expired code) over the raw server string, falling
// back to the message when the error carries no code.
const resolveErrorMessage = (err: ApiAdapterError): string => {
  const code = err.errorCode as ApiErrorCode | undefined;

  return code ? getStandardErrorCodeMessage(code) : err.message;
};

/**
 * Passwordless proof-of-ownership of an email: send a 6-digit code to an owned
 * address, then confirm it. Pre-fills the Discord
 * email for convenience but always requires confirmation — Discord's value is
 * a default, not proof. No password anywhere.
 */
export const VerifyEmailStep = ({
  defaultEmail,
  onVerified,
  intro,
  lockEmail,
  onSendCode,
  validateEmail,
}: Props) => {
  // When a dialog host wraps the step in VerifyEmailFooterHost, the primary
  // action (Send code / Verify) is published up to the host's real DialogFooter
  // instead of rendered in the body. A full-page host (the invite page) has no
  // such context, so the button stays in the body.
  const footer = useVerifyEmailFooter();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendAttempted, setSendAttempted] = useState(false);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [guardError, setGuardError] = useState<string | undefined>(undefined);
  // Tracks the in-flight send across BOTH paths: the local `sendCode` mutation
  // and the injected `onSendCode` (invite flow). `sendStatus` only reflects the
  // former, so the button needs its own flag to show a loading state when the
  // invite-scoped send is used.
  const [isSending, setIsSending] = useState(false);
  // Client-side disclosure of the server's resend cooldown. Counts down from
  // RESEND_COOLDOWN_SECONDS after each successful send so the user sees why the
  // resend is unavailable instead of clicking into a silent 429.
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  // Single polite announcement made once per successful send. Carries the resend
  // availability to screen-reader users WITHOUT the per-second spam a live
  // countdown would cause; the visible "(Ns)" tick stays out of any live region.
  const [sendAnnouncement, setSendAnnouncement] = useState("");
  // Owned by the component, NOT read off the local mutation's `error`: the send
  // can run through EITHER the local `sendCode` OR the injected `onSendCode`
  // (invite flow), and the local hook's error is blind to the latter. Capturing
  // the thrown error here surfaces a failure (e.g. the 429 resend cooldown) on
  // whichever path actually ran.
  const [sendError, setSendError] = useState<ApiAdapterError | undefined>(undefined);
  const sendCountRef = useRef(0);

  // The send/confirm forms carry stable ids so the primary button can submit
  // them from the dialog footer (a host-owned DOM subtree outside the form).
  const formIdBase = useId();
  const sendFormId = `${formIdBase}-send`;
  const confirmFormId = `${formIdBase}-confirm`;

  const { mutateAsync: sendCode, reset: resetSend } = useSendEmailVerification();
  const {
    mutateAsync: confirmCode,
    status: confirmStatus,
    error: confirmError,
  } = useConfirmEmailVerification();

  const trimmedEmail = email.trim();
  const trimmedCode = code.trim();
  const emailValid = EMAIL_REGEX.test(trimmedEmail);
  const codeValid = CODE_REGEX.test(trimmedCode);
  const isConfirming = confirmStatus === "loading";
  const inCooldown = cooldownRemaining > 0;

  // Drives the visible countdown. Decrements once a second while active; the tick
  // is intentionally NOT an aria-live region (see the resend button below) so a
  // screen reader is not spammed every second.
  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => setCooldownRemaining((prev) => prev - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  const handleSendCode = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setSendAttempted(true);

    if (!emailValid || isSending || inCooldown) {
      return;
    }

    const guardMessage = validateEmail?.(trimmedEmail);

    if (guardMessage) {
      setGuardError(guardMessage);

      return;
    }

    setGuardError(undefined);
    setSendError(undefined);
    setIsSending(true);

    try {
      if (onSendCode) {
        await onSendCode(trimmedEmail);
      } else {
        await sendCode({ details: { email: trimmedEmail } });
      }

      setCodeSent(true);
      setSendAttempted(false);
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      sendCountRef.current += 1;
      // First send vs. resend get distinct phrasing; both note the cooldown once.
      setSendAnnouncement(
        `${sendCountRef.current > 1 ? "New code sent" : "Code sent"} to ${trimmedEmail}. ` +
          `You can resend in ${RESEND_COOLDOWN_SECONDS} seconds.`,
      );
    } catch (err) {
      // Captured from whichever path ran (local send OR injected invite send) and
      // rendered in both the address and code-entry views below.
      setSendError(err as ApiAdapterError);
    } finally {
      setIsSending(false);
    }
  };

  const onConfirm = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setConfirmAttempted(true);

    if (!codeValid || isConfirming) {
      return;
    }

    try {
      await confirmCode({
        details: { email: trimmedEmail, code: trimmedCode },
      });
      onVerified();
    } catch {
      // Surfaced via confirmError below
    }
  };

  const onChangeEmail = () => {
    setCodeSent(false);
    setCode("");
    setSendAttempted(false);
    setConfirmAttempted(false);
    setGuardError(undefined);
    setSendError(undefined);
    setCooldownRemaining(0);
    resetSend();
  };

  const sendButton = (
    <PrimaryActionButton
      type="submit"
      form={sendFormId}
      loading={isSending}
      loadingText="Sending..."
    >
      Send code
    </PrimaryActionButton>
  );

  const verifyButton = (
    <PrimaryActionButton
      type="submit"
      form={confirmFormId}
      loading={isConfirming}
      loadingText="Verifying..."
    >
      Verify
    </PrimaryActionButton>
  );

  // The primary action (and its loading signature) follows the current view. A
  // single publisher owns the footer slot for the whole step, so swapping views
  // can't leave a stale/cleared button behind (two per-branch publishers raced
  // their mount-set against the other's unmount-clear).
  const primaryButton = codeSent ? verifyButton : sendButton;
  const primarySignature = codeSent ? `verify:${isConfirming}` : `send:${isSending}`;

  const body = !codeSent ? (
    <form id={sendFormId} onSubmit={handleSendCode} noValidate>
      <Stack gap={4}>
        <Text>
          {intro ?? (
            <>
              To create a workspace, first verify an email address you own. We&apos;ll send a
              one-time code to confirm it.
            </>
          )}
        </Text>
        <Field
          label="Email address"
          invalid={(sendAttempted && !emailValid) || !!guardError}
          required
          errorText={
            // eslint-disable-next-line no-nested-ternary
            guardError ||
            (sendAttempted && !emailValid ? "Enter a valid email address." : undefined)
          }
          helperText={
            // eslint-disable-next-line no-nested-ternary
            lockEmail || !defaultEmail
              ? undefined
              : (sendAttempted && !emailValid) || guardError
                ? undefined
                : "Pre-filled with your Discord email. Change it if you'd prefer a different address."
          }
        >
          <Input
            type="email"
            autoComplete="email"
            value={email}
            readOnly={lockEmail}
            onChange={(e) => {
              setEmail(e.target.value);
              if (guardError) setGuardError(undefined);
            }}
          />
        </Field>
        {sendError && (
          <InlineErrorAlert
            title="Failed to send code"
            description={resolveErrorMessage(sendError)}
          />
        )}
        {!footer?.hasHost && <Box>{sendButton}</Box>}
      </Stack>
    </form>
  ) : (
    <form id={confirmFormId} onSubmit={onConfirm} noValidate>
      <Stack gap={4}>
        <Text>
          We sent a 6-digit code to <strong>{trimmedEmail}</strong>. Enter it below to verify.
        </Text>
        <VisuallyHidden aria-live="polite">{sendAnnouncement}</VisuallyHidden>
        <Field
          label="Verification code"
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
        {confirmError && (
          <InlineErrorAlert
            title="Failed to verify"
            description={resolveErrorMessage(confirmError)}
          />
        )}
        {sendError && (
          <InlineErrorAlert
            title="Failed to resend code"
            description={resolveErrorMessage(sendError)}
          />
        )}
        {/* Resend / Change email are field-level helpers about the code, so they
            read as inline prose under the field rather than as a row of buttons.
            aria-disabled (not disabled) keeps Resend focusable and announceable
            while it's inert during the cooldown/send; the accessible name stays
            "Resend code" — the ticking "(Ns)" is visual-only and not in a live
            region. */}
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

              handleSendCode(e);
            }}
          >
            {inCooldown ? `Resend code (${cooldownRemaining}s)` : "Resend code"}
          </InlineLink>
          {!lockEmail && (
            <>
              {" "}
              or{" "}
              <InlineLink type="button" onClick={onChangeEmail}>
                change email
              </InlineLink>
            </>
          )}
          .
        </Text>
        {!footer?.hasHost && <Box>{verifyButton}</Box>}
      </Stack>
    </form>
  );

  return (
    <FooterPublisher footer={footer} button={primaryButton} signature={primarySignature}>
      {body}
    </FooterPublisher>
  );
};

// Publishes the step's current primary button into the host's DialogFooter (via
// VerifyEmailFooterHost) for as long as this view is mounted, clearing it on
// unmount/view-swap so a stale button never lingers in the footer. With no host
// (full-page invite flow) it's a passthrough; the step renders the button inline.
//
// The effect keys on `signature` (a stable string of the inputs that change the
// button), NOT on the button node itself — the node is a fresh element every
// render, which would re-run the effect every render and loop.
const FooterPublisher = ({
  footer,
  button,
  signature,
  children,
}: {
  footer: ReturnType<typeof useVerifyEmailFooter>;
  button: React.ReactNode;
  signature: string;
  children: React.ReactNode;
}) => {
  const setPrimaryButton = footer?.setPrimaryButton;
  // The latest button is read through a ref so the publish effect can key on the
  // stable `signature` (a fresh button node every render would loop the effect).
  const buttonRef = useRef(button);
  buttonRef.current = button;

  useEffect(() => {
    if (!setPrimaryButton) {
      return undefined;
    }

    setPrimaryButton(buttonRef.current);

    return () => setPrimaryButton(null);
  }, [setPrimaryButton, signature]);

  return children as React.ReactElement;
};
