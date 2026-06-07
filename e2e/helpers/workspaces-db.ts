import { MongoClient, ObjectId } from "mongodb";
import { MONGO_URI } from "./constants";

async function withDb<T>(
  fn: (db: ReturnType<MongoClient["db"]>) => Promise<T>,
): Promise<T> {
  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

async function withUsersCollection<T>(
  fn: (collection: ReturnType<ReturnType<MongoClient["db"]>["collection"]>) => Promise<T>,
): Promise<T> {
  return withDb((db) => fn(db.collection("users")));
}

/**
 * Seed the per-user workspaces rollout flag (`featureFlags.workspaces`) directly,
 * mirroring `setSupporterStatusInDb`. This flag is the sole gate for the workspaces
 * feature; without it the routes return 404.
 */
export async function enableWorkspacesFeatureInDb(discordUserId: string): Promise<void> {
  await withUsersCollection((users) =>
    users.updateOne(
      { discordUserId },
      { $set: { "featureFlags.workspaces": true } },
      { upsert: true },
    ),
  );
}

/**
 * Write a verified email directly so the passwordless send/confirm flow needs no
 * SMTP in tests. The email is unique per test user, so it never collides with
 * the unique `verifiedEmail` index.
 */
export async function setVerifiedEmailInDb(
  discordUserId: string,
  email: string,
): Promise<void> {
  await withUsersCollection((users) =>
    users.updateOne(
      { discordUserId },
      {
        $set: {
          verifiedEmail: email.trim().toLowerCase(),
          verifiedEmailVerifiedAt: new Date(),
        },
      },
      { upsert: true },
    ),
  );
}

/**
 * Seed a workspace plus a pending invitation addressed to `email` directly,
 * mirroring how the backend's `createInvite` persists a row. The invitee (the
 * authenticated test user) never owns the workspace — an arbitrary inviter
 * ObjectId stands in for the owner — so the test exercises the pure invitee
 * path: land on the invitation, verify the matching email, accept, and gain
 * membership. Returns the invitation id (the `/invites/:inviteId` segment).
 */
export async function seedWorkspaceInviteInDb(input: {
  workspaceName: string;
  email: string;
}): Promise<{ inviteId: string; workspaceId: string }> {
  return withDb(async (db) => {
    const now = new Date();
    const inviterUserId = new ObjectId();
    const workspaceId = new ObjectId();
    const inviteId = new ObjectId();
    const slug = `seeded-${inviteId.toHexString()}`;

    await db.collection("workspaces").insertOne({
      _id: workspaceId,
      name: input.workspaceName,
      slug,
      createdByUserId: inviterUserId,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("workspaceinvites").insertOne({
      _id: inviteId,
      workspaceId,
      email: input.email.trim().toLowerCase(),
      role: "admin",
      invitedByUserId: inviterUserId,
      lastSentAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { inviteId: inviteId.toHexString(), workspaceId: workspaceId.toHexString() };
  });
}

/**
 * Resolve a Discord user id to the user's Mongo `_id`. Membership rows bind to the
 * Mongo user id (Discord-agnostic), so seeding the authenticated test user as a
 * member needs their `_id`, not their Discord id. The user document is created on
 * first authenticated request, so this is read after the app has loaded.
 */
export async function getUserMongoIdFromDiscordId(discordUserId: string): Promise<ObjectId> {
  return withUsersCollection(async (users) => {
    const user = await users.findOne({ discordUserId });

    if (!user) {
      throw new Error(`No user found for discordUserId ${discordUserId}`);
    }

    return user._id as ObjectId;
  });
}

/**
 * Seed a workspace owned/joined by the authenticated test user, plus any additional
 * members and pending invitations, directly — mirroring how the backend persists
 * memberships and invites. This exercises the owner/admin member-management view:
 * the test user is a real member of a workspace with co-members and outstanding
 * invitations to manage. Returns the workspace slug for navigation and the inviter
 * Mongo id used for the seeded invites.
 */
export async function seedWorkspaceWithMembershipsInDb(input: {
  workspaceName: string;
  // The authenticated test user's Mongo id and the role they hold.
  selfUserId: ObjectId;
  selfRole: "owner" | "admin";
  // Additional members keyed by an arbitrary identity (Discord id stands in for a
  // real co-member's user document, created here so the member list can render).
  otherMembers?: Array<{ role: "owner" | "admin"; discordUserId: string }>;
  // Pending invitations addressed to these emails, all invited by the test user.
  invitedEmails?: string[];
  // Backdates the seeded invites' lastSentAt. Defaults to now (matching a freshly
  // sent invite); pass an older date to put the invite past its resend cooldown so
  // a resend succeeds immediately rather than tripping the per-invite window.
  invitedLastSentAt?: Date;
}): Promise<{ workspaceId: string; slug: string }> {
  return withDb(async (db) => {
    const now = new Date();
    const workspaceId = new ObjectId();
    const slug = `seeded-${workspaceId.toHexString()}`;

    await db.collection("workspaces").insertOne({
      _id: workspaceId,
      name: input.workspaceName,
      slug,
      createdByUserId: input.selfUserId,
      createdAt: now,
      updatedAt: now,
    });

    const memberships: Array<Record<string, unknown>> = [
      {
        workspaceId,
        userId: input.selfUserId,
        role: input.selfRole,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const member of input.otherMembers ?? []) {
      const memberUserId = new ObjectId();
      await db
        .collection("users")
        .insertOne({ _id: memberUserId, discordUserId: member.discordUserId });
      memberships.push({
        workspaceId,
        userId: memberUserId,
        role: member.role,
        createdAt: new Date(now.getTime() + 1),
        updatedAt: now,
      });
    }

    await db.collection("workspacememberships").insertMany(memberships);

    for (const email of input.invitedEmails ?? []) {
      await db.collection("workspaceinvites").insertOne({
        _id: new ObjectId(),
        workspaceId,
        email: email.trim().toLowerCase(),
        role: "admin",
        invitedByUserId: input.selfUserId,
        lastSentAt: input.invitedLastSentAt ?? now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { workspaceId: workspaceId.toHexString(), slug };
  });
}

