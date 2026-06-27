import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { EmailVerificationService } from "../../src/features/users/email-verification.service";
import type { SmtpTransport } from "../../src/infra/smtp";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface ErrorResult {
  code: string;
}

describe("Email verification API", () => {
  let ctx: AppTestContext;
  let sent: Array<{ to: string; code: string }>;
  let mail: Array<{ to: string; subject: string; html: string }>;
  let paddleCustomerUpdates: Array<{ id: string; email: string }>;

  before(async () => {
    // A from-domain is required for the sender address (createFromFormatter);
    // the fake transport below stands in for an actual SMTP server.
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_SMTP_FROM_DOMAIN: "example.com",
        // Billing enabled so the verified-email change propagates to owned
        // workspace Paddle customers (the sync is a no-op when billing is off).
        BACKEND_API_ENABLE_SUPPORTERS: true,
        BACKEND_API_PADDLE_KEY: "test-paddle-key",
        BACKEND_API_PADDLE_URL: "https://sandbox.paddle.test",
      },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  // Swap in a capturing mailer so the real send→confirm endpoints can be
  // exercised without an SMTP server (the harness leaves SMTP unconfigured).
  beforeEach(() => {
    sent = [];
    mail = [];
    paddleCustomerUpdates = [];
    const fakeTransport = {
      sendMail: async (msg: { to: string; subject: string; html: string }) => {
        mail.push({ to: msg.to, subject: msg.subject, html: String(msg.html) });
        // Scope to the code cell so the email shell's 6-digit style constants
        // are not mistaken for the verification code.
        const match = /class="email-code"[^>]*>\s*(\d{6})\s*</.exec(
          String(msg.html),
        );
        sent.push({ to: msg.to, code: match?.[1] ?? "" });
        return {};
      },
    } as unknown as SmtpTransport;

    const capturingPaddleService = makePaddleServiceWith(
      async (id: string, data: { email: string }) => {
        paddleCustomerUpdates.push({ id, email: data.email });
      },
    );

    ctx.container.emailVerificationService = new EmailVerificationService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      emailVerificationRepository: ctx.container.emailVerificationRepository,
      userRepository: ctx.container.userRepository,
      workspaceRepository: ctx.container.workspaceRepository,
      paddleService: capturingPaddleService,
    });
  });

  // A real PaddleService instance with only updateCustomer swapped, so it stays
  // structurally a PaddleService (its other methods live on the prototype) while
  // the test observes or fails the one call the sync makes.
  function makePaddleServiceWith(
    updateCustomer: (id: string, data: { email: string }) => Promise<void>,
  ): typeof ctx.container.paddleService {
    const stub = Object.create(
      Object.getPrototypeOf(ctx.container.paddleService),
    );
    Object.assign(stub, ctx.container.paddleService, { updateCustomer });
    return stub;
  }

  async function makeUser() {
    const discordUserId = randomUUID();
    await ctx.container.userRepository.create({ discordUserId });
    const user = await ctx.asUser(discordUserId);
    const internalId =
      await ctx.container.userRepository.findIdByDiscordId(discordUserId);
    return { discordUserId, user, internalId: internalId as string };
  }

  it("sends a code and confirms it, setting verifiedEmail", async () => {
    const { user, internalId } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    const sendRes = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    assert.strictEqual(sendRes.status, 200);
    assert.strictEqual(sent.length, 1);

    const captured = sent[0];
    assert.ok(captured);
    assert.strictEqual(captured.to, email.toLowerCase());
    assert.match(captured.code, /^\d{6}$/);

    const confirmRes = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      { method: "POST", body: JSON.stringify({ email, code: captured.code }) },
    );
    assert.strictEqual(confirmRes.status, 200);

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, email.toLowerCase());
  });

  it("syncs the new verified email to the owned workspace's Paddle customer on confirm", async () => {
    const { user, internalId } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    const workspace = await ctx.container.workspaceRepository.createWorkspaceWithOwner(
      {
        name: `WS ${randomUUID()}`,
        slug: `ws-${randomUUID()}`,
        ownerUserId: internalId,
      },
    );
    await ctx.connection.collection("workspaces").updateOne(
      { _id: new Types.ObjectId(workspace.id) },
      {
        $set: {
          paddleCustomer: {
            customerId: "ctm_sync_target",
            email: "old-verified@example.com",
            subscription: { status: "ACTIVE" },
          },
        },
      },
    );

    await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    const code = sent[0]!.code;

    const confirmRes = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      { method: "POST", body: JSON.stringify({ email, code }) },
    );
    assert.strictEqual(confirmRes.status, 200);

    assert.deepStrictEqual(paddleCustomerUpdates, [
      { id: "ctm_sync_target", email: email.toLowerCase() },
    ]);
  });

  it("still commits the verified email when the Paddle billing-email sync fails", async () => {
    const { user, internalId } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    // Force the billing sync to throw; the email change must still commit.
    ctx.container.emailVerificationService = new EmailVerificationService({
      config: ctx.container.config,
      smtpTransport: {
        sendMail: async (msg: { to: string; subject: string; html: string }) => {
          const match = /class="email-code"[^>]*>\s*(\d{6})\s*</.exec(
            String(msg.html),
          );
          sent.push({ to: msg.to, code: match?.[1] ?? "" });
          return {};
        },
      } as unknown as SmtpTransport,
      emailVerificationRepository: ctx.container.emailVerificationRepository,
      userRepository: ctx.container.userRepository,
      workspaceRepository: ctx.container.workspaceRepository,
      paddleService: makePaddleServiceWith(async () => {
        throw new Error("paddle down");
      }),
    });

    const workspace = await ctx.container.workspaceRepository.createWorkspaceWithOwner(
      {
        name: `WS ${randomUUID()}`,
        slug: `ws-${randomUUID()}`,
        ownerUserId: internalId,
      },
    );
    await ctx.connection.collection("workspaces").updateOne(
      { _id: new Types.ObjectId(workspace.id) },
      {
        $set: {
          paddleCustomer: {
            customerId: "ctm_fail",
            email: "old@example.com",
            subscription: { status: "ACTIVE" },
          },
        },
      },
    );

    await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const confirmRes = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      { method: "POST", body: JSON.stringify({ email, code: sent[0]!.code }) },
    );
    assert.strictEqual(confirmRes.status, 200);

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, email.toLowerCase());
  });

  it("rejects an incorrect code", async () => {
    const { user } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const res = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      { method: "POST", body: JSON.stringify({ email, code: "000000" }) },
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "EMAIL_VERIFICATION_INVALID_CODE",
    );
  });

  it("rejects an expired code", async () => {
    const { user, internalId } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    await ctx.connection.collection("emailverifications").insertOne({
      userId: new Types.ObjectId(internalId),
      email: email.toLowerCase(),
      codeHash: "deadbeef",
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      { method: "POST", body: JSON.stringify({ email, code: "123456" }) },
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "EMAIL_VERIFICATION_EXPIRED",
    );
  });

  it("rejects confirmation after too many attempts (429) and clears the code", async () => {
    const { user, internalId } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    await ctx.connection.collection("emailverifications").insertOne({
      userId: new Types.ObjectId(internalId),
      email: email.toLowerCase(),
      codeHash: "deadbeef",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      { method: "POST", body: JSON.stringify({ email, code: "123456" }) },
    );
    assert.strictEqual(res.status, 429);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS",
    );

    const remaining = await ctx.connection
      .collection("emailverifications")
      .countDocuments({ userId: new Types.ObjectId(internalId) });
    assert.strictEqual(remaining, 0);
  });

  it("blocks a new distinct target once the per-user cap is reached, but allows re-sending to an already-targeted address", async () => {
    const { user } = await makeUser();
    // These tests intentionally exceed the per-IP send limit, so give this test
    // its own source IP (trustProxy is on) to isolate it from the shared bucket.
    const headers = { "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 250) + 1}` };

    // Five distinct addresses succeed (the cap is 5 distinct targets / hour).
    for (let i = 0; i < 5; i += 1) {
      const email = `cap-${i}-${randomUUID()}@example.com`;
      const res = await user.fetch("/api/v1/users/@me/email-verification", {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
      });
      assert.strictEqual(res.status, 200, `distinct target #${i + 1} should send`);
    }

    // A sixth, brand-new distinct address is rejected by the distinct-target cap.
    const sixth = `cap-6-${randomUUID()}@example.com`;
    const blocked = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: sixth }),
    });
    assert.strictEqual(blocked.status, 429);
    assert.strictEqual(
      (await readJson<ErrorResult>(blocked)).code,
      "EMAIL_VERIFICATION_TOO_MANY_TARGETS",
    );

    // No code was dispatched for the blocked sixth address.
    assert.ok(!sent.some((s) => s.to === sixth.toLowerCase()));
  });

  it("does not count re-sends to an already-targeted address against the cap", async () => {
    const { user } = await makeUser();
    const headers = { "x-forwarded-for": `203.0.114.${Math.floor(Math.random() * 250) + 1}` };

    // Reach the cap with five distinct targets.
    const firstEmail = `repeat-${randomUUID()}@example.com`;
    const firstRes = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: firstEmail }),
    });
    assert.strictEqual(firstRes.status, 200);

    for (let i = 1; i < 5; i += 1) {
      const email = `repeat-${i}-${randomUUID()}@example.com`;
      const res = await user.fetch("/api/v1/users/@me/email-verification", {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
      });
      assert.strictEqual(res.status, 200);
    }

    // Re-sending to the first (already-targeted) address is NOT blocked by the
    // distinct-target cap — only the 60s cooldown gates it. Clear the active
    // code so the cooldown does not interfere with this assertion.
    await ctx.connection
      .collection("emailverifications")
      .deleteMany({ email: firstEmail.toLowerCase() });

    const resend = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: firstEmail }),
    });
    assert.strictEqual(resend.status, 200);
  });

  it("returns a standardized 429 (not a 500) when the per-user send limit is exceeded", async () => {
    const { user } = await makeUser();
    // The per-route send limit is 10/hour, keyed by the authenticated user (not
    // the source IP), so this fresh user owns its own bucket. Distinct emails so
    // each request reaches the limiter.
    let lastStatus = 0;
    let lastBody: ErrorResult = { code: "" };
    // 11 requests: the 11th must be rejected by the rate-limit plugin (before the
    // handler). Earlier requests may be 200 or handler-level 429s — we only care
    // that the plugin-level rejection is a clean 429, not a masked 500.
    for (let i = 0; i < 11; i += 1) {
      const res = await user.fetch("/api/v1/users/@me/email-verification", {
        method: "POST",
        body: JSON.stringify({ email: `ip-${i}-${randomUUID()}@example.com` }),
      });
      lastStatus = res.status;
      lastBody = await readJson<ErrorResult>(res).catch(() => ({ code: "" }));
    }

    assert.strictEqual(lastStatus, 429, "rate-limit rejection must be 429, not 500");
    assert.strictEqual(lastBody.code, "TOO_MANY_REQUESTS");
  });

  it("rejects a too-soon resend with 429", async () => {
    const { user } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    const first = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    assert.strictEqual(first.status, 200);

    const second = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    assert.strictEqual(second.status, 429);
    assert.strictEqual(
      (await readJson<ErrorResult>(second)).code,
      "EMAIL_VERIFICATION_RESEND_TOO_SOON",
    );
  });

  it("preserves plus-addressing and dots in email normalization", async () => {
    const { user, internalId } = await makeUser();
    const rawEmail = "Foo.Bar+tag@Example.com";
    const expectedNormalized = "foo.bar+tag@example.com";

    const sendRes = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email: rawEmail }),
    });
    assert.strictEqual(sendRes.status, 200);
    assert.strictEqual(sent.length, 1);

    const captured = sent[0];
    assert.ok(captured);
    // Mailer must receive the normalized address (lowercased, dots/plus intact)
    assert.strictEqual(captured.to, expectedNormalized);

    const confirmRes = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      {
        method: "POST",
        body: JSON.stringify({ email: rawEmail, code: captured.code }),
      },
    );
    assert.strictEqual(confirmRes.status, 200);

    const updated = await ctx.container.userRepository.findById(internalId);
    // Stored verifiedEmail must be lowercased but keep plus-tag and dots intact
    assert.strictEqual(updated?.verifiedEmail, expectedNormalized);
  });

  it("stores codeHash as an HMAC hex digest, not the plaintext code", async () => {
    const { user, internalId } = await makeUser();
    const email = `${randomUUID()}@example.com`;

    const sendRes = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    assert.strictEqual(sendRes.status, 200);

    const captured = sent[0];
    assert.ok(captured);
    assert.match(captured.code, /^\d{6}$/);

    const record = await ctx.connection
      .collection("emailverifications")
      .findOne({ userId: new Types.ObjectId(internalId) });
    assert.ok(record, "emailverification record must exist after send");

    // The stored hash must NOT equal the plaintext 6-digit code
    assert.notStrictEqual(
      record["codeHash"],
      captured.code,
      "codeHash must not be the plaintext code",
    );

    // The stored hash must look like a SHA-256 HMAC hex string (64 hex chars)
    assert.match(
      String(record["codeHash"]),
      /^[0-9a-f]{64}$/,
      "codeHash must be a 64-char lowercase hex string",
    );
  });

  // Drives the real send + confirm endpoints to verify `email` for `user`,
  // returning the captured OTP. Mirrors the happy-path test above. A dedicated
  // source IP isolates the caller from the shared per-IP send bucket (trustProxy
  // is on), matching the rate-limit tests above.
  async function verifyEmailThroughFlow(
    user: Awaited<ReturnType<typeof makeUser>>["user"],
    email: string,
    headers: Record<string, string>,
  ): Promise<void> {
    const sendRes = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    });
    assert.strictEqual(sendRes.status, 200);
    const captured = sent[sent.length - 1];
    assert.ok(captured);
    const confirmRes = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      { method: "POST", body: JSON.stringify({ email, code: captured.code }) },
    );
    assert.strictEqual(confirmRes.status, 200);
  }

  function dedicatedIp(): Record<string, string> {
    return {
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    };
  }

  it("overwrites an existing verified email when a different address is confirmed", async () => {
    const { user, internalId } = await makeUser();
    const headers = dedicatedIp();
    const firstEmail = `${randomUUID()}@example.com`;
    const secondEmail = `${randomUUID()}@example.com`;

    await verifyEmailThroughFlow(user, firstEmail, headers);
    await verifyEmailThroughFlow(user, secondEmail, headers);

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, secondEmail.toLowerCase());
  });

  it("sends a change notice disclosing the full new address to the old address", async () => {
    const { user } = await makeUser();
    const headers = dedicatedIp();
    const oldEmail = `old-${randomUUID()}@example.com`;
    const newEmail = `new-${randomUUID()}@example.com`;

    await verifyEmailThroughFlow(user, oldEmail, headers);
    await verifyEmailThroughFlow(user, newEmail, headers);

    const notice = mail.find(
      (m) =>
        m.to === oldEmail.toLowerCase() && !m.html.includes('class="email-code"'),
    );
    assert.ok(notice, "a change notice should be sent to the old address");
    assert.ok(
      notice.html.includes(newEmail.toLowerCase()),
      "the change notice should disclose the full new address",
    );
  });

  it("includes a working revert link in the change notice sent to the old address", async () => {
    const { user, internalId } = await makeUser();
    const headers = dedicatedIp();
    const oldEmail = `old-${randomUUID()}@example.com`;
    const newEmail = `new-${randomUUID()}@example.com`;

    await verifyEmailThroughFlow(user, oldEmail, headers);
    await verifyEmailThroughFlow(user, newEmail, headers);

    const notice = mail.find(
      (m) =>
        m.to === oldEmail.toLowerCase() && !m.html.includes('class="email-code"'),
    );
    assert.ok(notice, "a change notice should be sent to the old address");

    // Extract the revert token from the link in the notice and drive it through
    // the real revert route; the verified email must return to the old address.
    // The href is HTML-entity-escaped (`=` → `&#x3D;`), as a browser would decode
    // it; the token itself is base64url so it survives escaping intact.
    const match = /revert\?token(?:=|&#x3D;)([A-Za-z0-9_.-]+)/.exec(notice.html);
    assert.ok(match, "the change notice should contain a revert link with a token");
    const token = match[1]!;

    const res = await ctx.fetch(
      "/api/v1/users/@me/email-verification/revert",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
    assert.strictEqual(res.status, 200);

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, oldEmail.toLowerCase());
  });

  it("sends no change notice on first-time verification (no previous address)", async () => {
    const { user } = await makeUser();
    const headers = dedicatedIp();
    const email = `first-${randomUUID()}@example.com`;

    await verifyEmailThroughFlow(user, email, headers);

    const notice = mail.find((m) => !m.html.includes('class="email-code"'));
    assert.strictEqual(
      notice,
      undefined,
      "no change notice should be sent on first-time verification",
    );
  });

  it("sends no change notice on an idempotent same-address re-verify", async () => {
    const { user } = await makeUser();
    const headers = dedicatedIp();
    const email = `same-${randomUUID()}@example.com`;

    await verifyEmailThroughFlow(user, email, headers);
    // Clear the active code so the cooldown does not block the second send.
    await ctx.connection
      .collection("emailverifications")
      .deleteMany({ email: email.toLowerCase() });
    await verifyEmailThroughFlow(user, email, headers);

    const notice = mail.find((m) => !m.html.includes('class="email-code"'));
    assert.strictEqual(
      notice,
      undefined,
      "no change notice should be sent when re-verifying the same address",
    );
  });

  it("returns the previous verified email from setVerifiedEmail", async () => {
    const { internalId } = await makeUser();
    const firstEmail = `prev-${randomUUID()}@example.com`.toLowerCase();
    const secondEmail = `prev2-${randomUUID()}@example.com`.toLowerCase();

    const first = await ctx.container.userRepository.setVerifiedEmail(
      internalId,
      firstEmail,
    );
    assert.strictEqual(first.previousVerifiedEmail, null);

    const second = await ctx.container.userRepository.setVerifiedEmail(
      internalId,
      secondEmail,
    );
    assert.strictEqual(second.previousVerifiedEmail, firstEmail);
  });

  it("restores the prior verified email when a valid revert token is consumed", async () => {
    const { internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const newEmail = `new-${randomUUID()}@example.com`.toLowerCase();

    // Establish the change: old was verified, then attacker swapped to new.
    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    const { previousVerifiedEmail } =
      await ctx.container.userRepository.setVerifiedEmail(internalId, newEmail);
    assert.strictEqual(previousVerifiedEmail, oldEmail);

    const token = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      newEmail,
    );

    await ctx.container.emailVerificationService.revertVerifiedEmail(token);

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, oldEmail);
  });

  it("invalidates existing sessions after a revert (stale-epoch cookie is rejected)", async () => {
    const { discordUserId, user, internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const newEmail = `new-${randomUUID()}@example.com`.toLowerCase();

    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    await ctx.container.userRepository.setVerifiedEmail(internalId, newEmail);

    // This session cookie was minted before the revert, so it carries the
    // pre-revert epoch.
    const before = await user.fetch("/api/v1/users/@me");
    assert.strictEqual(before.status, 200);

    const token = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      newEmail,
    );
    await ctx.container.emailVerificationService.revertVerifiedEmail(token);

    const after = await user.fetch("/api/v1/users/@me");
    assert.strictEqual(after.status, 401);
    assert.strictEqual(
      (await readJson<ErrorResult>(after)).code,
      "SESSION_REVOKED",
    );

    // A freshly minted session (post-revert epoch) is accepted again.
    const fresh = await ctx.asUser(discordUserId);
    const freshRes = await fresh.fetch("/api/v1/users/@me");
    assert.strictEqual(freshRes.status, 200);
  });

  it("does not clobber a newer verified email when a stale revert token is consumed", async () => {
    const { internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const attackerEmail = `att-${randomUUID()}@example.com`.toLowerCase();
    const legitNewEmail = `legit-${randomUUID()}@example.com`.toLowerCase();

    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    await ctx.container.userRepository.setVerifiedEmail(internalId, attackerEmail);

    const token = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      attackerEmail,
    );

    // The user (or a later legitimate flow) has since moved the verified email
    // again. The stale revert token must NOT restore oldEmail over this, and the
    // superseded link must surface as an error rather than a silent no-op.
    await ctx.container.userRepository.setVerifiedEmail(
      internalId,
      legitNewEmail,
    );

    await assert.rejects(
      ctx.container.emailVerificationService.revertVerifiedEmail(token),
    );

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, legitNewEmail);
  });

  it("makes a revert token single-use (a second consume does not change anything)", async () => {
    const { internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const newEmail = `new-${randomUUID()}@example.com`.toLowerCase();

    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    await ctx.container.userRepository.setVerifiedEmail(internalId, newEmail);

    const token = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      newEmail,
    );

    await ctx.container.emailVerificationService.revertVerifiedEmail(token);
    const afterFirst = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(afterFirst?.verifiedEmail, oldEmail);
    const epochAfterFirst = afterFirst?.sessionEpoch ?? 0;

    // Second consume must be inert: it rejects (the link no longer applies) and
    // leaves the email unchanged with the epoch not bumped again.
    await assert.rejects(
      ctx.container.emailVerificationService.revertVerifiedEmail(token),
    );
    const afterSecond = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(afterSecond?.verifiedEmail, oldEmail);
    assert.strictEqual(afterSecond?.sessionEpoch ?? 0, epochAfterFirst);
  });

  it("rejects an expired revert token and leaves the verified email unchanged", async () => {
    const { internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const newEmail = `new-${randomUUID()}@example.com`.toLowerCase();

    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    await ctx.container.userRepository.setVerifiedEmail(internalId, newEmail);

    // Mint a token that is already past its lifetime.
    const expired = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      newEmail,
      { ttlMs: -1000 },
    );

    await assert.rejects(
      ctx.container.emailVerificationService.revertVerifiedEmail(expired),
    );

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, newEmail);
  });

  it("rejects a tampered revert token and leaves the verified email unchanged", async () => {
    const { internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const newEmail = `new-${randomUUID()}@example.com`.toLowerCase();
    const attackerTarget = `evil-${randomUUID()}@example.com`.toLowerCase();

    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    await ctx.container.userRepository.setVerifiedEmail(internalId, newEmail);

    const token = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      newEmail,
    );

    // Re-sign nothing: forge a body that restores an attacker-chosen address but
    // keep the original signature. The signature must no longer validate.
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({
        u: internalId,
        o: attackerTarget,
        n: newEmail,
        exp: Date.now() + 60_000,
      }),
    ).toString("base64url");
    const forged = `${forgedBody}.${sig}`;

    await assert.rejects(
      ctx.container.emailVerificationService.revertVerifiedEmail(forged),
    );

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, newEmail);
  });

  it("reverts via the unauthenticated revert route and notifies the restored address", async () => {
    const { internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const newEmail = `new-${randomUUID()}@example.com`.toLowerCase();

    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    await ctx.container.userRepository.setVerifiedEmail(internalId, newEmail);

    const token = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      newEmail,
    );

    mail.length = 0;

    // No session cookie: the revert route is authorized solely by the token.
    const res = await ctx.fetch(
      "/api/v1/users/@me/email-verification/revert",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
    assert.strictEqual(res.status, 200);

    const updated = await ctx.container.userRepository.findById(internalId);
    assert.strictEqual(updated?.verifiedEmail, oldEmail);

    // The restored address (the person who clicked revert) is notified; the
    // displaced address is deliberately NOT emailed (it may be the attacker's).
    const notice = mail.find((m) => m.to === oldEmail);
    assert.ok(notice, "the restored address should be notified of the revert");
    assert.ok(
      !mail.some((m) => m.to === newEmail),
      "the displaced address must not be notified",
    );
  });

  it("re-syncs the owned workspace's Paddle billing email back on revert", async () => {
    const { internalId } = await makeUser();
    const oldEmail = `old-${randomUUID()}@example.com`.toLowerCase();
    const newEmail = `new-${randomUUID()}@example.com`.toLowerCase();

    const workspace = await ctx.container.workspaceRepository.createWorkspaceWithOwner(
      {
        name: `WS ${randomUUID()}`,
        slug: `ws-${randomUUID()}`,
        ownerUserId: internalId,
      },
    );
    await ctx.connection.collection("workspaces").updateOne(
      { _id: new Types.ObjectId(workspace.id) },
      {
        $set: {
          paddleCustomer: {
            customerId: "ctm_revert_target",
            email: newEmail,
            subscription: { status: "ACTIVE" },
          },
        },
      },
    );

    await ctx.container.userRepository.setVerifiedEmail(internalId, oldEmail);
    await ctx.container.userRepository.setVerifiedEmail(internalId, newEmail);

    const token = await ctx.container.emailVerificationService.createRevertToken(
      internalId,
      oldEmail,
      newEmail,
    );

    paddleCustomerUpdates.length = 0;
    await ctx.container.emailVerificationService.revertVerifiedEmail(token);

    assert.deepStrictEqual(paddleCustomerUpdates, [
      { id: "ctm_revert_target", email: oldEmail },
    ]);
  });

  it("rejects confirming an email already verified by another user (409)", async () => {
    await ctx.connection
      .collection("users")
      .createIndex({ verifiedEmail: 1 }, { unique: true, sparse: true });

    const taken = `${randomUUID()}@example.com`.toLowerCase();
    const otherDiscordId = randomUUID();
    await ctx.container.userRepository.create({
      discordUserId: otherDiscordId,
    });
    const otherId =
      await ctx.container.userRepository.findIdByDiscordId(otherDiscordId);
    await ctx.connection
      .collection("users")
      .updateOne(
        { _id: new Types.ObjectId(otherId as string) },
        { $set: { verifiedEmail: taken, verifiedEmailVerifiedAt: new Date() } },
      );

    const { user } = await makeUser();
    const sendRes = await user.fetch("/api/v1/users/@me/email-verification", {
      method: "POST",
      body: JSON.stringify({ email: taken }),
    });
    assert.strictEqual(sendRes.status, 200);
    const captured = sent[0];
    assert.ok(captured);

    const res = await user.fetch(
      "/api/v1/users/@me/email-verification/confirm",
      {
        method: "POST",
        body: JSON.stringify({ email: taken, code: captured.code }),
      },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "EMAIL_ALREADY_IN_USE",
    );
  });
});
