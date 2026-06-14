import { useEffect, useRef, useState } from "react";
import { Box, Button, HStack, Input, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Field } from "@/components/ui/field";
import { getStandardErrorCodeMessage, ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import type ApiAdapterError from "@/utils/ApiAdapterError";
import { useSendEmailVerification, useConfirmEmailVerification } from "../../hooks";

interface Props {
  defaultEmail?: string;
  onVerified: () => void;
  /**
   * Replaces the default "verify an email to create a team" intro. Used by the
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

  if (!codeSent) {
    return (
      <form onSubmit={handleSendCode} noValidate>
        <Stack gap={4}>
          <Text>
            {intro ?? (
              <>
                To create a team, first verify an email address you own. We&apos;ll send a one-time
                code to confirm it.
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
          <Box>
            <PrimaryActionButton type="submit" loading={isSending} loadingText="Sending...">
              Send code
            </PrimaryActionButton>
          </Box>
        </Stack>
      </form>
    );
  }

  return (
    <form onSubmit={onConfirm} noValidate>
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
        <HStack justifyContent="space-between">
          <HStack gap={1}>
            {/* aria-disabled (not disabled) keeps the control focusable and
                announceable while it's inert during the cooldown/send. The
                accessible name stays "Resend code" — the ticking "(Ns)" is
                visual-only and deliberately not in a live region. */}
            <Button
              type="button"
              variant="plain"
              aria-label="Resend code"
              aria-disabled={isSending || inCooldown}
              loading={isSending}
              loadingText="Sending..."
              onClick={(e) => {
                if (isSending || inCooldown) {
                  e.preventDefault();

                  return;
                }

                handleSendCode(e);
              }}
            >
              {inCooldown ? `Resend code (${cooldownRemaining}s)` : "Resend code"}
            </Button>
            {!lockEmail && (
              <>
                <Text aria-hidden>·</Text>
                <Button type="button" variant="plain" onClick={onChangeEmail}>
                  Change email
                </Button>
              </>
            )}
          </HStack>
          <PrimaryActionButton type="submit" loading={isConfirming} loadingText="Verifying...">
            Verify
          </PrimaryActionButton>
        </HStack>
      </Stack>
    </form>
  );
};
