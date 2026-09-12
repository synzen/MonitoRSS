import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Environment } from "../../src/config";
import {
  createLegalNoticeDismissalHandler,
  getApplicableLegalNoticeHandler,
} from "../../src/features/legal-notices/legal-notices.handlers";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateSnowflake } from "../helpers/test-id";

const notice = {
  version: "2026-09-01",
  displayAt: new Date("2026-09-01T00:00:00.000Z"),
  effectiveAt: new Date("2026-09-15T00:00:00.000Z"),
  summary: "We updated our legal documents.",
  documents: [{ type: "terms" as const, url: "https://monitorss.xyz/terms" }],
};

describe("GET /api/v1/legal-notices/applicable", () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext({
      configOverrides: {
        NODE_ENV: Environment.Production,
        BACKEND_API_LEGAL_NOTICE: [notice],
      },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  afterEach(() => {
    mock.timers.reset();
    ctx.container.config.BACKEND_API_LEGAL_NOTICE = [notice];
    ctx.container.config.NODE_ENV = Environment.Production;
  });

  it("uses controlled server time for activation, phase changes, and the next refresh", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-08-31T23:59:59.000Z") });
    const hidden = await getRawApplicableNotice(ctx, generateSnowflake());
    assert.deepEqual(hidden.body, {
      result: null,
      serverTime: "2026-08-31T23:59:59.000Z",
      nextTransitionAt: "2026-09-01T00:00:00.000Z",
    });

    mock.timers.reset();
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-01T00:00:00.000Z") });
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      { $set: { createdAt: new Date("2026-08-01T00:00:00.000Z") } },
    );
    const upcoming = await getRawApplicableNotice(ctx, discordUserId);
    assert.deepEqual(upcoming.body, {
      result: {
        version: notice.version,
        phase: "upcoming",
        summary: notice.summary,
        documents: notice.documents,
      },
      serverTime: "2026-09-01T00:00:00.000Z",
      nextTransitionAt: "2026-09-15T00:00:00.000Z",
    });

    mock.timers.reset();
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-15T00:00:00.000Z") });
    const updated = await getRawApplicableNotice(ctx, discordUserId);
    assert.equal((updated.body as { result: { phase: string } }).result.phase, "updated");
  });

  it("supersedes older displayed notices with the newest schedule", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-02T00:00:00.000Z") });
    ctx.container.config.BACKEND_API_LEGAL_NOTICE = [
      notice,
      {
        ...notice,
        version: "2026-10-01",
        displayAt: new Date("2026-10-01T00:00:00.000Z"),
        effectiveAt: new Date("2026-10-15T00:00:00.000Z"),
      },
    ];
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      { $set: { createdAt: new Date("2026-08-01T00:00:00.000Z") } },
    );

    const response = await getRawApplicableNotice(ctx, discordUserId);
    assert.equal((response.body as { result: { version: string } }).result.version, "2026-10-01");
  });

  it("requires authentication", async () => {
    const response = await ctx.fetch("/api/v1/legal-notices/applicable", {
      headers: { host: "my.monitorss.xyz" },
    });

    assert.equal(response.status, 401);
  });

  it("requires authentication to dismiss a notice", async () => {
    const response = await ctx.fetch("/api/v1/legal-notices/dismissals", {
      method: "POST",
      headers: {
        host: "my.monitorss.xyz",
        "content-type": "application/json",
      },
      body: JSON.stringify({ version: notice.version }),
    });

    assert.equal(response.status, 401);
  });

  it("returns the notice for an account created before it takes effect", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection
      .collection("users")
      .updateOne(
        { discordUserId },
        { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
      );

    const response = await getApplicableNotice(ctx, discordUserId);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      result: {
        version: notice.version,
        summary: notice.summary,
        documents: notice.documents,
      },
    });
  });

  it("does not return a historical notice for a new account", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection
      .collection("users")
      .updateOne(
        { discordUserId },
        { $set: { createdAt: notice.effectiveAt } },
      );

    const response = await getApplicableNotice(ctx, discordUserId);

    assert.deepEqual(response.body, { result: null });
  });

  it("records a dismissal and hides that notice version", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection
      .collection("users")
      .updateOne(
        { discordUserId },
        { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
      );

    const before = Date.now();
    const response = await dismissNotice(
      ctx,
      discordUserId,
      notice.version,
    );
    const after = Date.now();
    const user =
      await ctx.container.userRepository.findByDiscordId(discordUserId);

    assert.equal(response.statusCode, 204);
    assert.equal(
      user?.preferences?.legalNoticeDismissal?.version,
      notice.version,
    );
    const dismissedAt = user?.preferences?.legalNoticeDismissal?.dismissedAt;
    assert.ok(dismissedAt instanceof Date);
    assert.ok(dismissedAt.getTime() >= before && dismissedAt.getTime() <= after);
    assert.deepEqual((await getApplicableNotice(ctx, discordUserId)).body, {
      result: null,
    });
  });

  it("stores only the user identifier, version, and server timestamp", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
    );

    await dismissNotice(ctx, discordUserId, notice.version);

    const raw = await ctx.connection
      .collection("users")
      .findOne({ discordUserId });
    const dismissal = (raw?.preferences as Record<string, unknown> | undefined)
      ?.legalNoticeDismissal as Record<string, unknown> | undefined;

    assert.ok(dismissal);
    assert.deepEqual(Object.keys(dismissal).sort(), ["dismissedAt", "version"]);
    assert.equal(dismissal["version"], notice.version);
    assert.ok(dismissal["dismissedAt"] instanceof Date);
  });

  it("is idempotent across repeated dismissal requests", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
    );

    const first = await dismissNotice(ctx, discordUserId, notice.version);
    const storedAfterFirst = (
      await ctx.container.userRepository.findByDiscordId(discordUserId)
    )?.preferences?.legalNoticeDismissal;

    const second = await dismissNotice(ctx, discordUserId, notice.version);
    const storedAfterSecond = (
      await ctx.container.userRepository.findByDiscordId(discordUserId)
    )?.preferences?.legalNoticeDismissal;

    assert.equal(first.statusCode, 204);
    assert.equal(second.statusCode, 204);
    assert.deepEqual(storedAfterSecond, storedAfterFirst);
    assert.deepEqual((await getApplicableNotice(ctx, discordUserId)).body, {
      result: null,
    });
  });

  it("isolates dismissal to the dismissing account", async () => {
    const firstDiscordUserId = generateSnowflake();
    const secondDiscordUserId = generateSnowflake();
    for (const discordUserId of [firstDiscordUserId, secondDiscordUserId]) {
      await ctx.container.userRepository.create({ discordUserId });
      await ctx.connection.collection("users").updateOne(
        { discordUserId },
        { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
      );
    }

    await dismissNotice(ctx, firstDiscordUserId, notice.version);

    assert.deepEqual(
      (await getApplicableNotice(ctx, firstDiscordUserId)).body,
      { result: null },
    );
    const stillApplicable = await getApplicableNotice(ctx, secondDiscordUserId);
    assert.equal(
      (stillApplicable.body as { result: { version: string } }).result.version,
      notice.version,
    );
    const secondUser = await ctx.container.userRepository.findByDiscordId(
      secondDiscordUserId,
    );
    assert.equal(secondUser?.preferences?.legalNoticeDismissal, undefined);
  });

  it("rejects dismissal of a future notice version", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
    );

    const response = await dismissNotice(ctx, discordUserId, "2026-10-01");
    const user =
      await ctx.container.userRepository.findByDiscordId(discordUserId);

    assert.equal(response.statusCode, 204);
    assert.equal(user?.preferences?.legalNoticeDismissal, undefined);
    const stillApplicable = await getApplicableNotice(ctx, discordUserId);
    assert.equal(
      (stillApplicable.body as { result: { version: string } }).result.version,
      notice.version,
    );
  });

  it("keeps dismissal hidden across a fresh authenticated session", async () => {
    // The shared context runs as Production, where the test session helper
    // is unavailable, so this flow uses its own Local context over real HTTP:
    // dismiss in one session, read back in a freshly minted session.
    const sessionCtx = await createAppTestContext({
      configOverrides: {
        NODE_ENV: Environment.Local,
        BACKEND_API_LEGAL_NOTICE: [notice],
      },
    });

    try {
      const discordUserId = generateSnowflake();
      const firstSession = await sessionCtx.asUser(discordUserId);
      await sessionCtx.connection.collection("users").updateOne(
        { discordUserId },
        { $set: { createdAt: new Date("2026-08-01T00:00:00.000Z") } },
      );

      const beforeDismiss = await firstSession.fetch(
        "/api/v1/legal-notices/applicable",
      );
      assert.equal(
        (
          (await beforeDismiss.json()) as {
            result: { version: string };
          }
        ).result.version,
        notice.version,
      );

      const dismissal = await firstSession.fetch(
        "/api/v1/legal-notices/dismissals",
        {
          method: "POST",
          body: JSON.stringify({ version: notice.version }),
        },
      );
      assert.equal(dismissal.status, 204);

      const freshSession = await sessionCtx.asUser(discordUserId);
      const afterDismiss = await freshSession.fetch(
        "/api/v1/legal-notices/applicable",
      );
      const afterBody = (await afterDismiss.json()) as {
        result: unknown;
        serverTime: string;
      };
      assert.equal(afterBody.result, null);
      assert.equal(typeof afterBody.serverTime, "string");
    } finally {
      await sessionCtx.teardown();
    }
  });

  it("removes dismissal records when the account is deleted", async () => {
    const discordUserId = generateSnowflake();
    const created =
      await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection.collection("users").updateOne(
      { discordUserId },
      { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
    );
    await dismissNotice(ctx, discordUserId, notice.version);

    await ctx.container.userRepository.deleteById(created.id);

    const user =
      await ctx.container.userRepository.findByDiscordId(discordUserId);
    const raw = await ctx.connection
      .collection("users")
      .findOne({ discordUserId });
    assert.equal(user, null);
    assert.equal(raw, null);
  });

  it("does not let a dismissal hide a later notice version", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await dismissNotice(ctx, discordUserId, notice.version);

    ctx.container.config.BACKEND_API_LEGAL_NOTICE = [{
      ...notice,
      version: "2026-10-01",
    }];

    const response = await getApplicableNotice(ctx, discordUserId);

    assert.deepEqual(response.body, {
      result: {
        version: "2026-10-01",
        summary: notice.summary,
        documents: notice.documents,
      },
    });
    ctx.container.config.BACKEND_API_LEGAL_NOTICE = [notice];
  });

  it("returns no notice on non-production hosts", async () => {
    const response = await getApplicableNotice(
      ctx,
      generateSnowflake(),
      "my.monitorss.xyz.evil.example",
    );

    assert.deepEqual(response.body, { result: null });
  });

  it("returns no notice outside production", async () => {
    ctx.container.config.NODE_ENV = Environment.Test;

    const response = await getApplicableNotice(ctx, generateSnowflake());

    assert.deepEqual(response.body, { result: null });
    ctx.container.config.NODE_ENV = Environment.Production;
  });

  it("exposes a configured notice locally", async () => {
    ctx.container.config.NODE_ENV = Environment.Local;
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection
      .collection("users")
      .updateOne(
        { discordUserId },
        { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
      );

    const response = await getApplicableNotice(ctx, discordUserId, "web-api");

    assert.deepEqual(response.body, {
      result: {
        version: notice.version,
        summary: notice.summary,
        documents: notice.documents,
      },
    });
    ctx.container.config.NODE_ENV = Environment.Production;
  });
});

