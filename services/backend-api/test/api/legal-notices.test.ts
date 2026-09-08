import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Environment } from "../../src/config";
import {
  createLegalNoticeAcknowledgementHandler,
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

  it("requires authentication to acknowledge a notice", async () => {
    const response = await ctx.fetch("/api/v1/legal-notices/acknowledgements", {
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

  it("records an acknowledgement and hides that notice version", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await ctx.connection
      .collection("users")
      .updateOne(
        { discordUserId },
        { $set: { createdAt: new Date("2026-09-14T23:59:59.000Z") } },
      );

    const response = await acknowledgeNotice(
      ctx,
      discordUserId,
      notice.version,
    );
    const user =
      await ctx.container.userRepository.findByDiscordId(discordUserId);

    assert.equal(response.statusCode, 204);
    assert.equal(
      user?.preferences?.legalNoticeAcknowledgement?.version,
      notice.version,
    );
    assert.ok(
      user?.preferences?.legalNoticeAcknowledgement?.acknowledgedAt instanceof
        Date,
    );
    assert.deepEqual((await getApplicableNotice(ctx, discordUserId)).body, {
      result: null,
    });
  });

  it("does not let an acknowledgement hide a later notice version", async () => {
    const discordUserId = generateSnowflake();
    await ctx.container.userRepository.create({ discordUserId });
    await acknowledgeNotice(ctx, discordUserId, notice.version);

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

async function acknowledgeNotice(
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

  await createLegalNoticeAcknowledgementHandler(
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
