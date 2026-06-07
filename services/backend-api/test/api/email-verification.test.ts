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

  before(async () => {
    // A from-domain is required for the sender address (createFromFormatter);
    // the fake transport below stands in for an actual SMTP server.
    ctx = await createAppTestContext({
      configOverrides: { BACKEND_API_SMTP_FROM_DOMAIN: "example.com" },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  // Swap in a capturing mailer so the real send→confirm endpoints can be
  // exercised without an SMTP server (the harness leaves SMTP unconfigured).
  beforeEach(() => {
    sent = [];
    const fakeTransport = {
      sendMail: async (msg: { to: string; html: string }) => {
        const match = /(\d{6})/.exec(String(msg.html));
        sent.push({ to: msg.to, code: match?.[1] ?? "" });
        return {};
      },
    } as unknown as SmtpTransport;

    ctx.container.emailVerificationService = new EmailVerificationService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      emailVerificationRepository: ctx.container.emailVerificationRepository,
      userRepository: ctx.container.userRepository,
    });
  });

  // Email verification is gated by the per-user workspaces feature flag, so every
  // test user is seeded with it.
  async function makeUser() {
    const discordUserId = randomUUID();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection
      .collection("users")
      .updateOne({ discordUserId }, { $set: { "featureFlags.workspaces": true } });
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

  it("returns a standardized 429 (not a 500) when the per-IP send limit is exceeded", async () => {
    const { user } = await makeUser();
    // The per-route IP limit is 10/hour; pin a dedicated source IP so this test
    // owns its own bucket. Distinct emails so each request reaches the limiter.
    const ip = `203.0.115.${Math.floor(Math.random() * 250) + 1}`;
    const headers = { "x-forwarded-for": ip };

    let lastStatus = 0;
    let lastBody: ErrorResult = { code: "" };
    // 11 requests: the 11th must be rejected by the rate-limit plugin (before the
    // handler). Earlier requests may be 200 or handler-level 429s — we only care
    // that the plugin-level rejection is a clean 429, not a masked 500.
    for (let i = 0; i < 11; i += 1) {
      const res = await user.fetch("/api/v1/users/@me/email-verification", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: `ip-${i}-${randomUUID()}@example.com` }),
      });
      lastStatus = res.status;
      lastBody = await readJson<ErrorResult>(res).catch(() => ({ code: "" }));
    }

    assert.strictEqual(lastStatus, 429, "IP-limit rejection must be 429, not 500");
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
