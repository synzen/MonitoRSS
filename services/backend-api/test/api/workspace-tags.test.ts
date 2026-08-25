import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
  type AuthenticatedUser,
} from "../helpers/test-context";
import { generateSnowflake, generateTestId } from "../helpers/test-id";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx?.teardown();
});

async function seedUser(): Promise<{
  user: AuthenticatedUser;
  userId: string;
}> {
  const discordUserId = generateSnowflake();
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

  const userId =
    await ctx.container.userRepository.findIdByDiscordId(discordUserId);

  return {
    user: await ctx.asUser(discordUserId),
    userId: userId as string,
  };
}

async function seedWorkspace(ownerUserId: string) {
  return ctx.container.workspaceRepository.createWorkspaceWithOwner({
    name: "Tag Test Team",
    slug: `tag-test-${randomUUID().slice(0, 8)}`,
    ownerUserId,
  });
}

async function addAdmin(workspaceId: string, userId: string): Promise<void> {
  await ctx.connection.collection("workspacememberships").insertOne({
    workspaceId: new Types.ObjectId(workspaceId),
    userId: new Types.ObjectId(userId),
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function createTag(
  user: AuthenticatedUser,
  workspaceSlug: string,
  name: string,
  color?: string,
): Promise<{ id: string; name: string; color?: string }> {
  const response = await user.fetch(
    `/api/v1/workspaces/${workspaceSlug}/tags`,
    {
      method: "POST",
      body: JSON.stringify({ name, color }),
    },
  );
  assert.strictEqual(response.status, 201);
  const body = (await response.json()) as {
    result: { id: string; name: string; color?: string };
  };
  return body.result;
}

describe("workspace tags", { concurrency: true }, () => {
  describe("workspace tags API", { concurrency: true }, () => {
    it("requires authentication and workspace membership", async () => {
      const owner = await seedUser();
      const outsider = await seedUser();
      const workspace = await seedWorkspace(owner.userId);

      const unauthenticated = await ctx.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
      );
      assert.strictEqual(unauthenticated.status, 401);

      const inaccessible = await outsider.user.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
      );
      assert.strictEqual(inaccessible.status, 404);
    });

    it("lets owners and admins create reusable tags and lists them alphabetically", async () => {
      const owner = await seedUser();
      const admin = await seedUser();
      const workspace = await seedWorkspace(owner.userId);
      await addAdmin(workspace.id, admin.userId);

      const zulu = await createTag(
        owner.user,
        workspace.slug,
        "  Zulu  ",
        "blue",
      );
      const alpha = await createTag(
        admin.user,
        workspace.slug,
        "alpha",
        "green",
      );

      assert.deepStrictEqual(zulu, {
        id: zulu.id,
        name: "Zulu",
        color: "blue",
      });
      assert.deepStrictEqual(alpha, {
        id: alpha.id,
        name: "alpha",
        color: "green",
      });

      const response = await owner.user.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
      );
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        results: Array<{ id: string; name: string; color?: string }>;
      };
      assert.deepStrictEqual(
        body.results.map((tag) => tag.name),
        ["alpha", "Zulu"],
      );
    });

    it("normalizes Unicode and casing for uniqueness while preserving display casing", async () => {
      const owner = await seedUser();
      const workspace = await seedWorkspace(owner.userId);

      await createTag(owner.user, workspace.slug, "Straße 🚀");
      const duplicate = await owner.user.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
        {
          method: "POST",
          body: JSON.stringify({ name: "  STRASSE 🚀  " }),
        },
      );

      assert.strictEqual(duplicate.status, 409);
      const duplicateBody = (await duplicate.json()) as { code: string };
      assert.strictEqual(duplicateBody.code, "WORKSPACE_TAG_NAME_TAKEN");

      const composed = await createTag(owner.user, workspace.slug, "Caf\u00e9");
      assert.strictEqual(composed.name, "Caf\u00e9");
      const decomposedDuplicate = await owner.user.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
        {
          method: "POST",
          body: JSON.stringify({ name: "Cafe\u0301" }),
        },
      );
      assert.strictEqual(decomposedDuplicate.status, 409);

      await createTag(owner.user, workspace.slug, "ẞ");
      const sharpSDuplicate = await owner.user.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
        {
          method: "POST",
          body: JSON.stringify({ name: "ss" }),
        },
      );
      assert.strictEqual(sharpSDuplicate.status, 409);
    });

    it("rejects invalid names, colors, and a catalog beyond 100 tags", async () => {
      const owner = await seedUser();
      const workspace = await seedWorkspace(owner.userId);

      for (const name of [
        "   ",
        "\u200b",
        "has\nnewline",
        "has\u202eoverride",
        "x".repeat(41),
      ]) {
        const response = await owner.user.fetch(
          `/api/v1/workspaces/${workspace.slug}/tags`,
          {
            method: "POST",
            body: JSON.stringify({ name }),
          },
        );
        assert.strictEqual(response.status, 400);
      }

      const invalidColor = await owner.user.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
        {
          method: "POST",
          body: JSON.stringify({ name: "Valid", color: "chartreuse" }),
        },
      );
      assert.strictEqual(invalidColor.status, 400);

      await ctx.connection.collection("workspacetags").insertMany(
        Array.from({ length: 100 }, (_, index) => ({
          workspaceId: new Types.ObjectId(workspace.id),
          name: `Tag ${index}`,
          normalizedName: `tag ${index}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      const overLimit = await owner.user.fetch(
        `/api/v1/workspaces/${workspace.slug}/tags`,
        {
          method: "POST",
          body: JSON.stringify({ name: "One too many" }),
        },
      );
      assert.strictEqual(overLimit.status, 409);
      const overLimitBody = (await overLimit.json()) as { code: string };
      assert.strictEqual(overLimitBody.code, "WORKSPACE_TAG_LIMIT_REACHED");
    });
  });

  describe("workspace feed tag assignment", { concurrency: true }, () => {
    it("replaces the complete tag set and resolves summaries in detail and list responses", async () => {
      const owner = await seedUser();
      const admin = await seedUser();
      const workspace = await seedWorkspace(owner.userId);
      await addAdmin(workspace.id, admin.userId);
      const beta = await createTag(
        owner.user,
        workspace.slug,
        "Beta",
        "purple",
      );
      const alpha = await createTag(
        owner.user,
        workspace.slug,
        "Alpha",
        "orange",
      );
      const feed = await ctx.container.userFeedRepository.create({
        title: "Tagged Team Feed",
        url: "https://example.com/tagged-team-feed.xml",
        user: { id: owner.userId, discordUserId: generateSnowflake() },
        workspaceId: workspace.id,
      });

      const assigned = await admin.user.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ tagIds: [beta.id, alpha.id] }),
      });
      assert.strictEqual(assigned.status, 200);
      const assignedBody = (await assigned.json()) as {
        result: { tags: Array<{ id: string; name: string; color?: string }> };
      };
      assert.deepStrictEqual(assignedBody.result.tags, [
        { id: alpha.id, name: "Alpha", color: "orange" },
        { id: beta.id, name: "Beta", color: "purple" },
      ]);

      const replaced = await owner.user.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        body: JSON.stringify({ tagIds: [beta.id] }),
      });
      assert.strictEqual(replaced.status, 200);
      const replacedBody = (await replaced.json()) as {
        result: { tags: Array<{ id: string; name: string }> };
      };
      assert.deepStrictEqual(replacedBody.result.tags, [
        { id: beta.id, name: "Beta", color: "purple" },
      ]);

      const secondFeed = await ctx.container.userFeedRepository.create({
        title: "Second Tagged Team Feed",
        url: "https://example.com/second-tagged-team-feed.xml",
        user: { id: owner.userId, discordUserId: generateSnowflake() },
        workspaceId: workspace.id,
      });
      const sharedTag = await owner.user.fetch(
        `/api/v1/user-feeds/${secondFeed.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ tagIds: [beta.id] }),
        },
      );
      assert.strictEqual(sharedTag.status, 200);

      const listing = await owner.user.fetch(
        `/api/v1/user-feeds?workspaceId=${workspace.id}&limit=20&offset=0`,
      );
      assert.strictEqual(listing.status, 200);
      const listingBody = (await listing.json()) as {
        results: Array<{
          id: string;
          tags: Array<{ id: string; name: string; color?: string }>;
        }>;
      };
      assert.deepStrictEqual(
        listingBody.results.find((item) => item.id === feed.id)?.tags,
        [{ id: beta.id, name: "Beta", color: "purple" }],
      );
      assert.deepStrictEqual(
        listingBody.results.find((item) => item.id === secondFeed.id)?.tags,
        [{ id: beta.id, name: "Beta", color: "purple" }],
      );
    });

    it("rejects personal, unknown, cross-workspace, duplicate, and over-limit assignments", async () => {
      const owner = await seedUser();
      const otherOwner = await seedUser();
      const workspace = await seedWorkspace(owner.userId);
      const otherWorkspace = await seedWorkspace(otherOwner.userId);
      const tag = await createTag(owner.user, workspace.slug, "Valid tag");
      const foreignTag = await createTag(
        otherOwner.user,
        otherWorkspace.slug,
        "Foreign tag",
      );
      const workspaceFeed = await ctx.container.userFeedRepository.create({
        title: "Scoped feed",
        url: "https://example.com/scoped-feed.xml",
        user: { id: owner.userId, discordUserId: generateSnowflake() },
        workspaceId: workspace.id,
      });
      const personalFeed = await ctx.container.userFeedRepository.create({
        title: "Personal feed",
        url: "https://example.com/personal-tag-feed.xml",
        user: {
          id: owner.userId,
          discordUserId: owner.user.accessToken.discord.id,
        },
      });

      const cases: Array<{ feedId: string; tagIds: string[]; code: string }> = [
        {
          feedId: personalFeed.id,
          tagIds: [tag.id],
          code: "WORKSPACE_TAGS_PERSONAL_FEED_UNSUPPORTED",
        },
        {
          feedId: workspaceFeed.id,
          tagIds: [generateTestId()],
          code: "WORKSPACE_TAG_INVALID_ASSIGNMENT",
        },
        {
          feedId: workspaceFeed.id,
          tagIds: [foreignTag.id],
          code: "WORKSPACE_TAG_INVALID_ASSIGNMENT",
        },
        {
          feedId: workspaceFeed.id,
          tagIds: [tag.id, tag.id],
          code: "WORKSPACE_TAG_INVALID_ASSIGNMENT",
        },
        {
          feedId: workspaceFeed.id,
          tagIds: Array.from({ length: 11 }, () => generateTestId()),
          code: "USER_FEED_TAG_LIMIT_REACHED",
        },
      ];

      for (const testCase of cases) {
        const response = await owner.user.fetch(
          `/api/v1/user-feeds/${testCase.feedId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ tagIds: testCase.tagIds }),
          },
        );
        assert.strictEqual(response.status, 400);
        const body = (await response.json()) as { code: string };
        assert.strictEqual(body.code, testCase.code);
      }
    });
  });
});