async function getApplicableNotice(
  ctx: AppTestContext,
  discordUserId: string,
  hostname = "my.monitorss.xyz",
) {
  const response = await getRawApplicableNotice(ctx, discordUserId, hostname);

  return {
    statusCode: response.statusCode,
    body: {
      result: withoutPhase((response.body as { result: unknown }).result),
    },
  };
}

function withoutPhase(result: unknown): unknown {
  if (!result) {
    return result;
  }

  const { phase: _phase, ...notice } = result as { phase: string } & Record<string, unknown>;

  return notice;
}

async function getRawApplicableNotice(
  ctx: AppTestContext,
  discordUserId: string,
  hostname = "my.monitorss.xyz",
) {
  let statusCode = 200;
  let body: unknown;
  const reply = {
    code(code: number) {
      statusCode = code;
      return this;
    },
    send(value: unknown) {
      body = value;
    },
  };

  await getApplicableLegalNoticeHandler(
    { container: ctx.container, discordUserId, hostname } as never,
    reply as never,
  );

  return { statusCode, body };
}

async function dismissNotice(
  ctx: AppTestContext,
  discordUserId: string,
  version: string,
  hostname = "my.monitorss.xyz",
) {
  let statusCode = 200;
  const reply = {
    code(code: number) {
      statusCode = code;
      return this;
    },
    send() {},
  };

  await createLegalNoticeDismissalHandler(
    {
      container: ctx.container,
      discordUserId,
      hostname,
      body: { version },
    } as never,
    reply as never,
  );

  return { statusCode };
}
