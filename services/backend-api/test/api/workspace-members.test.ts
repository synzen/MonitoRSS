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

interface ErrorResult {
  code: string;
}

describe("Workspace members API", () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  async function seedUser(): Promise<{
    discordUserId: string;
    internalId: string;
  }> {
    const discordUserId = randomUUID();
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

    const internalId =
      await ctx.container.userRepository.findIdByDiscordId(discordUserId);
    return { discordUserId, internalId: internalId as string };
  }

  async function seedWorkspace(
    ownerUserId: string,
  ): Promise<{ id: string; slug: string }> {
    const slug = `ws-${randomUUID().slice(0, 8)}`;
    const workspace =
      await ctx.container.workspaceRepository.createWorkspaceWithOwner({
        name: "Test Workspace",
        slug,
        ownerUserId,
      });
    return { id: workspace.id, slug: workspace.slug };
  }

  async function addMembership(
    workspaceId: string,
    userId: string,
    role: "owner" | "admin",
  ): Promise<void> {
    await ctx.connection.collection("workspacememberships").insertOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  interface MembersListResult {
    result: Array<{ userId: string; role: string; discordUserId: string }>;
  }

  it("exposes can() as a pure (action, role) function for removal and leaving", () => {
    const { workspacesService } = ctx.container;

    assert.strictEqual(workspacesService.can("removeMember", "owner"), true);
    assert.strictEqual(workspacesService.can("removeMember", "admin"), false);
    assert.strictEqual(workspacesService.can("leaveWorkspace", "owner"), true);
    assert.strictEqual(workspacesService.can("leaveWorkspace", "admin"), true);
  });

  it("lets an owner remove another member; the member is deleted and loses access", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const member = await seedUser();
    await addMembership(workspace.id, member.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const removeRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${member.internalId}`,
      { method: "DELETE" },
    );
    assert.strictEqual(removeRes.status, 200);

    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    assert.strictEqual(listRes.status, 200);
    const list = await readJson<MembersListResult>(listRes);
    assert.ok(
      !list.result.some((m) => m.userId === member.internalId),
      "removed member should no longer appear in the members list",
    );

    const memberAuthed = await ctx.asUser(member.discordUserId);
    const accessRes = await memberAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}`,
    );
    assert.strictEqual(accessRes.status, 404);
  });

  it("forbids an admin from removing another member", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const admin = await seedUser();
    await addMembership(workspace.id, admin.internalId, "admin");

    const target = await seedUser();
    await addMembership(workspace.id, target.internalId, "admin");

    const adminAuthed = await ctx.asUser(admin.discordUserId);
    const res = await adminAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/${target.internalId}`,
      { method: "DELETE" },
    );
    assert.strictEqual(res.status, 403);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_INSUFFICIENT_ROLE",
    );

    // The target must still be a member.
    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.ok(list.result.some((m) => m.userId === target.internalId));
  });

  it("lets a member leave via @me; their membership is gone", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const admin = await seedUser();
    await addMembership(workspace.id, admin.internalId, "admin");

    const adminAuthed = await ctx.asUser(admin.discordUserId);
    const leaveRes = await adminAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/@me`,
      { method: "DELETE" },
    );
    assert.strictEqual(leaveRes.status, 200);

    // The leaver loses access to the workspace.
    const accessRes = await adminAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}`,
    );
    assert.strictEqual(accessRes.status, 404);

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    assert.ok(!list.result.some((m) => m.userId === admin.internalId));
  });

  it("rejects the sole owner of a populated workspace leaving; no auto-promotion", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const admin = await seedUser();
    await addMembership(workspace.id, admin.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/@me`,
      { method: "DELETE" },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "CANNOT_REMOVE_LAST_OWNER",
    );

    // The owner is still a member, and no member was promoted to owner.
    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    const list = await readJson<MembersListResult>(listRes);
    const ownerEntry = list.result.find((m) => m.userId === owner.internalId);
    assert.ok(ownerEntry, "owner should still be a member");
    assert.strictEqual(ownerEntry?.role, "owner");

    const adminEntry = list.result.find((m) => m.userId === admin.internalId);
    assert.strictEqual(
      adminEntry?.role,
      "admin",
      "the other member should not have been auto-promoted to owner",
    );
    assert.strictEqual(
      list.result.filter((m) => m.role === "owner").length,
      1,
    );
  });

  it("rejects the sole owner of an empty workspace leaving; the workspace is not deleted", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const res = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members/@me`,
      { method: "DELETE" },
    );
    assert.strictEqual(res.status, 409);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "CANNOT_REMOVE_LAST_OWNER",
    );

    // Leaving never deletes a workspace: it still resolves for the owner.
    const getRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}`,
    );
    assert.strictEqual(getRes.status, 200);
  });

  it("lists members with their roles and a user identifier", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const admin = await seedUser();
    await addMembership(workspace.id, admin.internalId, "admin");

    const ownerAuthed = await ctx.asUser(owner.discordUserId);
    const listRes = await ownerAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    assert.strictEqual(listRes.status, 200);
    const list = await readJson<MembersListResult>(listRes);
    assert.strictEqual(list.result.length, 2);

    const ownerEntry = list.result.find((m) => m.userId === owner.internalId);
    assert.strictEqual(ownerEntry?.role, "owner");
    assert.strictEqual(ownerEntry?.discordUserId, owner.discordUserId);

    const adminEntry = list.result.find((m) => m.userId === admin.internalId);
    assert.strictEqual(adminEntry?.role, "admin");
    assert.strictEqual(adminEntry?.discordUserId, admin.discordUserId);
  });

  it("forbids a non-member from listing members", async () => {
    const owner = await seedUser();
    const workspace = await seedWorkspace(owner.internalId);

    const outsider = await seedUser();
    const outsiderAuthed = await ctx.asUser(outsider.discordUserId);
    const res = await outsiderAuthed.fetch(
      `/api/v1/workspaces/${workspace.slug}/members`,
    );
    assert.strictEqual(res.status, 404);
    assert.strictEqual(
      (await readJson<ErrorResult>(res)).code,
      "WORKSPACE_NOT_FOUND",
    );
  });
});
