import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateTestId } from "../../helpers/test-id";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

async function seedWorkspaceUser(discordUserId: string): Promise<string> {
  await ctx.container.userRepository.create({
    discordUserId,
    email: `${discordUserId}@example.com`,
  });
  await ctx.connection.collection("users").updateOne(
    { discordUserId },
    {
      $set: {
        "featureFlags.workspaces": true,
        verifiedEmail: `verified-${discordUserId}@example.com`,
        verifiedEmailVerifiedAt: new Date(),
      },
    },
  );
  return (await ctx.container.userRepository.findIdByDiscordId(
    discordUserId,
  )) as string;
}

async function createWorkspace(
  user: Awaited<ReturnType<AppTestContext["asUser"]>>,
  slug: string,
): Promise<string> {
  const response = await user.fetch("/api/v1/workspaces", {
    method: "POST",
    body: JSON.stringify({ name: "Workspace", slug }),
  });
  assert.strictEqual(response.status, 201);
  return ((await response.json()) as { result: { id: string } }).result.id;
}

async function seedFeed(input: {
  discordUserId: string;
  workspaceId: string;
  title: string;
  disabledCode?: UserFeedDisabledCode;
  healthStatus?: UserFeedHealthStatus;
}): Promise<string> {
  const feed = await ctx.container.userFeedRepository.create({
    title: input.title,
    url: `https://example.com/${randomUUID()}.xml`,
    user: { id: generateTestId(), discordUserId: input.discordUserId },
    workspaceId: input.workspaceId,
  });
  await ctx.container.userFeedRepository.updateById(feed.id, {
    $set: {
      ...(input.disabledCode ? { disabledCode: input.disabledCode } : {}),
      ...(input.healthStatus ? { healthStatus: input.healthStatus } : {}),
    },
  });
  return feed.id;
}

describe("Bulk retry of failed workspace feeds", { concurrency: false }, () => {
  it("requires an authenticated workspace member", async () => {
    const workspaceId = new Types.ObjectId().toString();
    const anonymous = await ctx.fetch("/api/v1/user-feeds/retry-failed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    assert.strictEqual(anonymous.status, 401);

    const discordUserId = randomUUID();
    await seedWorkspaceUser(discordUserId);
    const nonMember = await ctx.asUser(discordUserId);
    const response = await nonMember.fetch("/api/v1/user-feeds/retry-failed", {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("counts and queues every terminal request failure, excluding other disabled feeds", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(discordUserId);
    const user = await ctx.asUser(discordUserId);
    const workspaceId = await createWorkspace(user, `retry-${randomUUID()}`);
    const eligibleIds = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        seedFeed({
          discordUserId,
          workspaceId,
          title: `Eligible ${index}`,
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        }),
      ),
    );
    const excludedId = await seedFeed({
      discordUserId,
      workspaceId,
      title: "Plan disabled",
      disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
      healthStatus: UserFeedHealthStatus.Failed,
    });

    const response = await user.fetch("/api/v1/user-feeds/retry-failed", {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), {
      result: { retriedCount: 3, recoveryAlreadyActive: false },
    });

    for (const id of eligibleIds) {
      const feed = await ctx.container.userFeedRepository.findById(id);
      assert.strictEqual(feed?.disabledCode, UserFeedDisabledCode.FailedRequests);
      assert.strictEqual(feed?.healthStatus, UserFeedHealthStatus.Failing);
      assert.ok(feed?.recoveryStartedAt);
    }
    const excluded = await ctx.container.userFeedRepository.findById(excludedId);
    assert.strictEqual(excluded?.disabledCode, UserFeedDisabledCode.ExceededFeedLimit);
    assert.strictEqual(excluded?.healthStatus, UserFeedHealthStatus.Failed);
  });

  it("is idempotent while a recovery cycle is active", async () => {
    const discordUserId = randomUUID();
    await seedWorkspaceUser(discordUserId);
    const user = await ctx.asUser(discordUserId);
    const workspaceId = await createWorkspace(user, `retry-${randomUUID()}`);
    await seedFeed({
      discordUserId,
      workspaceId,
      title: "Eligible",
      disabledCode: UserFeedDisabledCode.FailedRequests,
      healthStatus: UserFeedHealthStatus.Failed,
    });

    const first = await user.fetch("/api/v1/user-feeds/retry-failed", {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
    assert.deepStrictEqual(await first.json(), {
      result: { retriedCount: 1, recoveryAlreadyActive: false },
    });

    const second = await user.fetch("/api/v1/user-feeds/retry-failed", {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
    assert.deepStrictEqual(await second.json(), {
      result: { retriedCount: 0, recoveryAlreadyActive: true },
    });
  });
});
