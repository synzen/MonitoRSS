import Handlebars from "handlebars";
import {
  ApiErrorCode,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../../infra/error-handler";
import { isReservedSlug, isValidSlug } from "../../shared/utils/slugify";
import { normalizeEmail } from "../../shared/utils/normalizeEmail";
import { reconcileFeedLookupKeys } from "../../shared/utils/reconcile-feed-lookup-keys";
import dayjs from "dayjs";
import type { Config } from "../../config";
import type { SmtpTransport } from "../../infra/smtp";
import { createFromFormatter } from "../../infra/email-from";
import { createEmailRenderer, type RenderEmail } from "../../infra/email-render";
import { encrypt } from "../../utils/encrypt";
import { decrypt } from "../../shared/utils/decrypt";
import logger from "../../infra/logger";
import type { UserMongooseRepository } from "../../repositories/mongoose/user.mongoose.repository";
import type { IUserFeedRepository } from "../../repositories/interfaces/user-feed.types";
import type { ISupporterRepository } from "../../repositories/interfaces/supporter.types";
import {
  isBillingEnabled,
  resolvePersonalConvertibility,
  CONVERSION_GUARD_TTL_MS,
} from "../../shared/utils/billing";
import type { RedditApiService } from "../../services/reddit-api/reddit-api.service";
import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../../repositories/shared/enums";
import {
  CannotRemoveLastOwnerError,
  InvalidOwnershipTransferTargetError,
  WorkspaceInviteExistsError,
  WorkspaceSlugTakenError,
  type IWorkspace,
  type IWorkspaceExternalCredential,
  type IWorkspaceInvite,
  type IWorkspaceInviteWithContext,
  type IWorkspaceMember,
  type IWorkspaceWithRole,
  type WorkspaceRole,
  type WorkspaceMongooseRepository,
} from "../../repositories/mongoose/workspace.mongoose.repository";
import type { EmailVerificationService } from "../users/email-verification.service";
import WORKSPACE_INVITE_TEMPLATE from "./workspace-invite.template";
import WORKSPACE_REDDIT_CONNECTION_LOST_TEMPLATE from "./workspace-reddit-connection-lost.template";
import WORKSPACE_OWNERSHIP_TRANSFERRED_TEMPLATE from "./workspace-ownership-transferred.template";

const inviteTemplate = Handlebars.compile(WORKSPACE_INVITE_TEMPLATE);
const redditConnectionLostTemplate = Handlebars.compile(
  WORKSPACE_REDDIT_CONNECTION_LOST_TEMPLATE,
);
const ownershipTransferredTemplate = Handlebars.compile(
  WORKSPACE_OWNERSHIP_TRANSFERRED_TEMPLATE,
);

// v1 invitations grant admin only; the role is stored for forward-compatibility.
const INVITE_ROLE: WorkspaceRole = "admin";

// Mirrors EmailVerificationService's resend cooldown: bounds how often a given
// invitation's notification email can be re-dispatched.
const INVITE_RESEND_COOLDOWN_MS = 60 * 1000;

// Cap on pending invitations a single workspace may hold at once. Bounds abuse
// (mass invite spam) and the unbounded growth of the invite collection.
const MAX_PENDING_INVITES_PER_WORKSPACE = 25;

// A conversion guard is "live" while it is set and within its TTL. Past the
// TTL it is treated as expired, so a dropped webhook can't exempt a workspace
// indefinitely (the webhook clears it on the happy path). Co-located with the
// TTL so any reader applies the same expiry rule.
function isConversionGuardLive(startedAt?: Date | null): boolean {
  if (!startedAt) {
    return false;
  }

  return Date.now() - startedAt.getTime() < CONVERSION_GUARD_TTL_MS;
}

// owner ⊇ admin. changeSettings/manageMembers/leaveWorkspace are open to every
// member (all are ≥ admin); removeMember/deleteWorkspace/transferOwnership are
// owner-gated. The function is the seam: handlers call can(), never compare role
// strings, so a future role or action is a change here, not across handlers. It
// stays a pure (action, role) function — identity (actor vs target) is handler
// routing, not policy.
type WorkspaceAction =
  | "changeSettings"
  | "manageMembers"
  | "manageIntegrations"
  | "removeMember"
  | "leaveWorkspace"
  | "deleteWorkspace"
  | "transferOwnership"
  | "manageBilling";

export type ConversionEligibility =
  | { eligible: true; feedLimit: number }
  | { eligible: false; ineligibleReason: "PERSONAL_PLAN_INELIGIBLE" };

export interface WorkspacesServiceDeps {
  config: Config;
  smtpTransport: SmtpTransport;
  workspaceRepository: WorkspaceMongooseRepository;
  userRepository: UserMongooseRepository;
  userFeedRepository: IUserFeedRepository;
  supporterRepository: ISupporterRepository;
  emailVerificationService: EmailVerificationService;
  redditApiService: RedditApiService;
}

export class WorkspacesService {
  private readonly renderEmail: RenderEmail;

  constructor(private readonly deps: WorkspacesServiceDeps) {
    this.renderEmail = createEmailRenderer(deps.config);
  }

  // Authorization seam: callers check can(...) rather than comparing roles.
  can(action: WorkspaceAction, role: WorkspaceRole): boolean {
    switch (action) {
      case "changeSettings":
      case "manageMembers":
      // Open to every member by design: when the workspace's Reddit connection
      // breaks, the largest possible set of people must be able to fix it by
      // reconnecting with their own account.
      case "manageIntegrations":
      case "leaveWorkspace":
        return role === "owner" || role === "admin";
      case "removeMember":
      case "deleteWorkspace":
      case "transferOwnership":
      // Billing mutations are owner-only: the owner is the purchasing payer.
      // Admins may read subscription status (the workspace read) but never
      // change a plan someone else pays for.
      case "manageBilling":
        return role === "owner";
      default:
        return false;
    }
  }

  // True while a personal→workspace conversion is in flight for this workspace
  // (feeds re-parented, subscription webhook not yet landed). Feed-limit
  // enforcement reads this to skip its disable step so just-moved feeds aren't
  // disabled before the subscription record exists. A guard older than the TTL
  // is treated as expired, so a dropped webhook can't exempt a workspace
  // indefinitely (the webhook clears it on the happy path).
  async isConversionInProgress(workspaceId: string): Promise<boolean> {
    const workspace = await this.deps.workspaceRepository.findById(workspaceId);

    return isConversionGuardLive(workspace?.conversionInProgressAt);
  }

  // Bulk counterpart of isConversionInProgress for the feed-limit sweep:
  // resolves which of many workspaces are mid-conversion in a single query
  // instead of one read per workspace.
  async conversionInProgressWorkspaceIds(
    workspaceIds: string[],
  ): Promise<Set<string>> {
    const guarded =
      await this.deps.workspaceRepository.findWorkspaceIdsWithLiveConversionGuard(
        workspaceIds,
        CONVERSION_GUARD_TTL_MS,
      );

    return new Set(guarded);
  }

  // The conversion read model for the workspace detail response. Null when
  // conversion is not on offer (not the owner, the workspace is already funded,
  // or billing is not configured), so the client shows nothing. When the owner
  // could convert but their personal plan is Free / Tier 1, eligible is false
  // with a reason so the client can point them at buying a team plan directly.
  async getConversionEligibility(
    workspace: IWorkspace,
    role: WorkspaceRole,
    discordUserId: string,
  ): Promise<ConversionEligibility | null> {
    if (
      !isBillingEnabled(this.deps.config) ||
      !this.can("manageBilling", role) ||
      workspace.paddleCustomer?.subscription ||
      // A conversion is already in flight (guard set, subscription not yet
      // recorded by the webhook). Don't re-offer the affordance — that would
      // let a second tab or a refresh fire a duplicate conversion.
      isConversionGuardLive(workspace.conversionInProgressAt)
    ) {
      return null;
    }

    const supporter = await this.deps.supporterRepository.findById(discordUserId);
    const convertible = resolvePersonalConvertibility(
      supporter?.paddleCustomer?.subscription,
    );

    if (!convertible) {
      return { eligible: false, ineligibleReason: "PERSONAL_PLAN_INELIGIBLE" };
    }

    // feedLimit is the plan that would move, add-on capacity already folded
    // into maxUserFeeds by the webhook handler — the same number the conversion
    // endpoint caps on (both derive it from resolvePersonalConvertibility).
    return { eligible: true, feedLimit: convertible.feedLimit };
  }

  async createWorkspace(
    userId: string,
    name: string,
    slug: string,
  ): Promise<IWorkspace> {
    const user = await this.deps.userRepository.findById(userId);

    if (!user?.verifiedEmail) {
      throw new ForbiddenError(ApiErrorCode.EMAIL_NOT_VERIFIED);
    }

    // Anti-hoarding cap, only meaningful when billing exists: one
    // never-activated workspace per user. Activation permanently exits the
    // cap, so a lapsed-but-previously-active workspace never counts.
    if (
      isBillingEnabled(this.deps.config) &&
      (await this.deps.workspaceRepository.ownsNeverActivatedWorkspace(userId))
    ) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_NEVER_ACTIVATED_EXISTS);
    }

    if (isReservedSlug(slug)) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_SLUG_RESERVED);
    }

    if (!isValidSlug(slug)) {
      throw new ConflictError(ApiErrorCode.VALIDATION_FAILED);
    }

    const taken = await this.deps.workspaceRepository.isSlugTaken(slug);

    if (taken) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_SLUG_TAKEN);
    }

    try {
      return await this.deps.workspaceRepository.createWorkspaceWithOwner({
        name,
        slug,
        ownerUserId: userId,
      });
    } catch (err) {
      if (err instanceof WorkspaceSlugTakenError) {
        throw new ConflictError(ApiErrorCode.WORKSPACE_SLUG_TAKEN);
      }

      throw err;
    }
  }

  async listWorkspaces(userId: string): Promise<IWorkspaceWithRole[]> {
    return this.deps.workspaceRepository.listWorkspacesForUser(userId);
  }

  // The workspace ids a user belongs to, for workspace-feed authorization.
  async listWorkspaceIds(userId: string): Promise<string[]> {
    return this.deps.workspaceRepository.listWorkspaceIdsForUser(userId);
  }

  async getWorkspaceForMember(
    workspaceId: string,
    userId: string,
  ): Promise<{ workspace: IWorkspace; role: WorkspaceRole }> {
    const found =
      await this.deps.workspaceRepository.findMembershipWithWorkspace(
        workspaceId,
        userId,
      );

    if (!found) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_NOT_FOUND);
    }

    return found;
  }

  async getWorkspaceForMemberBySlug(
    slug: string,
    userId: string,
  ): Promise<{ workspace: IWorkspace; role: WorkspaceRole }> {
    const found =
      await this.deps.workspaceRepository.findMembershipWithWorkspaceBySlug(
        slug,
        userId,
      );

    if (!found) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_NOT_FOUND);
    }

    return found;
  }

  async updateWorkspaceName(
    workspaceId: string,
    userId: string,
    name: string,
  ): Promise<IWorkspace> {
    const { role } = await this.getWorkspaceForMember(workspaceId, userId);

    if (!this.can("changeSettings", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const updated = await this.deps.workspaceRepository.updateName(
      workspaceId,
      name,
    );

    if (!updated) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_NOT_FOUND);
    }

    return updated;
  }

  async updateWorkspaceSlug(
    workspaceId: string,
    userId: string,
    slug: string,
  ): Promise<IWorkspace> {
    const { role } = await this.getWorkspaceForMember(workspaceId, userId);

    if (!this.can("changeSettings", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    if (isReservedSlug(slug)) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_SLUG_RESERVED);
    }

    if (!isValidSlug(slug)) {
      throw new ConflictError(ApiErrorCode.VALIDATION_FAILED);
    }

    const taken = await this.deps.workspaceRepository.isSlugTaken(
      slug,
      workspaceId,
    );

    if (taken) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_SLUG_TAKEN);
    }

    let updated: IWorkspace | null;

    try {
      updated = await this.deps.workspaceRepository.updateSlug(
        workspaceId,
        slug,
      );
    } catch (err) {
      if (err instanceof WorkspaceSlugTakenError) {
        throw new ConflictError(ApiErrorCode.WORKSPACE_SLUG_TAKEN);
      }

      throw err;
    }

    if (!updated) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_NOT_FOUND);
    }

    return updated;
  }

  async createInvite(
    slug: string,
    userId: string,
    rawEmail: string,
  ): Promise<IWorkspaceInvite> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      userId,
    );

    if (!this.can("manageMembers", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const email = normalizeEmail(rawEmail);

    // Membership binds to the verified email, so "already a member" resolves the
    // invited email to its verified-email owner and checks this workspace only.
    const existingUser =
      await this.deps.userRepository.findByVerifiedEmail(email);

    if (
      existingUser &&
      (await this.deps.workspaceRepository.isMember(
        workspace.id,
        existingUser.id,
      ))
    ) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_MEMBER_ALREADY_EXISTS);
    }

    const pending = await this.deps.workspaceRepository.findPendingInvite(
      workspace.id,
      email,
    );

    if (pending) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_ALREADY_INVITED);
    }

    const pendingCount =
      await this.deps.workspaceRepository.countInvitesForWorkspace(
        workspace.id,
      );

    if (pendingCount >= MAX_PENDING_INVITES_PER_WORKSPACE) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_INVITE_LIMIT_REACHED);
    }

    // The row is only created if the notification can be dispatched: a failed
    // send must never leave a stranded invitation. The link is keyed by the
    // invitation id, so the id is generated up front, the email is sent, and
    // only then is the row persisted — a send failure persists nothing.
    const inviteId = this.deps.workspaceRepository.generateInviteId();

    await this.sendInviteEmail(inviteId, email, workspace.name);

    try {
      return await this.deps.workspaceRepository.createInvite({
        id: inviteId,
        workspaceId: workspace.id,
        email,
        role: INVITE_ROLE,
        invitedByUserId: userId,
      });
    } catch (err) {
      if (err instanceof WorkspaceInviteExistsError) {
        throw new ConflictError(ApiErrorCode.WORKSPACE_ALREADY_INVITED);
      }

      throw err;
    }
  }

  private async sendInviteEmail(
    inviteId: string,
    email: string,
    workspaceName: string,
  ): Promise<void> {
    if (!this.deps.smtpTransport) {
      throw new ServiceUnavailableError(
        ApiErrorCode.WORKSPACE_INVITE_EMAIL_UNAVAILABLE,
      );
    }

    // The link is keyed by invitation id; the invited email never appears in it.
    const inviteUrl = `${this.deps.config.BACKEND_API_LOGIN_REDIRECT_URI}/invites/${inviteId}`;

    await this.deps.smtpTransport.sendMail({
      from: createFromFormatter(this.deps.config)("MonitoRSS", "noreply"),
      to: email,
      subject: `You've been invited to ${workspaceName} on MonitoRSS`,
      html: this.renderEmail(inviteTemplate, { workspaceName, inviteUrl }),
    });
  }

  async listInvites(
    slug: string,
    userId: string,
  ): Promise<IWorkspaceInvite[]> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      userId,
    );

    if (!this.can("manageMembers", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    return this.deps.workspaceRepository.listInvitesForWorkspace(workspace.id);
  }

  // Minimal context for the invitation landing page. The invited email is
  // resolved from the row, never trusted from the URL. Reachable by any
  // feature-flagged user who has the invite id, so the full invited address is
  // disclosed only when the caller has already proven ownership of it
  // (verifiedEmail matches); otherwise emailMatches is false and the handler
  // returns a redacted hint, preventing address harvesting by a prober.
  async getInvite(
    inviteId: string,
    userId: string,
  ): Promise<{
    invite: IWorkspaceInviteWithContext;
    emailMatches: boolean;
    alreadyMember: boolean;
  }> {
    const invite =
      await this.deps.workspaceRepository.findInviteWithContext(inviteId);

    if (!invite) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_INVITE_NOT_FOUND);
    }

    const user = await this.deps.userRepository.findById(userId);
    const emailMatches = !!user?.verifiedEmail && user.verifiedEmail === invite.email;

    // Surfaced so the landing page can short-circuit the verify-then-accept flow
    // for a caller who is already a member (the path an owner hits on their own
    // invite). Without it the page would push them through email verification —
    // which overwrites their verified email — only for the accept to be rejected
    // by the same-member guard. This check is independent of verifiedEmail, so it
    // can be evaluated before any verification happens.
    const alreadyMember = await this.deps.workspaceRepository.isMember(
      invite.workspaceId,
      userId,
    );

    return { invite, emailMatches, alreadyMember };
  }

  // Invite-scoped email-verification send. Unlike the generic send endpoint,
  // this dispatches a code ONLY when the submitted address matches the real
  // invited address — so the invite flow can never email an unrelated address.
  // The match decision is never reflected in the response: a matching and a
  // non-matching (or unknown-invite) call return identically, so this endpoint
  // is not an oracle a prober could use to harvest the invited address (the same
  // anti-harvesting property getInvite preserves with its redacted hint).
  async sendInviteVerification(
    inviteId: string,
    userId: string,
    submittedEmail: string,
  ): Promise<void> {
    const invite =
      await this.deps.workspaceRepository.findInviteWithContext(inviteId);

    // Unknown invite or mismatched address: no-op, no send, uniform return.
    if (!invite || normalizeEmail(submittedEmail) !== invite.email) {
      return;
    }

    await this.deps.emailVerificationService.sendCode(userId, invite.email);
  }

  // Invitations addressed to the caller's verified email, with workspace name +
  // inviter. Returns nothing until the user verifies a matching email, so a
  // freshly-verified address surfaces its pending invitations here with no
  // extra hook.
  async listMyInvites(userId: string): Promise<IWorkspaceInviteWithContext[]> {
    const user = await this.deps.userRepository.findById(userId);

    if (!user?.verifiedEmail) {
      return [];
    }

    return this.deps.workspaceRepository.listInvitesForEmail(
      user.verifiedEmail,
    );
  }

  // Both accept and decline are gated server-side on the caller's verifiedEmail
  // matching the invitation's email. The decision axis is purely the user's
  // verifiedEmail state; the Discord-provided email never enters the logic.
  private async assertCanClaim(
    inviteId: string,
    userId: string,
  ): Promise<IWorkspaceInviteWithContext> {
    const invite =
      await this.deps.workspaceRepository.findInviteWithContext(inviteId);

    if (!invite) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_INVITE_NOT_FOUND);
    }

    const user = await this.deps.userRepository.findById(userId);

    // The error CODE alone tells the client which case it is. The invited email
    // is never echoed here: the invitee gets the (redacted) address from the
    // gated single-invite GET, so this 403 must not leak it to a prober.
    if (!user?.verifiedEmail) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INVITE_EMAIL_UNVERIFIED);
    }

    if (user.verifiedEmail !== invite.email) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INVITE_EMAIL_MISMATCH);
    }

    return invite;
  }

  async acceptInvite(
    inviteId: string,
    userId: string,
  ): Promise<{ workspaceSlug: string }> {
    const invite = await this.assertCanClaim(inviteId, userId);

    // A user who is already a member of the workspace cannot consume the invite.
    // This is the path an owner hits when they verify the invited email onto
    // their own account and accept their own invitation: the membership insert
    // would collide with their existing membership. Rejecting here (rather than
    // swallowing the collision as idempotent success) leaves the invite pending
    // so it can still reach the intended person.
    if (
      await this.deps.workspaceRepository.isMember(invite.workspaceId, userId)
    ) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_INVITE_ALREADY_MEMBER);
    }

    const accepted = await this.deps.workspaceRepository.acceptInvite({
      inviteId,
      userId,
    });

    if (!accepted) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_INVITE_NOT_FOUND);
    }

    return { workspaceSlug: invite.workspaceSlug };
  }

  async declineInvite(inviteId: string, userId: string): Promise<void> {
    await this.assertCanClaim(inviteId, userId);

    const declined = await this.deps.workspaceRepository.deleteInvite(inviteId);

    if (!declined) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_INVITE_NOT_FOUND);
    }
  }

  async resendInvite(
    slug: string,
    userId: string,
    inviteId: string,
  ): Promise<void> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      userId,
    );

    if (!this.can("manageMembers", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const invite =
      await this.deps.workspaceRepository.findInviteByIdForWorkspace(
        inviteId,
        workspace.id,
      );

    if (!invite) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_INVITE_NOT_FOUND);
    }

    // Atomically acquire the resend slot before sending: the cooldown check and
    // the lastSentAt advance are one conditional update, so two concurrent
    // resends cannot both pass the window. A null return means the slot is still
    // on cooldown (the invite exists — its existence was just verified above).
    const claimed = await this.deps.workspaceRepository.claimInviteForResend(
      invite.id,
      workspace.id,
      INVITE_RESEND_COOLDOWN_MS,
    );

    if (!claimed) {
      throw new TooManyRequestsError(
        ApiErrorCode.WORKSPACE_INVITE_RESEND_TOO_SOON,
      );
    }

    // Send after acquiring the slot. A send failure leaves lastSentAt advanced —
    // the safe direction (a transient failure cannot be retried until the next
    // window rather than enabling a send-spam loop).
    await this.sendInviteEmail(claimed.id, claimed.email, workspace.name);
  }

  async revokeInvite(
    slug: string,
    userId: string,
    inviteId: string,
  ): Promise<void> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      userId,
    );

    if (!this.can("manageMembers", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const deleted = await this.deps.workspaceRepository.deleteInvite(
      inviteId,
      workspace.id,
    );

    if (!deleted) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_INVITE_NOT_FOUND);
    }
  }

  async listMembers(slug: string, userId: string): Promise<IWorkspaceMember[]> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      userId,
    );

    if (!this.can("manageMembers", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    return this.deps.workspaceRepository.listMembers(workspace.id);
  }

  // Identity-aware routing: removing oneself is leaving (leaveWorkspace);
  // removing another member requires removeMember (owner only). The actor vs
  // target decision lives here, not in can().
  async removeMember(
    slug: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      return this.leaveWorkspace(slug, actorUserId);
    }

    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      actorUserId,
    );

    if (!this.can("removeMember", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const removed = await this.removeMembershipEnforcingOwnerCount(
      workspace.id,
      targetUserId,
    );

    if (!removed) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_NOT_FOUND);
    }

    await this.handleRedditConnectionOnMemberExit(workspace, targetUserId);
  }

  async leaveWorkspace(slug: string, userId: string): Promise<void> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      userId,
    );

    if (!this.can("leaveWorkspace", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const removed = await this.removeMembershipEnforcingOwnerCount(
      workspace.id,
      userId,
    );

    if (!removed) {
      throw new NotFoundError(ApiErrorCode.WORKSPACE_NOT_FOUND);
    }

    await this.handleRedditConnectionOnMemberExit(workspace, userId);
  }

  // Account-erasure pre-check: throws if the user is the only owner of any
  // workspace. A solely-owned workspace would be orphaned by their departure,
  // so it must be transferred or deleted first. Co-owned workspaces are fine.
  async assertNotSoleWorkspaceOwner(userId: string): Promise<void> {
    const owned =
      await this.deps.workspaceRepository.listOwnedWorkspacesWithOwnerCount(
        userId,
      );

    if (owned.some((w) => w.ownerCount <= 1)) {
      throw new ConflictError(
        ApiErrorCode.ACCOUNT_DELETE_SOLE_WORKSPACE_OWNER,
      );
    }
  }

  // Account erasure: removes the user from every workspace they belong to and
  // deletes the invitations they sent or that were addressed to them. The
  // sole-owner pre-check (assertNotSoleWorkspaceOwner) must have run first, so
  // no workspace is orphaned by the membership removal. Reddit connections the
  // departing member backed are revoked per workspace before their memberships
  // are dropped, mirroring the single-member-exit path. Idempotent: a user with
  // no memberships or invites is a no-op.
  async removeUserFromAllWorkspaces(
    userId: string,
    verifiedEmail?: string | null,
  ): Promise<void> {
    const workspaceIds =
      await this.deps.workspaceRepository.listWorkspaceIdsForUser(userId);

    for (const workspaceId of workspaceIds) {
      const workspace =
        await this.deps.workspaceRepository.findById(workspaceId);

      if (workspace) {
        await this.handleRedditConnectionOnMemberExit(workspace, userId);
      }
    }

    await this.deps.workspaceRepository.removeAllMembershipsForUser(userId);

    await this.deps.workspaceRepository.deleteInvitesByInviterOrEmail(
      userId,
      verifiedEmail,
    );
  }

  // Transfers the owner role to an existing admin member. Owner-only
  // (can('transferOwnership')); the actor-vs-target identity decision lives
  // here, keeping can() a pure (action, role) function. The target must be a
  // current admin member with a verified email — the owner is the billing
  // payer, so proven mailbox control is required, mirroring the invite gate.
  // The role swap itself is transactional in the repository so the workspace is
  // never momentarily ownerless or two-owned.
  async transferOwnership(
    slug: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      actorUserId,
    );

    if (!this.can("transferOwnership", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    // Validate the target is an eligible recipient (a current admin member,
    // never the actor) before reading their email, so a non-member userId
    // resolves to WORKSPACE_TRANSFER_TARGET_INVALID rather than disclosing the
    // verified-email state of an arbitrary user through the EMAIL_NOT_VERIFIED
    // path. The repository transaction re-checks this against live state, so
    // this pre-check is for the error-shape, not the authorization.
    const targetMembership =
      await this.deps.workspaceRepository.findMembershipWithWorkspace(
        workspace.id,
        targetUserId,
      );

    if (
      actorUserId === targetUserId ||
      !targetMembership ||
      targetMembership.role !== "admin"
    ) {
      throw new ConflictError(ApiErrorCode.WORKSPACE_TRANSFER_TARGET_INVALID);
    }

    const targetUser = await this.deps.userRepository.findById(targetUserId);

    if (!targetUser?.verifiedEmail) {
      throw new ForbiddenError(ApiErrorCode.EMAIL_NOT_VERIFIED);
    }

    try {
      await this.deps.workspaceRepository.transferOwnership(
        workspace.id,
        actorUserId,
        targetUserId,
      );
    } catch (err) {
      if (err instanceof InvalidOwnershipTransferTargetError) {
        throw new ConflictError(
          ApiErrorCode.WORKSPACE_TRANSFER_TARGET_INVALID,
        );
      }

      throw err;
    }

    await this.notifyOwnershipTransferred(workspace, targetUser.verifiedEmail);
  }

  // Best-effort notification to the new owner. A send failure (or absent SMTP)
  // must never fail a transfer that has already committed, so this swallows and
  // logs. The billing-tail note appears only when the workspace has a live
  // subscription — it is still billed to the previous owner until the new owner
  // updates the payment method.
  private async notifyOwnershipTransferred(
    workspace: IWorkspace,
    newOwnerEmail: string,
  ): Promise<void> {
    if (!this.deps.smtpTransport) {
      return;
    }

    try {
      const settingsUrl = `${this.deps.config.BACKEND_API_LOGIN_REDIRECT_URI}/workspaces/${workspace.slug}/settings`;

      await this.deps.smtpTransport.sendMail({
        from: createFromFormatter(this.deps.config)("MonitoRSS", "noreply"),
        to: newOwnerEmail,
        subject: `You are now the owner of ${workspace.name} on MonitoRSS`,
        html: this.renderEmail(ownershipTransferredTemplate, {
          workspaceName: workspace.name,
          settingsUrl,
          hasSubscription: !!workspace.paddleCustomer?.subscription,
        }),
      });
    } catch (err) {
      logger.error(
        `Failed to notify the new owner of workspace ${workspace.id} after ownership transfer`,
        { stack: (err as Error).stack },
      );
    }
  }

  private async removeMembershipEnforcingOwnerCount(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      return await this.deps.workspaceRepository.removeMembership(
        workspaceId,
        userId,
      );
    } catch (err) {
      if (err instanceof CannotRemoveLastOwnerError) {
        throw new ConflictError(ApiErrorCode.CANNOT_REMOVE_LAST_OWNER);
      }

      throw err;
    }
  }

  async getRedditCredentials(
    workspaceId: string,
  ): Promise<IWorkspaceExternalCredential | null> {
    return this.deps.workspaceRepository.getExternalCredentials(
      workspaceId,
      UserExternalCredentialType.Reddit,
    );
  }

  async setRedditCredentials(input: {
    workspaceId: string;
    connectedByUserId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }): Promise<void> {
    const encryptionKey = this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX;

    if (!encryptionKey) {
      throw new Error("Encryption key not set while encrypting object values");
    }

    await this.deps.workspaceRepository.setExternalCredential(
      input.workspaceId,
      {
        type: UserExternalCredentialType.Reddit,
        data: {
          accessToken: encrypt(input.accessToken, encryptionKey),
          refreshToken: encrypt(input.refreshToken, encryptionKey),
        },
        expireAt: dayjs().add(input.expiresIn, "second").toDate(),
        connectedByUserId: input.connectedByUserId,
      },
    );

    await this.syncWorkspaceLookupKeys({ workspaceIds: [input.workspaceId] });
  }

  async revokeRedditCredentials(
    workspaceId: string,
    credentialId: string,
  ): Promise<void> {
    await this.deps.workspaceRepository.revokeExternalCredential(
      workspaceId,
      credentialId,
    );
  }

  // Member-initiated disconnect: revoke the grant at Reddit, drop the record,
  // and unset the workspace feeds' lookup keys so they stop fetching with the
  // dead token.
  async disconnectReddit(slug: string, userId: string): Promise<void> {
    const { workspace, role } = await this.getWorkspaceForMemberBySlug(
      slug,
      userId,
    );

    if (!this.can("manageIntegrations", role)) {
      throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
    }

    const credential = await this.getRedditCredentials(workspace.id);

    if (!credential) {
      return;
    }

    await this.revokeRedditGrantAtReddit(credential);

    await this.deps.workspaceRepository.removeExternalCredentials(
      workspace.id,
      UserExternalCredentialType.Reddit,
    );

    await this.syncWorkspaceLookupKeys({ workspaceIds: [workspace.id] });
  }

  // Workspace counterpart of UsersService.syncLookupKeys: reconciles
  // feedRequestLookupKey presence on workspace feeds against the workspace's
  // reddit credential state.
  async syncWorkspaceLookupKeys(data?: {
    workspaceIds?: string[];
    feedIds?: string[];
  }): Promise<void> {
    await reconcileFeedLookupKeys({
      feedsWithActiveCredentials:
        this.deps.workspaceRepository.aggregateWorkspacesWithActiveRedditCredentials(
          { workspaceIds: data?.workspaceIds, feedIds: data?.feedIds },
        ),
      feedsWithDeadCredentials:
        this.deps.workspaceRepository.aggregateWorkspaceFeedsWithExpiredOrRevokedRedditCredentials(
          { workspaceIds: data?.workspaceIds, feedIds: data?.feedIds },
        ),
      bulkUpdateLookupKeys: (ops) =>
        this.deps.userFeedRepository.bulkUpdateLookupKeys(ops),
    });
  }

  // Revoke-on-exit: when the member whose personal Reddit account backs the
  // workspace connection leaves (or is removed), the grant is revoked — nobody's
  // account keeps powering a workspace they're no longer part of. Remaining
  // members are notified so any of them can reconnect. Best-effort: a failure
  // here must not undo or fail the membership removal itself.
  private async handleRedditConnectionOnMemberExit(
    workspace: IWorkspace,
    exitedUserId: string,
  ): Promise<void> {
    try {
      const credential = await this.getRedditCredentials(workspace.id);

      if (
        !credential ||
        credential.connectedByUserId !== exitedUserId ||
        credential.status !== UserExternalCredentialStatus.Active
      ) {
        return;
      }

      await this.revokeRedditGrantAtReddit(credential);

      await this.deps.workspaceRepository.revokeExternalCredential(
        workspace.id,
        credential.id,
      );

      await this.syncWorkspaceLookupKeys({ workspaceIds: [workspace.id] });

      await this.notifyRedditConnectionLost(workspace);
    } catch (err) {
      logger.error(
        `Failed to handle reddit connection on member exit for workspace ${workspace.id}`,
        { stack: (err as Error).stack },
      );
    }
  }

  // Revocation at Reddit is best-effort: the authoritative state is our
  // credential record; an unreachable Reddit API must not block disconnection.
  private async revokeRedditGrantAtReddit(
    credential: IWorkspaceExternalCredential,
  ): Promise<void> {
    const encryptionKey = this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX;
    const encryptedRefreshToken = credential.data.refreshToken;

    if (!encryptionKey || !encryptedRefreshToken) {
      return;
    }

    try {
      await this.deps.redditApiService.revokeRefreshToken(
        decrypt(encryptedRefreshToken, encryptionKey),
      );
    } catch (err) {
      logger.warn("Failed to revoke workspace reddit refresh token at Reddit", {
        stack: (err as Error).stack,
      });
    }
  }

  // Connection-death notification fans out to every member — the person who
  // connected is often exactly the one who just left. Fired only on the
  // ACTIVE→dead transition (callers check status first), so it cannot repeat
  // per failed fetch.
  async notifyRedditConnectionLost(workspace: IWorkspace): Promise<void> {
    if (!this.deps.smtpTransport) {
      return;
    }

    try {
      const emails = await this.deps.workspaceRepository.listMemberEmails(
        workspace.id,
      );

      if (!emails.length) {
        return;
      }

      const settingsUrl = `${this.deps.config.BACKEND_API_LOGIN_REDIRECT_URI}/workspaces/${workspace.slug}/settings`;

      await Promise.all(
        emails.map((email) =>
          this.deps.smtpTransport!.sendMail({
            from: createFromFormatter(this.deps.config)(
              "MonitoRSS",
              "noreply",
            ),
            to: email,
            subject: `Reddit connection lost for ${workspace.name}`,
            html: this.renderEmail(redditConnectionLostTemplate, {
              workspaceName: workspace.name,
              settingsUrl,
            }),
          }),
        ),
      );
    } catch (err) {
      logger.error(
        `Failed to notify members of lost reddit connection for workspace ${workspace.id}`,
        { stack: (err as Error).stack },
      );
    }
  }
}
