import { MOCK_SMTP_HTTP_PORT } from "./constants";

// The mock mailer runs on the host (like the mock RSS/Discord servers), so its
// HTTP control surface is reachable on localhost from the Playwright process.
const SMTP_HTTP_URL = `http://localhost:${MOCK_SMTP_HTTP_PORT}`;

/**
 * Poll the mock mailer for the latest verification code captured for `email`.
 * The send is async (UI click -> backend -> SMTP), so retry briefly until the
 * code arrives. Returns the 6-digit code or throws if none arrives in time.
 */
export async function waitForVerificationCode(
  email: string,
  { timeoutMs = 15000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const to = encodeURIComponent(email.trim().toLowerCase());

  while (Date.now() < deadline) {
    const res = await fetch(`${SMTP_HTTP_URL}/code?to=${to}`);
    if (res.ok) {
      const { code } = (await res.json()) as { code: string | null };
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`No verification code captured for ${email} within ${timeoutMs}ms`);
}

/**
 * Poll the mock mailer for the invitation link captured for `email` (the
 * /invites/<id> URL in the workspace-invitation notification email). Returns the
 * absolute URL or throws if none arrives in time.
 */
export async function waitForInviteLink(
  email: string,
  { timeoutMs = 15000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const to = encodeURIComponent(email.trim().toLowerCase());

  while (Date.now() < deadline) {
    const res = await fetch(`${SMTP_HTTP_URL}/invite-link?to=${to}`);
    if (res.ok) {
      const { inviteLink } = (await res.json()) as { inviteLink: string | null };
      if (inviteLink) return inviteLink;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`No invitation link captured for ${email} within ${timeoutMs}ms`);
}

/**
 * Non-throwing counterpart to waitForVerificationCode: polls for a short, fixed
 * window and returns the captured code if one arrives, or null if none does.
 * Used to ASSERT NON-DELIVERY — that a code was never sent to a given address —
 * without paying a long timeout for the expected-empty case.
 */
export async function peekVerificationCode(
  email: string,
  { windowMs = 3000, intervalMs = 250 }: { windowMs?: number; intervalMs?: number } = {},
): Promise<string | null> {
  const deadline = Date.now() + windowMs;
  const to = encodeURIComponent(email.trim().toLowerCase());

  while (Date.now() < deadline) {
    const res = await fetch(`${SMTP_HTTP_URL}/code?to=${to}`);
    if (res.ok) {
      const { code } = (await res.json()) as { code: string | null };
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

export interface CapturedMailMessage {
  subject: string | null;
  body: string;
}

/**
 * Poll the mock mailer for the latest full message (subject + decoded body)
 * captured for `email`. Used to assert on alert/digest emails whose content
 * isn't a code or invite link.
 */
export async function waitForMail(
  email: string,
  { timeoutMs = 15000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<CapturedMailMessage> {
  const deadline = Date.now() + timeoutMs;
  const to = encodeURIComponent(email.trim().toLowerCase());

  while (Date.now() < deadline) {
    const res = await fetch(`${SMTP_HTTP_URL}/message?to=${to}`);
    if (res.ok) {
      const { subject, body } = (await res.json()) as {
        subject: string | null;
        body: string | null;
      };
      if (body !== null) return { subject, body };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`No mail captured for ${email} within ${timeoutMs}ms`);
}

/**
 * Non-throwing counterpart to waitForMail: polls for a short, fixed window and
 * returns the captured message if one arrives, or null if none does. Used to
 * ASSERT NON-DELIVERY without paying a long timeout for the expected-empty case.
 */
export async function peekMail(
  email: string,
  { windowMs = 3000, intervalMs = 250 }: { windowMs?: number; intervalMs?: number } = {},
): Promise<CapturedMailMessage | null> {
  const deadline = Date.now() + windowMs;
  const to = encodeURIComponent(email.trim().toLowerCase());

  while (Date.now() < deadline) {
    const res = await fetch(`${SMTP_HTTP_URL}/message?to=${to}`);
    if (res.ok) {
      const { subject, body } = (await res.json()) as {
        subject: string | null;
        body: string | null;
      };
      if (body !== null) return { subject, body };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

/**
 * Clear captured mail before triggering a fresh send. Always pass the addresses
 * the test is about to assert on: specs run in parallel workers against ONE
 * shared catcher, so a global reset deletes mail that sibling specs are still
 * polling for. The no-argument global form exists only for single-spec debugging.
 */
export async function resetCapturedMail(emails?: string | string[]): Promise<void> {
  if (emails === undefined) {
    await fetch(`${SMTP_HTTP_URL}/reset`, { method: "POST" });
    return;
  }
  const list = Array.isArray(emails) ? emails : [emails];
  for (const email of list) {
    const to = encodeURIComponent(email.trim().toLowerCase());
    await fetch(`${SMTP_HTTP_URL}/reset?to=${to}`, { method: "POST" });
  }
}
