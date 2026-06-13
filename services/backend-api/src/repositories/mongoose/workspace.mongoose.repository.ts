import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import { BaseMongooseRepository } from "./base.mongoose.repository";
import { PaddleCustomerSchema } from "./paddle-customer.subdocument";
import type { IPaddleCustomer } from "../interfaces/supporter.types";
import { normalizeEmail } from "../../shared/utils/normalizeEmail";
import {
  SubscriptionStatus,
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../shared/enums";
import {
  REDDIT_URL_REGEX,
  activeRedditCredentialElemMatch,
  expiredOrRevokedRedditCredentialConditions,
  expiringActiveRedditCredentialFilter,
  extractRedditRefreshCredential,
  normalizeExternalCredentialData,
  removeExternalCredentialsByType,
  revokeExternalCredentialById,
  upsertExternalCredential,
} from "./external-credentials.subdocument";

// owner ⊇ admin. There is no read-only tier: every membership can manage the
// workspace and its feeds. Only owner-gated actions (delete, transfer) require
// the owner role. The creator is the owner; the ≥1-owner invariant (a workspace
// must always have at least one owner) is enforced by the operations that could
// remove one (leave/remove/transfer) when they are built.
export const WORKSPACE_ROLES = ["owner", "admin"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

// Thrown when the unique slug index rejects a write (concurrent create/rename
// race that slipped past the service's pre-check). The service maps this to a
// WORKSPACE_SLUG_TAKEN conflict so the race surfaces as 409, not a generic 500.
export class WorkspaceSlugTakenError extends Error {
  constructor() {
    super("Workspace slug already taken");
    this.name = "WorkspaceSlugTakenError";
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

export interface IWorkspace {
  id: string;
  name: string;
  slug: string;
  createdByUserId: string;
  // The workspace's own Paddle subscription record, independent of any
  // member's personal supporter record. Mirrors the supporter paddleCustomer
  // shape so both billing surfaces stay interchangeable.
  paddleCustomer?: IPaddleCustomer | null;
  // Stamped once, on the first benefit-granting subscription write. Its
  // absence marks a "never-activated" workspace for the creation cap; lapsing
  // never clears it (activation permanently exits never-activated).
  firstActivatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceWithRole {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface IWorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  discordUserId: string;
}

// Thrown when removing a membership inside the transaction would leave the
// workspace with zero owners. The service maps this to CANNOT_REMOVE_LAST_OWNER.
export class CannotRemoveLastOwnerError extends Error {
  constructor() {
    super("Workspace must retain at least one owner");
    this.name = "CannotRemoveLastOwnerError";
  }
}

// A workspace's connection to an external service. Mirrors the per-user
// IUserExternalCredential shape (same status/type enums, same encrypted data
// map) with one addition: connectedByUserId records which member's personal
// account backs the grant, for attribution ("Connected by Alice") and the
// revoke-on-exit hook.
export interface IWorkspaceExternalCredential {
  id: string;
  type: UserExternalCredentialType;
  status: UserExternalCredentialStatus;
  data: Record<string, string>;
  expireAt?: Date;
  connectedByUserId: string;
}

export interface SetWorkspaceExternalCredentialInput {
  type: UserExternalCredentialType;
  data: Record<string, string>;
  expireAt?: Date;
  connectedByUserId: string;
}

export interface IWorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: string;
  createdAt: Date;
  lastSentAt: Date;
}

export interface IWorkspaceInviteWithContext extends IWorkspaceInvite {
  workspaceName: string;
  workspaceSlug: string;
}

// Thrown when the unique { workspaceId, email } index rejects a write (a
// concurrent create that slipped past the service's already-invited pre-check).
// The service maps this to a WORKSPACE_ALREADY_INVITED conflict.
export class WorkspaceInviteExistsError extends Error {
  constructor() {
    super("Workspace invite already exists");
    this.name = "WorkspaceInviteExistsError";
  }
}

const WorkspaceExternalCredentialSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(UserExternalCredentialType),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(UserExternalCredentialStatus),
      default: UserExternalCredentialStatus.Active,
    },
    data: { type: Map, of: Schema.Types.Mixed },
    expireAt: { type: Date },
    connectedByUserId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: false },
);

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    createdByUserId: { type: Schema.Types.ObjectId, required: true },
    externalCredentials: { type: [WorkspaceExternalCredentialSchema] },
    paddleCustomer: { type: PaddleCustomerSchema },
    firstActivatedAt: { type: Date },
  },
  { timestamps: true },
);

