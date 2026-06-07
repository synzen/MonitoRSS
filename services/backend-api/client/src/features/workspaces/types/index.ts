import { boolean, InferType, mixed, number, object, string } from "yup";

export const WORKSPACE_ROLES = ["owner", "admin"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/**
 * A workspace as seen by a member: the workspace's identity plus the caller's role in it.
 * Returned by both the list (`GET /workspaces`) and detail (`GET /workspaces/:workspaceId`)
 * endpoints.
 */
export const WorkspaceSchema = object({
  id: string().required(),
  name: string().required(),
  slug: string().required(),
  role: mixed<WorkspaceRole>()
    .oneOf([...WORKSPACE_ROLES])
    .required(),
  // The workspace's feed limit. Present on the detail endpoint; the list endpoint
  // omits it, so it is optional.
  maxFeeds: number().optional(),
}).required();

export type Workspace = InferType<typeof WorkspaceSchema>;

/**
 * The fuller workspace document returned by create/update (`POST`/`PATCH /workspaces`),
 * which has no caller role attached.
 */
export const WorkspaceDetailsSchema = object({
  id: string().required(),
  name: string().required(),
  slug: string().required(),
  createdByUserId: string().required(),
  createdAt: string().required(),
  updatedAt: string().required(),
}).required();

export type WorkspaceDetails = InferType<typeof WorkspaceDetailsSchema>;

/**
 * The invitee-facing view of a pending workspace invitation. Returned by both the
 * single-invitation landing endpoint (`GET /workspace-invites/:inviteId`) and the
 * caller's pending-invitations list (`GET /workspace-invites/@me`). The invited
 * `email` is resolved server-side from the stored invitation, never from the URL.
 */
export const WorkspaceInviteSchema = object({
  id: string().required(),
  email: string().required(),
  role: mixed<WorkspaceRole>()
    .oneOf([...WORKSPACE_ROLES])
    .required(),
  workspaceName: string().required(),
  invitedByUserId: string().required(),
  createdAt: string().required(),
}).required();

export type WorkspaceInvite = InferType<typeof WorkspaceInviteSchema>;

/**
 * Minimal context for the invitation landing page (`GET /workspace-invites/:inviteId`),
 * reachable by any authenticated user who has the invite id. The invited address is
 * returned only as a redacted hint (e.g. `a***@example.com`) so a prober cannot harvest
 * the full address; the full email surfaces only in the caller's own `@me` list once
 * their verified email matches.
 */
export const WorkspaceInviteContextSchema = object({
  id: string().required(),
  // Always present: a redacted hint (e.g. `a***@example.com`).
  emailHint: string().required(),
  // Present only when the caller's verified email already matches the invite, so
  // the verify-and-accept UX can pre-fill/lock the field for the real invitee
  // while a prober only ever sees the hint.
  email: string().optional(),
  role: mixed<WorkspaceRole>()
    .oneOf([...WORKSPACE_ROLES])
    .required(),
  workspaceName: string().required(),
  invitedByUserId: string().required(),
  createdAt: string().required(),
  // True when the caller is already a member of the workspace (resolved
  // server-side, independent of their verified email). The landing page uses it
  // to show an "already a member" state instead of offering the verify step,
  // which would otherwise overwrite the caller's verified email for an accept
  // that the server would reject anyway.
  alreadyMember: boolean().optional(),
}).required();

export type WorkspaceInviteContext = InferType<typeof WorkspaceInviteContextSchema>;

/**
 * A pending invitation as seen by an owner/admin managing a workspace. Returned by
 * the workspace-scoped invites list (`GET /workspaces/:workspaceSlug/invites`). The
 * inviter is identified by user id; creation time drives the "invited X ago" display.
 */
export const WorkspaceManagedInviteSchema = object({
  id: string().required(),
  email: string().required(),
  role: mixed<WorkspaceRole>()
    .oneOf([...WORKSPACE_ROLES])
    .required(),
  invitedByUserId: string().required(),
  createdAt: string().required(),
}).required();

export type WorkspaceManagedInvite = InferType<typeof WorkspaceManagedInviteSchema>;

/**
 * A current member of a workspace as seen by an owner/admin. Returned by
 * `GET /workspaces/:workspaceSlug/members`. Identity is kept Discord-agnostic at the
 * membership level (`userId`); `discordUserId` is surfaced so the client can both
 * render the member and identify which row is the caller (leave vs remove).
 */
export const WorkspaceMemberSchema = object({
  userId: string().required(),
  role: mixed<WorkspaceRole>()
    .oneOf([...WORKSPACE_ROLES])
    .required(),
  discordUserId: string().required(),
}).required();

export type WorkspaceMember = InferType<typeof WorkspaceMemberSchema>;
