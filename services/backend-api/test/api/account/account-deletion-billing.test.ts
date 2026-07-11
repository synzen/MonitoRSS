import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateTestId } from "../../helpers/test-id";
import type { TestHttpServer } from "../../helpers/test-http-server";
import type { MockApi } from "../../helpers/mock-apis";
import {
  createMockPaddleApi,
  buildPaddleCustomer,
} from "../../helpers/paddle-fixtures";
import { EmailVerificationService } from "../../../src/features/users/email-verification.service";
import { AccountService } from "../../../src/features/account/account.service";
import type { SmtpTransport } from "../../../src/infra/smtp";

const ENCRYPTION_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

interface ErrorResult {
  code: string;
}

// The active-subscription guard only engages when billing is enabled, so this
// suite runs against a billing-enabled context, mirroring the workspace
// deletion suite. The billing-disabled path is covered by the main
// account-deletion suite, whose context leaves billing off.
describe("Account deletion with billing enabled", () => {
  let ctx: AppTestContext;
  let paddleApi: MockApi & { server: TestHttpServer };
  let sent: Array<{ to: string; subject: string; html: string }>;

  before(async () => {
    paddleApi = createMockPaddleApi();
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_SMTP_FROM_DOMAIN: "example.com",
        BACKEND_API_ENCRYPTION_KEY_HEX: ENCRYPTION_KEY_HEX,
        BACKEND_API_ENABLE_SUPPORTERS: true,
        BACKEND_API_PADDLE_URL: paddleApi.server.host,
        BACKEND_API_PADDLE_KEY: "test-paddle-key",
      },
      mockApis: {
        paddle: paddleApi,
      },
    });
  });

  // Same capturing-mailer setup as the main account-deletion suite: the OTP is
  // read from the captured email so the flow runs through the real endpoints.
  beforeEach(() => {
    sent = [];
    const fakeTransport = {
      sendMail: async (msg: { to: string; subject: string; html: string }) => {
        sent.push({
          to: msg.to,
          subject: String(msg.subject),
          html: String(msg.html),
        });
        return {};
      },
    } as unknown as SmtpTransport;

    const emailVerificationService = new EmailVerificationService({
      config: ctx.container.config,
      smtpTransport: fakeTransport,
      emailVerificationRepository: ctx.container.emailVerificationRepository,
      userRepository: ctx.container.userRepository,
      workspaceRepository: ctx.container.workspaceRepository,
      paddleService: ctx.container.paddleService,
    });

    ctx.container.emailVerificationService = emailVerificationService;
    ctx.container.accountService = new AccountService({
      config: ctx.container.config,
      userRepository: ctx.container.userRepository,
      emailVerificationService,
      usersService: ctx.container.usersService,
      userFeedsService: ctx.container.userFeedsService,
      workspacesService: ctx.container.workspacesService,
      supportersService: ctx.container.supportersService,
      userFeedLimitOverrideRepository:
        ctx.container.userFeedLimitOverrideRepository,
      supporterRepository: ctx.container.supporterRepository,
      patronRepository: ctx.container.patronRepository,
    });
  });

  after(async () => {
    await ctx.teardown();
    await paddleApi.stop();
  });

  async function seedUser(): Promise<{
    discordUserId: string;
    verifiedEmail: string;
  }> {
    const discordUserId = randomUUID();
    const verifiedEmail = `verified-${discordUserId}@example.com`;

    await ctx.container.userRepository.create({
      discordUserId,
      email: `${discordUserId}@example.com`,
    });

    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      {
        $set: {
          verifiedEmail,
          verifiedEmailVerifiedAt: new Date(),
        },
      },
    );

    return { discordUserId, verifiedEmail };
  }

  function readCapturedCode(): string {
    const match = sent
      .map((m) => m.html.match(/class="email-code"[^>]*>\s*(\d{6})\s*</)?.[1])
      .find((c): c is string => !!c);
    assert.ok(match, "Expected a 6-digit code in the captured email");
    return match;
  }

  it("refuses to send a deletion code while a subscription is live", async () => {
    const user = await seedUser();
    await ctx.container.supporterRepository.upsertPaddleCustomer(
      user.discordUserId,
      buildPaddleCustomer({ subscriptionId: generateTestId() }),
    );

    const authed = await ctx.asUser(user.discordUserId);
    const res = await authed.fetch(
      "/api/v1/account/@me/deletion-verification",
      { method: "POST" },
    );

    assert.strictEqual(res.status, 409);
    const body = (await res.json()) as ErrorResult;
    assert.strictEqual(body.code, "ACCOUNT_DELETE_ACTIVE_SUBSCRIPTION");
    assert.strictEqual(sent.length, 0, "No deletion code email may be sent");
  });

  it("refuses deletion when a subscription went live after the code was sent", async () => {
    const user = await seedUser();
    const authed = await ctx.asUser(user.discordUserId);

    const sendRes = await authed.fetch(
      "/api/v1/account/@me/deletion-verification",
      { method: "POST" },
    );
    assert.strictEqual(sendRes.status, 200, await sendRes.text());
    const code = readCapturedCode();

    await ctx.container.supporterRepository.upsertPaddleCustomer(
      user.discordUserId,
      buildPaddleCustomer({ subscriptionId: generateTestId() }),
    );

    const res = await authed.fetch("/api/v1/account/@me", {
      method: "DELETE",
      body: JSON.stringify({ code }),
    });

    assert.strictEqual(res.status, 409);
    const body = (await res.json()) as ErrorResult;
    assert.strictEqual(body.code, "ACCOUNT_DELETE_ACTIVE_SUBSCRIPTION");

    const stillThere = await ctx.container.userRepository.findByDiscordId(
      user.discordUserId,
    );
    assert.ok(stillThere, "User must survive a blocked deletion");
  });

  it("deletes an account whose subscription is already scheduled to cancel", async () => {
    const user = await seedUser();
    await ctx.container.supporterRepository.upsertPaddleCustomer(
      user.discordUserId,
      buildPaddleCustomer({
        subscriptionId: generateTestId(),
        cancellationDate: new Date(),
      }),
    );

    const authed = await ctx.asUser(user.discordUserId);
    const sendRes = await authed.fetch(
      "/api/v1/account/@me/deletion-verification",
      { method: "POST" },
    );
    assert.strictEqual(sendRes.status, 200, await sendRes.text());

    const res = await authed.fetch("/api/v1/account/@me", {
      method: "DELETE",
      body: JSON.stringify({ code: readCapturedCode() }),
    });
    assert.strictEqual(res.status, 204, await res.text());

    const userGone = await ctx.container.userRepository.findByDiscordId(
      user.discordUserId,
    );
    assert.strictEqual(userGone, null, "User document should be deleted");
  });
});
