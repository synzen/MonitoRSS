import type { FastifyRequest, FastifyReply } from "fastify";
import type { IWorkspaceInviteWithContext } from "../../repositories/mongoose/workspace.mongoose.repository";
import { redactEmail } from "../../shared/utils/redactEmail";
import type {
  SendInviteVerificationBody,
  WorkspaceInviteIdParams,
} from "./workspace-invites.schemas";

// The @me list is keyed on the caller's own verifiedEmail, so the full address
// is the caller's own — no leak.
function toMyInviteResponse(invite: IWorkspaceInviteWithContext) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    workspaceName: invite.workspaceName,
    invitedByUserId: invite.invitedByUserId,
    createdAt: invite.createdAt,
  };
}

// The single-invite GET is reachable by any feature-flagged user who knows the
// invitation id. The full invited address is disclosed only to a caller who has
// already proven ownership of it (emailMatches); to everyone else it is redacted
// to a recognizable hint, so a prober cannot harvest the address (PII / IDOR).
function toInviteContextResponse(
  invite: IWorkspaceInviteWithContext,
  emailMatches: boolean,
  alreadyMember: boolean,
) {
  return {
    id: invite.id,
    emailHint: redactEmail(invite.email),
    ...(emailMatches ? { email: invite.email } : {}),
    role: invite.role,
    workspaceName: invite.workspaceName,
    invitedByUserId: invite.invitedByUserId,
    createdAt: invite.createdAt,
    // Lets the landing page show "you're already a member" instead of pushing an
    // existing member through email verification only to fail the accept guard.
    alreadyMember,
  };
}

export async function listMyWorkspaceInvitesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const invites = await workspacesService.listMyInvites(
    request.userId as string,
  );

  return reply.send({ result: invites.map(toMyInviteResponse) });
}

export async function getWorkspaceInviteHandler(
  request: FastifyRequest<{ Params: WorkspaceInviteIdParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const { invite, emailMatches, alreadyMember } =
    await workspacesService.getInvite(
      request.params.inviteId,
      request.userId as string,
    );

  return reply.send({
    result: toInviteContextResponse(invite, emailMatches, alreadyMember),
  });
}

export async function acceptWorkspaceInviteHandler(
  request: FastifyRequest<{ Params: WorkspaceInviteIdParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const { workspaceSlug } = await workspacesService.acceptInvite(
    request.params.inviteId,
    request.userId as string,
  );

  // Return the joined workspace's slug so the client can drop the invitee
  // straight into the workspace they just joined.
  return reply.send({ result: { workspaceSlug } });
}

// Invite-scoped email-verification send. Dispatches a code only when the
// submitted address matches the invited address; otherwise (or for an unknown
// invite) it no-ops. The response is identical in every case so a prober cannot
// distinguish a match from a miss (no address-harvesting oracle).
export async function sendInviteVerificationHandler(
  request: FastifyRequest<{
    Params: WorkspaceInviteIdParams;
    Body: SendInviteVerificationBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  await workspacesService.sendInviteVerification(
    request.params.inviteId,
    request.userId as string,
    request.body.email,
  );

  return reply.send({ result: { ok: true } });
}

export async function declineWorkspaceInviteHandler(
  request: FastifyRequest<{ Params: WorkspaceInviteIdParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  await workspacesService.declineInvite(
    request.params.inviteId,
    request.userId as string,
  );

  return reply.status(204).send();
}