WorkspaceSchema.index({ slug: 1 }, { unique: true });

// Serves the expiring-credential refresh sweep (mirrors the user collection's
// externalCredentials index).
WorkspaceSchema.index({
  "externalCredentials.expireAt": 1,
  "externalCredentials.status": 1,
  "externalCredentials.type": 1,
});

const WorkspaceMembershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, required: true, enum: WORKSPACE_ROLES },
  },
  { timestamps: true },
);

// One membership per (workspace, user). The userId-leading field order also
// serves the hot "workspaces I'm in" lookup (find by userId) via the index
// prefix, so no separate { userId } index is needed. A workspaceId-leading
// index would be added if/when "members of a workspace" listing ships (member
// management).
WorkspaceMembershipSchema.index(
  { userId: 1, workspaceId: 1 },
  { unique: true },
);

// Serves "members of a workspace" listing (member management) and accelerates
// the owner-count invariant query. Distinct key from the unique
// { userId, workspaceId } index above, so the two do not conflict.
WorkspaceMembershipSchema.index({ workspaceId: 1, role: 1 });

// An invitation is bound to an email, never a Discord/user identity, keeping
// the workspace model decoupled from Discord. Existence-based lifecycle: a row
// exists (pending) or is gone (accepted/declined/revoked) — no status, no TTL.
const WorkspaceInviteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, required: true, enum: WORKSPACE_ROLES, default: "admin" },
    invitedByUserId: { type: Schema.Types.ObjectId, required: true },
    // When the notification email was last dispatched. Drives the per-invite
    // resend cooldown; set on creation and on each resend.
    lastSentAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

// One pending invitation per (workspace, email). The same email may hold
// pending invitations in multiple workspaces, so the uniqueness is on the pair,
// not on email alone.
WorkspaceInviteSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
// Supports the "which invitations are waiting for this just-verified address?"
// lookup keyed on email across workspaces.
WorkspaceInviteSchema.index({ email: 1 });

type WorkspaceDoc = InferSchemaType<typeof WorkspaceSchema>;
type WorkspaceMembershipDoc = InferSchemaType<typeof WorkspaceMembershipSchema>;
type WorkspaceInviteDoc = InferSchemaType<typeof WorkspaceInviteSchema>;

export class WorkspaceMongooseRepository extends BaseMongooseRepository<
  IWorkspace,
  WorkspaceDoc
