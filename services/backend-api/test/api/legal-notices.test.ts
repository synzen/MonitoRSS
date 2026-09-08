import { after, before, describe, it } from "node:test";
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
        BACKEND_API_LEGAL_NOTICE: notice,
      },
    });
  });

  after(async () => {
    await ctx.teardown();
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

    ctx.container.config.BACKEND_API_LEGAL_NOTICE = {
      ...notice,
      version: "2026-10-01",
    };

    const response = await getApplicableNotice(ctx, discordUserId);

    assert.deepEqual(response.body, {
      result: {
        version: "2026-10-01",
        summary: notice.summary,
        documents: notice.documents,
      },
    });
    ctx.container.config.BACKEND_API_LEGAL_NOTICE = notice;
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

  it("exposes the notice when the local preview is enabled", async () => {
    ctx.container.config.NODE_ENV = Environment.Local;
    ctx.container.config.BACKEND_API_ENABLE_LEGAL_NOTICE_PREVIEW = true;

    const response = await getApplicableNotice(
      ctx,
      generateSnowflake(),
      "web-api",
    );

    assert.deepEqual(response.body, { result: null });
    ctx.container.config.NODE_ENV = Environment.Production;
    ctx.container.config.BACKEND_API_ENABLE_LEGAL_NOTICE_PREVIEW = false;
  });
});

async function getApplicableNotice(
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
