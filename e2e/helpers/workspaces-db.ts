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
 * Opt a user into disabled-feed alert emails (the same preference the alerting
 * settings page writes). Alert/digest recipients are filtered on this flag.
 */
export async function setDisabledFeedAlertPreferenceInDb(discordUserId: string): Promise<void> {
  await withUsersCollection((users) =>
    users.updateOne(
      { discordUserId },
      { $set: { "preferences.alertOnDisabledFeeds": true } },
      { upsert: true },
    ),
  );
}

/**
 * Seed a co-member who can RECEIVE alert emails: a freshly minted user document
 * with a verified email and the disabled-feed alert preference, plus an admin
 * membership in the workspace. The member has no browser session — they exist to
 * assert email fan-out, not to drive the UI.
 */
export async function seedAlertableWorkspaceMemberInDb(input: {
  workspaceId: string;
  email: string;
}): Promise<void> {
  await withDb(async (db) => {
    const now = new Date();
    const memberUserId = new ObjectId();

    await db.collection("users").insertOne({
      _id: memberUserId,
      discordUserId: `member-${memberUserId.toHexString()}`,
      verifiedEmail: input.email.trim().toLowerCase(),
      verifiedEmailVerifiedAt: now,
      preferences: { alertOnDisabledFeeds: true },
    });

    await db.collection("workspacememberships").insertOne({
      workspaceId: new ObjectId(input.workspaceId),
      userId: memberUserId,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Seed workspace feeds directly. Creating feeds through the API can never exceed
 * the workspace feed limit (creation is atomically gated), so tests that need an
 * OVER-limit workspace — the state a billing-driven limit decrease produces —
 * must write the feed documents themselves. `createdAt` is staggered in array
 * order so "oldest first" enforcement is deterministic.
 */
export async function seedWorkspaceFeedsInDb(input: {
  workspaceId: string;
  userId: ObjectId;
  discordUserId: string;
  feeds: Array<{ title: string; url: string; disabledCode?: string }>;
}): Promise<void> {
  await withDb(async (db) => {
    const base = Date.now() - input.feeds.length * 60_000;

    await db.collection("userfeeds").insertMany(
      input.feeds.map((feed, index) => ({
        title: feed.title,
        url: feed.url,
        ...(feed.disabledCode ? { disabledCode: feed.disabledCode } : {}),
        healthStatus: "OK",
        connections: { discordChannels: [] },
        user: { id: input.userId, discordUserId: input.discordUserId },
        workspaceId: new ObjectId(input.workspaceId),
        createdAt: new Date(base + index * 60_000),
        updatedAt: new Date(base + index * 60_000),
      })),
    );
  });
}

/**
 * Seed personal feeds (no workspace) directly with distinct titles. The convert
 * flow needs the owner to hold several personal feeds that are individually
 * identifiable in the UI; the curated/paste add-flow names every feed after the
 * source RSS title, so two added feeds would be indistinguishable. Seeding lets
 * each carry its own title while the conversion itself (re-parenting + Paddle
 * patch + webhook) still runs for real and is asserted through the UI.
 */
export async function seedPersonalFeedsInDb(input: {
  userId: ObjectId;
  discordUserId: string;
  // Pass `acceptedManagerDiscordUserId` to give a feed an accepted co-manager,
  // so the conversion dialog's "sharing does not move into a workspace" warning
  // can be exercised through the UI.
  feeds: Array<{
    title: string;
    url: string;
    acceptedManagerDiscordUserId?: string;
  }>;
}): Promise<void> {
  await withDb(async (db) => {
    const base = Date.now() - input.feeds.length * 60_000;

    await db.collection("userfeeds").insertMany(
      input.feeds.map((feed, index) => ({
        title: feed.title,
        url: feed.url,
        healthStatus: "OK",
        connections: { discordChannels: [] },
        user: { id: input.userId, discordUserId: input.discordUserId },
        ...(feed.acceptedManagerDiscordUserId
          ? {
              shareManageOptions: {
                invites: [
                  {
                    // The invite subdoc keys its id on `id` (schema has
                    // `_id: false`); the read path calls `invite.id.toString()`,
                    // so seeding `_id` instead would crash on conversion.
                    id: new ObjectId(),
                    type: "CO_MANAGE",
                    discordUserId: feed.acceptedManagerDiscordUserId,
                    status: "ACCEPTED",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ],
              },
            }
          : {}),
        createdAt: new Date(base + index * 60_000),
        updatedAt: new Date(base + index * 60_000),
      })),
    );
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
 * Seed a workspace owned by a freshly-minted user (NOT the authenticated test
 * user) together with one workspace feed, for the site-admin read-access spec:
 * the admin visits the workspace's feeds page without being a member. Returns the
 * workspace slug (for direct-URL navigation) and the seeded feed's title (to
 * assert it renders). The owner has no browser session — they exist only to own
 * the data the admin observes.
 */
export async function seedForeignWorkspaceWithFeedInDb(input: {
  workspaceName: string;
  feedTitle: string;
  feedUrl: string;
}): Promise<{ slug: string; workspaceId: string; feedTitle: string }> {
  return withDb(async (db) => {
    const now = new Date();
    const ownerUserId = new ObjectId();
    const workspaceId = new ObjectId();
    const slug = `seeded-${workspaceId.toHexString()}`;

    await db.collection("users").insertOne({
      _id: ownerUserId,
      discordUserId: `owner-${ownerUserId.toHexString()}`,
      verifiedEmail: `owner-${ownerUserId.toHexString()}@example.com`,
      verifiedEmailVerifiedAt: now,
    });

    await db.collection("workspaces").insertOne({
      _id: workspaceId,
      name: input.workspaceName,
      slug,
      createdByUserId: ownerUserId,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("workspacememberships").insertOne({
      workspaceId,
      userId: ownerUserId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("userfeeds").insertOne({
      title: input.feedTitle,
      url: input.feedUrl,
      healthStatus: "OK",
      connections: { discordChannels: [] },
      user: {
        id: ownerUserId,
        discordUserId: `owner-${ownerUserId.toHexString()}`,
      },
      workspaceId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      slug,
      workspaceId: workspaceId.toHexString(),
      feedTitle: input.feedTitle,
    };
  });
}

/**
 * Add a membership to an EXISTING workspace for an EXISTING real user — one with a live
 * browser session who must drive the UI themselves. (The co-members created by
 * `seedWorkspaceWithMembershipsInDb` get freshly minted user documents with no session,
 * so they can never click anything.)
 */
export async function seedMembershipInDb(input: {
  workspaceId: string;
  userId: ObjectId;
  role: "owner" | "admin";
}): Promise<void> {
  await withDb(async (db) => {
    const now = new Date();
    await db.collection("workspacememberships").insertOne({
      workspaceId: new ObjectId(input.workspaceId),
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    });
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
  // Pass `verifiedEmail` to give the co-member a verified email — required for a
  // member to be a valid ownership-transfer target.
  otherMembers?: Array<{
    role: "owner" | "admin";
    discordUserId: string;
    verifiedEmail?: string;
  }>;
  // Pending invitations addressed to these emails, all invited by the test user.
  invitedEmails?: string[];
  // Backdates the seeded invites' lastSentAt. Defaults to now (matching a freshly
  // sent invite); pass an older date to put the invite past its resend cooldown so
  // a resend succeeds immediately rather than tripping the per-invite window.
  invitedLastSentAt?: Date;
  // Gives the workspace an active Paddle subscription so it does not "need
  // billing". Omit to leave it without a subscription (the freshly-created
  // default, which surfaces as needsBilling when billing is enabled).
  withActiveSubscription?: boolean;
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
      ...(input.withActiveSubscription
        ? {
            firstActivatedAt: now,
            paddleCustomer: {
              customerId: `ctm_${workspaceId.toHexString()}`,
              email: "seeded-owner@example.com",
              subscription: {
                productKey: "tier2",
                status: "ACTIVE",
                billingInterval: "month",
                billingPeriodEnd: now,
                currencyCode: "USD",
                addons: [],
              },
            },
          }
        : {}),
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
      await db.collection("users").insertOne({
        _id: memberUserId,
        discordUserId: member.discordUserId,
        ...(member.verifiedEmail
          ? {
              verifiedEmail: member.verifiedEmail.trim().toLowerCase(),
              verifiedEmailVerifiedAt: now,
            }
          : {}),
      });
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