> {
  private workspaceModel: Model<WorkspaceDoc>;
  private membershipModel: Model<WorkspaceMembershipDoc>;
  private inviteModel: Model<WorkspaceInviteDoc>;

  constructor(connection: Connection) {
    super();
    this.workspaceModel = connection.model<WorkspaceDoc>(
      "Workspace",
      WorkspaceSchema,
    );
    this.membershipModel = connection.model<WorkspaceMembershipDoc>(
      "WorkspaceMembership",
      WorkspaceMembershipSchema,
    );
    this.inviteModel = connection.model<WorkspaceInviteDoc>(
      "WorkspaceInvite",
      WorkspaceInviteSchema,
    );
  }

  protected toEntity(doc: WorkspaceDoc & { _id: Types.ObjectId }): IWorkspace {
    return {
      id: this.objectIdToString(doc._id),
      name: doc.name,
      slug: doc.slug,
      createdByUserId: this.objectIdToString(doc.createdByUserId),
      paddleCustomer: (doc.paddleCustomer ?? null) as IPaddleCustomer | null,
      firstActivatedAt: doc.firstActivatedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // Webhook-driven write: replaces the workspace's whole Paddle record on every
  // subscription event, mirroring the supporter upsert. Returns null when the
  // workspace no longer exists (e.g. deleted between checkout and webhook).
  async upsertPaddleCustomer(
    workspaceId: string,
    paddleCustomer: IPaddleCustomer,
  ): Promise<IWorkspace | null> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      return null;
    }

    const update: Record<string, unknown> = { $set: { paddleCustomer } };

    // First benefit-granting write permanently exits "never-activated" ($min
    // keeps the earliest stamp on later renewals/updates).
    if (paddleCustomer.subscription?.status === SubscriptionStatus.Active) {
      update.$min = { firstActivatedAt: new Date() };
    }

    const doc = await this.workspaceModel
      .findByIdAndUpdate(this.stringToObjectId(workspaceId), update, {
        new: true,
      })
      .lean();

    return doc
      ? this.toEntity(doc as WorkspaceDoc & { _id: Types.ObjectId })
      : null;
  }

  // Whether the user owns at least one workspace that has never had an active
  // subscription — the subject of the creation cap when billing is enabled.
  async ownsNeverActivatedWorkspace(userId: string): Promise<boolean> {
    const results = await this.membershipModel.aggregate([
      {
        $match: {
          userId: this.stringToObjectId(userId),
          role: "owner",
        },
      },
      {
        $lookup: {
          from: this.workspaceModel.collection.name,
          localField: "workspaceId",
          foreignField: "_id",
          as: "workspace",
        },
      },
      { $unwind: "$workspace" },
      // null matches both an absent field and an explicit null.
      { $match: { "workspace.firstActivatedAt": null } },
      { $limit: 1 },
    ]);

    return results.length > 0;
  }

  async findById(workspaceId: string): Promise<IWorkspace | null> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      return null;
    }

    const doc = await this.workspaceModel
      .findById(this.stringToObjectId(workspaceId))
      .lean();

    return doc
      ? this.toEntity(doc as WorkspaceDoc & { _id: Types.ObjectId })
      : null;
  }

  // Deletes the workspace and its dependent rows (memberships, invites) in
  // one transaction. Feeds are deleted separately by the caller through the
  // feed service so connection/queue side effects run.
  async deleteWorkspaceCascade(workspaceId: string): Promise<void> {
    const id = this.stringToObjectId(workspaceId);
    const session = await this.workspaceModel.db.startSession();

    try {
      await session.withTransaction(async () => {
        await this.workspaceModel.deleteOne({ _id: id }, { session });
        await this.membershipModel.deleteMany({ workspaceId: id }, { session });
        await this.inviteModel.deleteMany({ workspaceId: id }, { session });
      });
    } finally {
      await session.endSession();
    }
  }

  // Paddle cancellation is keyed by subscription id, not workspace id, so the
  // canceled-event handler resolves the workspace through its subscription
  // record. Mirrors the supporter repository's method of the same name.
  async nullifySubscriptionBySubscriptionId(
    subscriptionId: string,
  ): Promise<IWorkspace | null> {
    const doc = await this.workspaceModel
      .findOneAndUpdate(
        { "paddleCustomer.subscription.id": subscriptionId },
        { $set: { "paddleCustomer.subscription": null } },
      )
      .lean();

    return doc
      ? this.toEntity(doc as WorkspaceDoc & { _id: Types.ObjectId })
      : null;
  }

  async createWorkspaceWithOwner(input: {
    name: string;
    slug: string;
    ownerUserId: string;
  }): Promise<IWorkspace> {
    const ownerId = this.stringToObjectId(input.ownerUserId);
    const session = await this.workspaceModel.db.startSession();

    try {
      let result: IWorkspace | undefined;

      await session.withTransaction(async () => {
        let workspace;

        try {
          const workspaces = await this.workspaceModel.create(
            [{ name: input.name, slug: input.slug, createdByUserId: ownerId }],
            { session },
          );
          workspace = workspaces[0];
        } catch (err) {
          if (isDuplicateKeyError(err)) {
            throw new WorkspaceSlugTakenError();
          }

          throw err;
        }

        if (!workspace) {
          throw new Error(
            "Workspace creation transaction produced no workspace",
          );
        }

        await this.membershipModel.create(
          [{ workspaceId: workspace._id, userId: ownerId, role: "owner" }],
          { session },
        );

        result = this.toEntity(
          workspace.toObject() as WorkspaceDoc & { _id: Types.ObjectId },
        );
      });

      if (!result) {
        throw new Error("Workspace creation transaction produced no workspace");
      }

      return result;
    } finally {
      await session.endSession();
    }
  }

  async listWorkspacesForUser(
    userId: string,
  ): Promise<IWorkspaceWithRole[]> {
    const memberships = await this.membershipModel
      .find({ userId: this.stringToObjectId(userId) })
      .lean();

    if (!memberships.length) {
      return [];
    }

    const roleByWorkspaceId = new Map(
      memberships.map((m) => [
        m.workspaceId.toString(),
        m.role as WorkspaceRole,
      ]),
    );

    const workspaces = await this.workspaceModel
      .find({ _id: { $in: memberships.map((m) => m.workspaceId) } })
      .lean();

    return workspaces.map((w) => ({
      id: this.objectIdToString(w._id),
      name: w.name,
      slug: w.slug,
      role: roleByWorkspaceId.get(w._id.toString()) as WorkspaceRole,
    }));
  }

  // The set of workspace ids a user belongs to, for workspace-feed
  // authorization. Served by the userId-prefix of the unique membership index.
  async listWorkspaceIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.membershipModel
      .find({ userId: this.stringToObjectId(userId) })
      .select("workspaceId")
      .lean();

    return memberships.map((m) => m.workspaceId.toString());
  }

  // Returns null whether the user isn't a member or the workspace no longer
  // exists, so the two cases are indistinguishable to callers (no existence
  // leak).
  async findMembershipWithWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<{ workspace: IWorkspace; role: WorkspaceRole } | null> {
    const results = await this.membershipModel.aggregate<{
      role: WorkspaceRole;
      workspace: WorkspaceDoc & { _id: Types.ObjectId };
    }>([
      {
        $match: {
          workspaceId: this.stringToObjectId(workspaceId),
          userId: this.stringToObjectId(userId),
        },
      },
      {
        $lookup: {
          from: this.workspaceModel.collection.name,
          localField: "workspaceId",
          foreignField: "_id",
          as: "workspace",
        },
      },
      { $unwind: "$workspace" },
    ]);

    const result = results[0];

    if (!result) {
      return null;
    }

    return { workspace: this.toEntity(result.workspace), role: result.role };
  }

  async updateName(
    workspaceId: string,
    name: string,
  ): Promise<IWorkspace | null> {
    const doc = await this.workspaceModel
      .findByIdAndUpdate(
        this.stringToObjectId(workspaceId),
        { $set: { name } },
        { new: true },
      )
      .lean();

    return doc
      ? this.toEntity(doc as WorkspaceDoc & { _id: Types.ObjectId })
      : null;
  }

  async updateSlug(
    workspaceId: string,
    slug: string,
  ): Promise<IWorkspace | null> {
    let doc;

    try {
      doc = await this.workspaceModel
        .findByIdAndUpdate(
          this.stringToObjectId(workspaceId),
          { $set: { slug } },
          { new: true },
        )
        .lean();
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new WorkspaceSlugTakenError();
      }

      throw err;
    }

    return doc
      ? this.toEntity(doc as WorkspaceDoc & { _id: Types.ObjectId })
      : null;
  }

  // excludeWorkspaceId allows the workspace's own current slug to pass the
  // uniqueness check
  async isSlugTaken(
    slug: string,
    excludeWorkspaceId?: string,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = { slug };

    if (excludeWorkspaceId) {
      filter._id = { $ne: this.stringToObjectId(excludeWorkspaceId) };
    }

    return !!(await this.workspaceModel.exists(filter));
  }

  async findMembershipWithWorkspaceBySlug(
    slug: string,
    userId: string,
  ): Promise<{ workspace: IWorkspace; role: WorkspaceRole } | null> {
    const workspaceDoc = await this.workspaceModel.findOne({ slug }).lean();

    if (!workspaceDoc) {
      return null;
    }

    return this.findMembershipWithWorkspace(
      this.objectIdToString(workspaceDoc._id),
      userId,
    );
  }

  // Number of owners in a workspace. The ≥1-owner invariant uses this: any
  // operation that would remove or demote an owner (leave/remove/transfer, when
  // built) must reject if this would drop to zero, so a workspace can never be
  // orphaned.
  async countOwners(workspaceId: string): Promise<number> {
    return this.membershipModel.countDocuments({
      workspaceId: this.stringToObjectId(workspaceId),
      role: "owner",
    });
  }

  // The members of a workspace with their roles, joined with the minimal user
  // identifier (discordUserId) the member-management view needs. The verified
  // email is deliberately not exposed here. Served by the { workspaceId, role }
  // index.
  async listMembers(workspaceId: string): Promise<IWorkspaceMember[]> {
    const results = await this.membershipModel.aggregate<{
      userId: Types.ObjectId;
      role: WorkspaceRole;
      user: { discordUserId: string };
    }>([
      { $match: { workspaceId: this.stringToObjectId(workspaceId) } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $sort: { createdAt: 1 } },
    ]);

    return results.map((m) => ({
      userId: this.objectIdToString(m.userId),
      role: m.role,
      discordUserId: m.user.discordUserId,
    }));
  }

  // Emails of members who opted into disabled-feed alerts (see
  // listMemberEmails for the unfiltered variant).
  async getMemberAlertEmails(workspaceId: string): Promise<string[]> {
    return this.aggregateMemberEmails(workspaceId, {
      "user.preferences.alertOnDisabledFeeds": true,
    });
  }

  // Delete a membership while preserving the ≥1-owner invariant. The delete and
  // the owner re-count run in one transaction (mirrors createWorkspaceWithOwner)
  // so a concurrent demotion cannot slip a workspace to zero owners between the
  // check and the delete. Throws CannotRemoveLastOwnerError if removing this
  // membership would leave no owners; returns false if there was no such
  // membership.
  async removeMembership(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    const workspaceObjectId = this.stringToObjectId(workspaceId);
    const userObjectId = this.stringToObjectId(userId);
    const session = await this.membershipModel.db.startSession();

    try {
      let removed = false;

      await session.withTransaction(async () => {
        const membership = await this.membershipModel
          .findOne(
            { workspaceId: workspaceObjectId, userId: userObjectId },
            null,
            { session },
          )
          .lean();

        if (!membership) {
          removed = false;
          return;
        }

        if (membership.role === "owner") {
          const ownerCount = await this.membershipModel.countDocuments(
            { workspaceId: workspaceObjectId, role: "owner" },
            { session },
          );

          if (ownerCount <= 1) {
            throw new CannotRemoveLastOwnerError();
          }
        }

        await this.membershipModel.deleteOne(
          { workspaceId: workspaceObjectId, userId: userObjectId },
          { session },
        );

        removed = true;
      });

      return removed;
    } finally {
      await session.endSession();
    }
  }

  private toInviteEntity(
    doc: WorkspaceInviteDoc & { _id: Types.ObjectId },
  ): IWorkspaceInvite {
    return {
      id: this.objectIdToString(doc._id),
      workspaceId: this.objectIdToString(doc.workspaceId),
      email: doc.email,
      role: doc.role as WorkspaceRole,
      invitedByUserId: this.objectIdToString(doc.invitedByUserId),
      createdAt: doc.createdAt,
      lastSentAt: doc.lastSentAt,
    };
  }

  // Whether a user already holds a membership in the workspace. Served by the
  // userId-prefix of the unique membership index.
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    return !!(await this.membershipModel.exists({
      workspaceId: this.stringToObjectId(workspaceId),
      userId: this.stringToObjectId(userId),
    }));
  }

  async findPendingInvite(
    workspaceId: string,
    email: string,
  ): Promise<IWorkspaceInvite | null> {
    const doc = await this.inviteModel
      .findOne({
        workspaceId: this.stringToObjectId(workspaceId),
        email: normalizeEmail(email),
      })
      .lean();

    return doc
      ? this.toInviteEntity(doc as WorkspaceInviteDoc & { _id: Types.ObjectId })
      : null;
  }

  // A fresh invite id, so the notification link can be built before the row is
  // persisted (send-then-persist: a failed send leaves nothing behind).
  generateInviteId(): string {
    return new Types.ObjectId().toHexString();
  }

  async createInvite(input: {
    id: string;
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedByUserId: string;
  }): Promise<IWorkspaceInvite> {
    let doc;

    try {
      doc = await this.inviteModel.create({
        _id: this.stringToObjectId(input.id),
        workspaceId: this.stringToObjectId(input.workspaceId),
        email: normalizeEmail(input.email),
        role: input.role,
        invitedByUserId: this.stringToObjectId(input.invitedByUserId),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new WorkspaceInviteExistsError();
      }

      throw err;
    }

    return this.toInviteEntity(
      doc.toObject() as WorkspaceInviteDoc & { _id: Types.ObjectId },
    );
  }

  async listInvitesForWorkspace(
    workspaceId: string,
  ): Promise<IWorkspaceInvite[]> {
    const docs = await this.inviteModel
      .find({ workspaceId: this.stringToObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .lean();

    return docs.map((d) =>
      this.toInviteEntity(d as WorkspaceInviteDoc & { _id: Types.ObjectId }),
    );
  }

  // A single invitation joined with its workspace name, for the invitation
  // landing page. The invited email comes from the row, never the URL. An
  // invitation id that isn't a valid ObjectId resolves to null (treated as a
  // missing invitation by the caller) rather than throwing.
  async findInviteWithContext(
    inviteId: string,
  ): Promise<IWorkspaceInviteWithContext | null> {
    if (!Types.ObjectId.isValid(inviteId)) {
      return null;
    }

    const results = await this.inviteModel.aggregate<
      WorkspaceInviteDoc & {
        _id: Types.ObjectId;
        workspace: WorkspaceDoc & { _id: Types.ObjectId };
      }
    >([
      { $match: { _id: this.stringToObjectId(inviteId) } },
      {
        $lookup: {
          from: this.workspaceModel.collection.name,
          localField: "workspaceId",
          foreignField: "_id",
          as: "workspace",
        },
      },
      { $unwind: "$workspace" },
    ]);

    const result = results[0];

    if (!result) {
      return null;
    }

    return {
      ...this.toInviteEntity(result),
      workspaceName: result.workspace.name,
      workspaceSlug: result.workspace.slug,
    };
  }

  // The pending invitations addressed to a (verified) email across all
  // workspaces, joined with workspace name. Served by the { email } index. This
  // is what surfaces invitations to a user once they verify the matching email.
  async listInvitesForEmail(
    email: string,
  ): Promise<IWorkspaceInviteWithContext[]> {
    const results = await this.inviteModel.aggregate<
      WorkspaceInviteDoc & {
        _id: Types.ObjectId;
        workspace: WorkspaceDoc & { _id: Types.ObjectId };
      }
    >([
      { $match: { email: normalizeEmail(email) } },
      {
        $lookup: {
          from: this.workspaceModel.collection.name,
          localField: "workspaceId",
          foreignField: "_id",
          as: "workspace",
        },
      },
      { $unwind: "$workspace" },
      { $sort: { createdAt: -1 } },
    ]);

    return results.map((result) => ({
      ...this.toInviteEntity(result),
      workspaceName: result.workspace.name,
      workspaceSlug: result.workspace.slug,
    }));
  }

  // Transactionally claim an invitation: delete the invite row and insert the
  // membership in one atomic unit (mirrors createWorkspaceWithOwner). Returns
  // false if the invite no longer exists (already accepted/declined/revoked),
  // so neither side is half-applied. A pre-existing membership (the unique
  // { userId, workspaceId } index rejects the insert with 11000) aborts the
  // transaction, rolling back the delete; the user is already a member, so the
  // outcome is idempotent success — the invite is consumed with a standalone
  // delete and true is returned.
  async acceptInvite(input: {
    inviteId: string;
    userId: string;
  }): Promise<boolean> {
    if (!Types.ObjectId.isValid(input.inviteId)) {
      return false;
    }

    const inviteId = this.stringToObjectId(input.inviteId);
    const userId = this.stringToObjectId(input.userId);
    const session = await this.inviteModel.db.startSession();

    try {
      let accepted = false;
      let alreadyMember = false;

      try {
        await session.withTransaction(async () => {
          const invite = await this.inviteModel
            .findOneAndDelete({ _id: inviteId }, { session })
            .lean();

          if (!invite) {
            accepted = false;
            return;
          }

          await this.membershipModel.create(
            [
              {
                workspaceId: invite.workspaceId,
                userId,
                role: invite.role,
              },
            ],
            { session },
          );

          accepted = true;
        });
      } catch (err) {
        if (!isDuplicateKeyError(err)) {
          throw err;
        }

        // The membership already exists; the transaction aborted, rolling back
        // the delete. The user is already a member, so consume the invite with a
        // standalone delete and treat acceptance as idempotent success.
        alreadyMember = true;
      }

      if (alreadyMember) {
        await this.inviteModel.deleteOne({ _id: inviteId });

        return true;
      }

      return accepted;
    } finally {
      await session.endSession();
    }
  }

  // Scoped to the workspace so an invite id from another workspace resolves to
  // null (no cross-workspace resend/revoke by guessing ids).
  async findInviteByIdForWorkspace(
    inviteId: string,
    workspaceId: string,
  ): Promise<IWorkspaceInvite | null> {
    if (!Types.ObjectId.isValid(inviteId)) {
      return null;
    }

    const doc = await this.inviteModel
      .findOne({
        _id: this.stringToObjectId(inviteId),
        workspaceId: this.stringToObjectId(workspaceId),
      })
      .lean();

    return doc
      ? this.toInviteEntity(doc as WorkspaceInviteDoc & { _id: Types.ObjectId })
      : null;
  }

  // Atomically claim a resend slot: advance lastSentAt only if the cooldown has
  // elapsed, in a single conditional findOneAndUpdate so two concurrent resends
  // cannot both pass the window (TOCTOU). Scoped to the workspace so an invite
  // id from another workspace never matches. Returns the updated invite when the
  // slot is acquired, or null when the cooldown is still active (or no such
  // invite). The cooldown boundary is computed against the app clock here, after
  // the existence/authz check the service runs first.
  async claimInviteForResend(
    inviteId: string,
    workspaceId: string,
    cooldownMs: number,
  ): Promise<IWorkspaceInvite | null> {
    if (!Types.ObjectId.isValid(inviteId)) {
      return null;
    }

    const doc = await this.inviteModel
      .findOneAndUpdate(
        {
          _id: this.stringToObjectId(inviteId),
          workspaceId: this.stringToObjectId(workspaceId),
          lastSentAt: { $lt: new Date(Date.now() - cooldownMs) },
        },
        { $set: { lastSentAt: new Date() } },
        { new: true },
      )
      .lean();

    return doc
      ? this.toInviteEntity(doc as WorkspaceInviteDoc & { _id: Types.ObjectId })
      : null;
  }

  // Delete a pending invitation by id. When workspaceId is given the delete is
  // scoped to that workspace (revoke path — no cross-workspace deletion by
  // guessing ids); without it, deletes by id alone (decline path, where the
  // caller is acting on their own invitation resolved by id).
  async deleteInvite(inviteId: string, workspaceId?: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(inviteId)) {
      return false;
    }

    const filter: Record<string, unknown> = {
      _id: this.stringToObjectId(inviteId),
    };

    if (workspaceId) {
      filter.workspaceId = this.stringToObjectId(workspaceId);
    }

    const result = await this.inviteModel.deleteOne(filter);

    return result.deletedCount > 0;
  }

  async countInvitesForWorkspace(workspaceId: string): Promise<number> {
    return this.inviteModel.countDocuments({
      workspaceId: this.stringToObjectId(workspaceId),
    });
  }

  private toExternalCredential(credential: {
    _id?: Types.ObjectId;
    type: string;
    status: string;
    data?: unknown;
    expireAt?: Date | null;
    connectedByUserId: Types.ObjectId;
  }): IWorkspaceExternalCredential {
    return {
      id: this.objectIdToString(credential._id) as string,
      type: credential.type as UserExternalCredentialType,
      status: credential.status as UserExternalCredentialStatus,
      data: normalizeExternalCredentialData(credential.data),
      expireAt: credential.expireAt ?? undefined,
      connectedByUserId: this.objectIdToString(credential.connectedByUserId),
    };
  }

  async setExternalCredential(
    workspaceId: string,
    credential: SetWorkspaceExternalCredentialInput,
  ): Promise<void> {
    await upsertExternalCredential({
      model: this.workspaceModel,
      ownerFilter: { _id: this.stringToObjectId(workspaceId) },
      credential,
      // Re-attributed to whoever just connected.
      extraFields: {
        connectedByUserId: this.stringToObjectId(credential.connectedByUserId),
      },
    });
  }

  async getExternalCredentials(
    workspaceId: string,
    type: UserExternalCredentialType,
  ): Promise<IWorkspaceExternalCredential | null> {
    const doc = await this.workspaceModel
      .findOne(
        { _id: this.stringToObjectId(workspaceId) },
        { externalCredentials: 1 },
      )
      .lean();

    const credential = doc?.externalCredentials?.find((c) => c.type === type);

    return credential ? this.toExternalCredential(credential) : null;
  }

  async removeExternalCredentials(
    workspaceId: string,
    type: UserExternalCredentialType,
  ): Promise<void> {
    await removeExternalCredentialsByType({
      model: this.workspaceModel,
      ownerFilter: { _id: this.stringToObjectId(workspaceId) },
      type,
    });
  }

  async revokeExternalCredential(
    workspaceId: string,
    credentialId: string,
  ): Promise<void> {
    await revokeExternalCredentialById({
      model: this.workspaceModel,
      ownerFilter: { _id: this.stringToObjectId(workspaceId) },
      credentialId: this.stringToObjectId(credentialId),
    });
  }

  // Workspace counterpart of the user repository's reddit lookup-key
  // aggregations: workspace feeds resolve credentials from their workspace,
  // never their creator, so the sync must consult workspace credentials.
  async *aggregateWorkspacesWithActiveRedditCredentials(options?: {
    workspaceIds?: string[];
    feedIds?: string[];
  }): AsyncIterable<{ feedId: string; lookupKey?: string }> {
    const cursor = this.workspaceModel
      .aggregate([
        {
          $match: {
            ...(options?.workspaceIds?.length && {
              _id: {
                $in: options.workspaceIds.map((id) =>
                  this.stringToObjectId(id),
                ),
              },
            }),
            ...activeRedditCredentialElemMatch(),
          },
        },
        {
          $lookup: {
            from: "userfeeds",
            localField: "_id",
            foreignField: "workspaceId",
            as: "feeds",
          },
        },
        { $unwind: { path: "$feeds" } },
        {
          $match: {
            "feeds.url": REDDIT_URL_REGEX,
            ...(options?.feedIds?.length && {
              "feeds._id": {
                $in: options.feedIds.map((id) => this.stringToObjectId(id)),
              },
            }),
          },
        },
        {
          $project: {
            feedId: "$feeds._id",
            lookupKey: "$feeds.feedRequestLookupKey",
            _id: 0,
          },
        },
      ])
      .cursor();

    for await (const doc of cursor) {
      yield {
        feedId: this.objectIdToString(doc.feedId),
        lookupKey: doc.lookupKey,
      };
    }
  }

  async *aggregateWorkspaceFeedsWithExpiredOrRevokedRedditCredentials(options?: {
    workspaceIds?: string[];
    feedIds?: string[];
  }): AsyncIterable<{ feedId: string }> {
    const cursor = this.workspaceModel.db
      .collection("userfeeds")
      .aggregate([
        {
          $match: {
            feedRequestLookupKey: { $exists: true },
            url: REDDIT_URL_REGEX,
            workspaceId: options?.workspaceIds?.length
              ? {
                  $in: options.workspaceIds.map((id) =>
                    this.stringToObjectId(id),
                  ),
                }
              : { $exists: true },
            ...(options?.feedIds?.length && {
              _id: {
                $in: options.feedIds.map((id) => this.stringToObjectId(id)),
              },
            }),
          },
        },
        {
          $lookup: {
            from: this.workspaceModel.collection.name,
            localField: "workspaceId",
            foreignField: "_id",
            as: "workspace",
          },
        },
        {
          $set: {
            workspace: { $arrayElemAt: ["$workspace", 0] },
          },
        },
        {
          $match: {
            $or: [
              // Unlike user-owned feeds, a feed whose workspace doc is gone
              // has no credential source at all, so its key is unset too.
              { workspace: null },
              ...expiredOrRevokedRedditCredentialConditions("workspace"),
            ],
          },
        },
        {
          $project: {
            feedId: "$_id",
            _id: 0,
          },
        },
      ]);

    for await (const doc of cursor) {
      yield {
        feedId: this.objectIdToString(doc.feedId as Types.ObjectId),
      };
    }
  }

  // Workspaces whose reddit credential is nearing expiry, for the scheduled
  // refresh sweep (mirrors iterateUsersWithExpiringRedditCredentials).
  async *iterateWorkspacesWithExpiringRedditCredentials(
    withinMs: number,
  ): AsyncIterable<{
    workspaceId: string;
    credentialId: string;
    encryptedRefreshToken: string;
  }> {
    const expirationThreshold = new Date(Date.now() + withinMs);

    const cursor = this.workspaceModel
      .find(expiringActiveRedditCredentialFilter(expirationThreshold))
      .select("_id externalCredentials")
      .lean()
      .cursor();

    for await (const doc of cursor) {
      const credential = extractRedditRefreshCredential(doc);

      if (!credential) {
        continue;
      }

      yield {
        workspaceId: this.objectIdToString(doc._id),
        credentialId: this.objectIdToString(credential.credentialId) as string,
        encryptedRefreshToken: credential.encryptedRefreshToken,
      };
    }
  }

  // Notification fan-out targets: every member's email address. Prefers the
  // verified email (the workspace identity) over the Discord-provided one.
  async listMemberEmails(workspaceId: string): Promise<string[]> {
    return this.aggregateMemberEmails(workspaceId);
  }

  private async aggregateMemberEmails(
    workspaceId: string,
    userMatch?: Record<string, unknown>,
  ): Promise<string[]> {
    const results = await this.membershipModel.aggregate<{
      user: { email?: string; verifiedEmail?: string };
    }>([
      { $match: { workspaceId: this.stringToObjectId(workspaceId) } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      ...(userMatch ? [{ $match: userMatch }] : []),
      { $project: { user: { email: 1, verifiedEmail: 1 } } },
    ]);

    return [
      ...new Set(
        results
          .map((r) => r.user.verifiedEmail || r.user.email)
          .filter((email): email is string => !!email),
      ),
    ];
  }
}
