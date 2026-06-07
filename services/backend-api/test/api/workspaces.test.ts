import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface WorkspaceResult {
  result: { id: string; name: string; slug: string; role?: string };
}
interface WorkspaceListResult {
  result: Array<{ id: string; name: string; slug: string; role: string }>;
}
interface ErrorResult {
  code: string;
}

async function seedWorkspaceUser(
  ctx: AppTestContext,
  discordUserId: string,
  opts: { verified?: boolean; withFlag?: boolean } = {},
): Promise<string> {
  await ctx.container.userRepository.create({
    discordUserId,
    email: `${discordUserId}@example.com`,
  });

  const set: Record<string, unknown> = {};
  if (opts.withFlag !== false) {
    set["featureFlags.workspaces"] = true;
  }
  if (opts.verified !== false) {
    set.verifiedEmail = `verified-${discordUserId}@example.com`;
    set.verifiedEmailVerifiedAt = new Date();
  }

  if (Object.keys(set).length) {
    await ctx.connection
      .collection("users")
      .updateOne({ discordUserId }, { $set: set });
  }

  const id =
    await ctx.container.userRepository.findIdByDiscordId(discordUserId);
  return id as string;
}

describe("Workspaces API", { concurrency: true }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  it("creates a workspace and lists it with the creator as owner", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId);
    const user = await ctx.asUser(discordId);

    const slug = `my-workspace-${discordId.slice(0, 8)}`;
    const createRes = await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "My Workspace", slug }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = await readJson<WorkspaceResult>(createRes);
    assert.strictEqual(created.result.name, "My Workspace");
    assert.strictEqual(created.result.slug, slug);
    assert.ok(created.result.id);

    const listRes = await user.fetch("/api/v1/workspaces");
    assert.strictEqual(listRes.status, 200);
    const list = await readJson<WorkspaceListResult>(listRes);
    assert.strictEqual(list.result.length, 1);
    assert.strictEqual(list.result[0]?.slug, slug);
    assert.strictEqual(list.result[0]?.role, "owner");
  });

  it("rejects workspace creation without a verified email", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId, { verified: false });
    const user = await ctx.asUser(discordId);

    const res = await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "X", slug: "valid-slug" }),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "EMAIL_NOT_VERIFIED",
    );
  });

  it("returns 404 when the user lacks the workspaces feature flag", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId, { withFlag: false });
    const user = await ctx.asUser(discordId);

    const res = await user.fetch("/api/v1/workspaces");
    assert.strictEqual(res.status, 404);
  });

  it("returns 400 for an invalid slug format", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId);
    const user = await ctx.asUser(discordId);

    for (const badSlug of [
      "-starts-with-hyphen",
      "ends-with-hyphen-",
      "double--hyphen",
      "HAS_CAPITALS",
      "x",
    ]) {
      const res = await user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "Test", slug: badSlug }),
      });
      assert.strictEqual(res.status, 400, `Expected 400 for slug: ${badSlug}`);
    }
  });

  it("rejects reserved slugs", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId);
    const user = await ctx.asUser(discordId);

    // Reserved slugs pass the format regex but are rejected by the denylist,
    // surfacing as a 409 WORKSPACE_SLUG_RESERVED so the client can show a
    // friendly slug-field error.
    for (const reserved of ["new", "settings", "api", "workspaces"]) {
      const res = await user.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "Test", slug: reserved }),
      });
      assert.strictEqual(
        res.status,
        409,
        `Expected 409 for reserved slug: ${reserved}`,
      );
      assert.strictEqual(
        (await readJson<ErrorResult>(res)).code,
        "WORKSPACE_SLUG_RESERVED",
        `Expected WORKSPACE_SLUG_RESERVED for reserved slug: ${reserved}`,
      );
    }
  });

  it("rejects a duplicate slug with 409 WORKSPACE_SLUG_TAKEN", async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    await seedWorkspaceUser(ctx, id1);
    await seedWorkspaceUser(ctx, id2);
    const user1 = await ctx.asUser(id1);
    const user2 = await ctx.asUser(id2);

    const slug = `shared-slug-${id1.slice(0, 8)}`;

    const first = await user1.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "First", slug }),
    });
    assert.strictEqual(first.status, 201);

    const second = await user2.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Second", slug }),
    });
    assert.strictEqual(second.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(second)).code,
      "WORKSPACE_SLUG_TAKEN",
    );
  });

  // The HTTP test above is caught by the service's pre-check. This drives the
  // repository directly to exercise the unique-index race path that the
  // pre-check cannot cover, asserting it surfaces as WorkspaceSlugTakenError
  // (which the service maps to 409) rather than a raw Mongo 11000 (500).
  it("maps a unique-index slug collision to WorkspaceSlugTakenError", async () => {
    const ownerId = new Types.ObjectId().toHexString();
    const slug = `race-slug-${randomUUID().slice(0, 8)}`;

    await ctx.container.workspaceRepository.createWorkspaceWithOwner({
      name: "First",
      slug,
      ownerUserId: ownerId,
    });

    await assert.rejects(
      () =>
        ctx.container.workspaceRepository.createWorkspaceWithOwner({
          name: "Second",
          slug,
          ownerUserId: new Types.ObjectId().toHexString(),
        }),
      (err: Error) => err.name === "WorkspaceSlugTakenError",
    );
  });

  it("maps a unique-index slug collision on rename to WorkspaceSlugTakenError", async () => {
    const ownerId = new Types.ObjectId().toHexString();
    const takenSlug = `taken-${randomUUID().slice(0, 8)}`;
    const otherSlug = `other-${randomUUID().slice(0, 8)}`;

    await ctx.container.workspaceRepository.createWorkspaceWithOwner({
      name: "Taken",
      slug: takenSlug,
      ownerUserId: ownerId,
    });
    const toRename =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name: "ToRename",
        slug: otherSlug,
        ownerUserId: new Types.ObjectId().toHexString(),
      });

    await assert.rejects(
      () =>
        ctx.container.workspaceRepository.updateSlug(toRename.id, takenSlug),
      (err: Error) => err.name === "WorkspaceSlugTakenError",
    );
  });

  it("scopes access to members; both owner and admin members can rename", async () => {
    const ownerId = randomUUID();
    await seedWorkspaceUser(ctx, ownerId);
    const owner = await ctx.asUser(ownerId);

    const slug = `scope-test-${ownerId.slice(0, 8)}`;
    const created = await readJson<WorkspaceResult>(
      await owner.fetch("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "T", slug }),
      }),
    );
    const workspaceSlug = created.result.slug;

    const getOwner = await owner.fetch(`/api/v1/workspaces/${workspaceSlug}`);
    assert.strictEqual(getOwner.status, 200);
    assert.strictEqual(
      (await readJson<WorkspaceResult>(getOwner)).result.role,
      "owner",
    );

    const outsiderId = randomUUID();
    await seedWorkspaceUser(ctx, outsiderId);
    const outsider = await ctx.asUser(outsiderId);
    const getOutsider = await outsider.fetch(
      `/api/v1/workspaces/${workspaceSlug}`,
    );
    assert.strictEqual(getOutsider.status, 404);

    const ownerRename = await owner.fetch(
      `/api/v1/workspaces/${workspaceSlug}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "T2" }),
      },
    );
    assert.strictEqual(ownerRename.status, 200);
    assert.strictEqual(
      (await readJson<WorkspaceResult>(ownerRename)).result.name,
      "T2",
    );

    // A non-owner admin member can also change settings (no read-only tier).
    const adminId = randomUUID();
    const adminInternalId = await seedWorkspaceUser(ctx, adminId);
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(created.result.id),
      userId: new Types.ObjectId(adminInternalId),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const adminMember = await ctx.asUser(adminId);

    const getAdmin = await adminMember.fetch(
      `/api/v1/workspaces/${workspaceSlug}`,
    );
    assert.strictEqual(getAdmin.status, 200);
    assert.strictEqual(
      (await readJson<WorkspaceResult>(getAdmin)).result.role,
      "admin",
    );

    const adminRename = await adminMember.fetch(
      `/api/v1/workspaces/${workspaceSlug}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "T3" }),
      },
    );
    assert.strictEqual(adminRename.status, 200);
    assert.strictEqual(
      (await readJson<WorkspaceResult>(adminRename)).result.name,
      "T3",
    );
  });

  it("returns 404 for an unknown slug", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId);
    const user = await ctx.asUser(discordId);

    const res = await user.fetch(
      "/api/v1/workspaces/slug-that-does-not-exist",
    );
    assert.strictEqual(res.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_NOT_FOUND",
    );
  });

  it("owner can update slug; old slug returns 404 and new slug returns 200", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId);
    const user = await ctx.asUser(discordId);

    const oldSlug = `old-slug-${discordId.slice(0, 8)}`;
    const newSlug = `new-slug-${discordId.slice(0, 8)}`;

    await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Slug Rename", slug: oldSlug }),
    });

    const renameRes = await user.fetch(`/api/v1/workspaces/${oldSlug}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: newSlug }),
    });
    assert.strictEqual(renameRes.status, 200);
    const renamed = await readJson<WorkspaceResult>(renameRes);
    assert.strictEqual(renamed.result.slug, newSlug);

    const oldRes = await user.fetch(`/api/v1/workspaces/${oldSlug}`);
    assert.strictEqual(oldRes.status, 404);

    const newRes = await user.fetch(`/api/v1/workspaces/${newSlug}`);
    assert.strictEqual(newRes.status, 200);
  });

  it("returns 409 WORKSPACE_SLUG_TAKEN when patching to an existing slug", async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    await seedWorkspaceUser(ctx, id1);
    await seedWorkspaceUser(ctx, id2);
    const user1 = await ctx.asUser(id1);
    const user2 = await ctx.asUser(id2);

    const slug1 = `patch-slug1-${id1.slice(0, 8)}`;
    const slug2 = `patch-slug2-${id1.slice(0, 8)}`;

    await user1.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Workspace1", slug: slug1 }),
    });
    await user2.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Workspace2", slug: slug2 }),
    });

    const res = await user2.fetch(`/api/v1/workspaces/${slug2}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: slug1 }),
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_SLUG_TAKEN",
    );
  });

  it("returns 404 when a non-member tries to rename a workspace", async () => {
    const ownerId = randomUUID();
    await seedWorkspaceUser(ctx, ownerId);
    const owner = await ctx.asUser(ownerId);

    const slug = `outsider-test-${ownerId.slice(0, 8)}`;
    await owner.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "T", slug }),
    });

    const outsiderId = randomUUID();
    await seedWorkspaceUser(ctx, outsiderId);
    const outsider = await ctx.asUser(outsiderId);
    const res = await outsider.fetch(`/api/v1/workspaces/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "hijack" }),
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_NOT_FOUND",
    );
  });

  it("rejects an oversized workspace name with 400", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId);
    const user = await ctx.asUser(discordId);

    const res = await user.fetch("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "x".repeat(101), slug: "valid-slug" }),
    });
    assert.strictEqual(res.status, 400);
  });

  it("404s workspace + email-verification routes when the user lacks the feature flag", async () => {
    const discordId = randomUUID();
    await seedWorkspaceUser(ctx, discordId, { withFlag: false });
    const user = await ctx.asUser(discordId);

    assert.strictEqual((await user.fetch("/api/v1/workspaces")).status, 404);
    assert.strictEqual(
      (
        await user.fetch("/api/v1/workspaces", {
          method: "POST",
          body: JSON.stringify({ name: "X", slug: "valid-slug" }),
        })
      ).status,
      404,
    );
    assert.strictEqual(
      (
        await user.fetch("/api/v1/users/@me/email-verification", {
          method: "POST",
          body: JSON.stringify({ email: "a@b.com" }),
        })
      ).status,
      404,
    );
  });
});
