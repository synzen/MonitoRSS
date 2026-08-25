import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
  type AuthenticatedUser,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
import { UserFeedDisabledCode } from "../../../src/repositories/shared/enums";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

async function seedWorkspaceMember(): Promise<{
  user: AuthenticatedUser;
  userId: string;
  discordUserId: string;
}> {
  const discordUserId = generateSnowflake();
  await ctx.container.userRepository.create({
    discordUserId,
    email: `${discordUserId}@example.com`,
  });
  await ctx.connection
    .collection("users")
    .updateOne(
      { discordUserId },
      { $set: { "featureFlags.workspaces": true } },
    );

  return {
    user: await ctx.asUser(discordUserId),
    userId: (await ctx.container.userRepository.findIdByDiscordId(
      discordUserId,
    )) as string,
    discordUserId,
  };
}

async function createWorkspace(userId: string) {
  return ctx.container.workspaceRepository.createWorkspaceWithOwner({
    name: "Feed Filter Team",
    slug: `feed-filter-${generateTestId()}`,
    ownerUserId: userId,
  });
}

async function createTag(
  user: AuthenticatedUser,
  workspaceSlug: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const response = await user.fetch(
    `/api/v1/workspaces/${workspaceSlug}/tags`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
  assert.strictEqual(response.status, 201);

  const body = (await response.json()) as {
    result: { id: string; name: string };
  };
  return body.result;
}

async function listWorkspaceFeeds(
  user: AuthenticatedUser,
  workspaceId: string,
  query = "",
) {
  const response = await user.fetch(
    `/api/v1/user-feeds?limit=1&offset=0&workspaceId=${workspaceId}${query}`,
    { method: "GET" },
  );
  assert.strictEqual(response.status, 200);

  return (await response.json()) as {
    results: Array<{ id: string; title: string; computedStatus: string }>;
    total: number;
  };
}

describe("workspace tag feed filters", { concurrency: true }, () => {
  it("uses AND tag matching, ANDs other filters, and counts before pagination", async () => {
    const { user, userId, discordUserId } = await seedWorkspaceMember();
    const workspace = await createWorkspace(userId);
    const alpha = await createTag(user, workspace.slug, "Alpha");
    const beta = await createTag(user, workspace.slug, "Beta");
    const feedIds = await Promise.all([
      ctx.container.userFeedRepository.create({
        title: "Focus alpha",
        url: `https://example.com/${generateTestId()}.xml`,
        user: { id: userId, discordUserId },
        workspaceId: workspace.id,
      }),
      ctx.container.userFeedRepository.create({
        title: "Focus beta",
        url: `https://example.com/${generateTestId()}.xml`,
        user: { id: userId, discordUserId },
        workspaceId: workspace.id,
      }),
      ctx.container.userFeedRepository.create({
        title: "Focus both",
        url: `https://example.com/${generateTestId()}.xml`,
        user: { id: userId, discordUserId },
        workspaceId: workspace.id,
      }),
      ctx.container.userFeedRepository.create({
        title: "Unfiltered feed",
        url: `https://example.com/${generateTestId()}.xml`,
        user: { id: userId, discordUserId },
        workspaceId: workspace.id,
      }),
    ]);
    await Promise.all([
      ctx.container.userFeedRepository.updateById(feedIds[0]!.id, {
        $set: { tagIds: [alpha.id] },
      }),
      ctx.container.userFeedRepository.updateById(feedIds[1]!.id, {
        $set: {
          tagIds: [beta.id],
          disabledCode: UserFeedDisabledCode.Manual,
        },
      }),
      ctx.container.userFeedRepository.updateById(feedIds[2]!.id, {
        $set: { tagIds: [alpha.id, beta.id] },
      }),
    ]);

    const oneTag = await listWorkspaceFeeds(
      user,
      workspace.id,
      `&filters[tagIds]=${alpha.id}`,
    );
    assert.strictEqual(oneTag.total, 2);
    assert.strictEqual(oneTag.results.length, 1);
    assert.ok([feedIds[0]!.id, feedIds[2]!.id].includes(oneTag.results[0]!.id));

    const everyTag = await user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspace.id}&filters[tagIds]=${alpha.id},${beta.id}`,
      { method: "GET" },
    );
    assert.strictEqual(everyTag.status, 200);
    const everyTagBody = (await everyTag.json()) as {
      results: Array<{ id: string }>;
      total: number;
    };
    assert.strictEqual(everyTagBody.total, 1);
    assert.deepStrictEqual(
      everyTagBody.results.map((result) => result.id),
      [feedIds[2]!.id],
    );

    const composed = await user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspace.id}&search=Focus&filters[tagIds]=${alpha.id},${beta.id}&filters[computedStatuses]=OK`,
      { method: "GET" },
    );
    assert.strictEqual(composed.status, 200);
    const composedBody = (await composed.json()) as {
      results: Array<{ id: string; computedStatus: string }>;
      total: number;
    };
    assert.strictEqual(composedBody.total, 1);
    assert.deepStrictEqual(
      composedBody.results.map((result) => result.computedStatus),
      ["OK"],
    );

    const tagNameSearch = await user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspace.id}&search=Beta&filters[tagIds]=${alpha.id}`,
      { method: "GET" },
    );
    assert.strictEqual(tagNameSearch.status, 200);
    const tagNameSearchBody = (await tagNameSearch.json()) as { total: number };
    assert.strictEqual(tagNameSearchBody.total, 0);

    const withStaleId = await user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${workspace.id}&filters[tagIds]=${alpha.id},${new Types.ObjectId().toString()}`,
      { method: "GET" },
    );
    assert.strictEqual(withStaleId.status, 200);
    const withStaleIdBody = (await withStaleId.json()) as { total: number };
    assert.strictEqual(withStaleIdBody.total, 2);
  });

  it("ignores foreign or deleted tag IDs without crossing workspace or personal scope", async () => {
    const first = await seedWorkspaceMember();
    const firstWorkspace = await createWorkspace(first.userId);
    const firstTag = await createTag(first.user, firstWorkspace.slug, "First");
    const firstFeed = await ctx.container.userFeedRepository.create({
      title: "First workspace feed",
      url: `https://example.com/${generateTestId()}.xml`,
      user: { id: first.userId, discordUserId: first.discordUserId },
      workspaceId: firstWorkspace.id,
    });
    await ctx.container.userFeedRepository.updateById(firstFeed.id, {
      $set: { tagIds: [firstTag.id] },
    });

    const second = await seedWorkspaceMember();
    const secondWorkspace = await createWorkspace(second.userId);
    const secondTag = await createTag(
      second.user,
      secondWorkspace.slug,
      "Second",
    );
    await ctx.container.userFeedRepository.create({
      title: "Second workspace feed",
      url: `https://example.com/${generateTestId()}.xml`,
      user: { id: second.userId, discordUserId: second.discordUserId },
      workspaceId: secondWorkspace.id,
    });

    const foreignTag = await first.user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&workspaceId=${firstWorkspace.id}&filters[tagIds]=${secondTag.id}`,
      { method: "GET" },
    );
    assert.strictEqual(foreignTag.status, 200);
    const foreignTagBody = (await foreignTag.json()) as {
      results: Array<{ id: string }>;
      total: number;
    };
    assert.strictEqual(foreignTagBody.total, 1);
    assert.deepStrictEqual(
      foreignTagBody.results.map((result) => result.id),
      [firstFeed.id],
    );

    const personalFeed = await ctx.container.userFeedRepository.create({
      title: "Personal feed remains personal",
      url: `https://example.com/${generateTestId()}.xml`,
      user: { id: first.userId, discordUserId: first.discordUserId },
    });
    const personal = await first.user.fetch(
      `/api/v1/user-feeds?limit=10&offset=0&filters[tagIds]=${firstTag.id}`,
      { method: "GET" },
    );
    assert.strictEqual(personal.status, 200);
    const personalBody = (await personal.json()) as {
      results: Array<{ id: string }>;
    };
    assert.ok(
      personalBody.results.some((result) => result.id === personalFeed.id),
    );
  });
});
