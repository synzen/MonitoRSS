import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { EmailVerificationService } from "../../src/features/users/email-verification.service";
import type { SmtpTransport } from "../../src/infra/smtp";

/**
 * Regression test for the core security invariant:
 *
 *   verifiedEmail is written ONLY by EmailVerificationService.confirm (the
 *   one-time-code flow). The Discord OAuth sign-in path (initDiscordUser) must
 *   NEVER write verifiedEmail, regardless of what Discord says the user's email
 *   is.
 *
 * This defeats the Discord-email-spoofing attack: an attacker can set their
 * Discord account's email to a victim's address, but they cannot receive a
 * one-time code delivered to that inbox.
 */
describe("OAuth verified-email security invariant", () => {
  let ctx: AppTestContext;
  let capturedCodes: Array<{ to: string; code: string }>;

  before(async () => {
    ctx = await createAppTestContext({
      configOverrides: { BACKEND_API_SMTP_FROM_DOMAIN: "example.com" },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  beforeEach(() => {
    capturedCodes = [];
    const fakeTransport = {
      sendMail: async (msg: { to: string; html: string }) => {
        const match = /(\d{6})/.exec(String(msg.html));
        capturedCodes.push({ to: msg.to, code: match?.[1] ?? "" });
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

  it("create path: new user via initDiscordUser has verifiedEmail === undefined", async () => {
    const discordId = randomUUID();
    const discordEmail = `discord-${discordId}@discord.example`;

    const created = await ctx.container.usersService.initDiscordUser(discordId, {
      email: discordEmail,
    });

    const persisted = await ctx.container.userRepository.findById(created.id);
    assert.ok(persisted, "user should be persisted");
    assert.strictEqual(
      persisted.email,
      discordEmail,
      "Discord-provided email should be stored on email field",
    );
    assert.strictEqual(
      persisted.verifiedEmail,
      undefined,
      "verifiedEmail must not be set by the Discord OAuth path (create)",
    );
  });

  it("update-email path: existing user whose Discord email changes via initDiscordUser retains verifiedEmail === undefined", async () => {
    const discordId = randomUUID();
    const originalEmail = `original-${discordId}@discord.example`;
    const updatedEmail = `updated-${discordId}@discord.example`;

    await ctx.container.usersService.initDiscordUser(discordId, {
      email: originalEmail,
    });

    const afterCreate = await ctx.container.userRepository.findByDiscordId(discordId);
    assert.ok(afterCreate, "user should exist after initial create");
    assert.strictEqual(afterCreate.verifiedEmail, undefined);

    await ctx.container.usersService.initDiscordUser(discordId, {
      email: updatedEmail,
    });

    const afterUpdate = await ctx.container.userRepository.findByDiscordId(discordId);
    assert.ok(afterUpdate, "user should exist after email update");
    assert.strictEqual(
      afterUpdate.email,
      updatedEmail,
      "Discord-provided email should be updated on email field",
    );
    assert.strictEqual(
      afterUpdate.verifiedEmail,
      undefined,
      "verifiedEmail must not be set by the Discord OAuth path (update-email)",
    );
  });

  it("contrast: EmailVerificationService.confirm IS the sole writer of verifiedEmail", async () => {
    const discordId = randomUUID();
    const verifyEmail = `verify-${discordId}@example.com`;

    await ctx.container.userRepository.create({ discordUserId: discordId });
    await ctx.connection
      .collection("users")
      .updateOne({ discordUserId: discordId }, { $set: { "featureFlags.workspaces": true } });

    const userId = await ctx.container.userRepository.findIdByDiscordId(discordId);
    assert.ok(userId);

    const beforeVerify = await ctx.container.userRepository.findById(userId);
    assert.strictEqual(beforeVerify?.verifiedEmail, undefined, "starts unverified");

    await ctx.container.emailVerificationService.sendCode(userId, verifyEmail);
    assert.ok(capturedCodes.length === 1, "one code should be captured");
    const { code } = capturedCodes[0]!;

    await ctx.container.emailVerificationService.confirm(userId, verifyEmail, code);

    const afterVerify = await ctx.container.userRepository.findById(userId);
    assert.strictEqual(
      afterVerify?.verifiedEmail,
      verifyEmail.toLowerCase(),
      "verifiedEmail is set ONLY after EmailVerificationService.confirm succeeds",
    );
  });
});
