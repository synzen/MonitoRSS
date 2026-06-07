import type { FastifyRequest, FastifyReply } from "fastify";
import { ApiErrorCode, ForbiddenError } from "../../infra/error-handler";
import type { IWorkspaceInvite } from "../../repositories/mongoose/workspace.mongoose.repository";
import type {
  CreateWorkspaceBody,
  CreateWorkspaceInviteBody,
  UpdateWorkspaceBody,
  WorkspaceInviteParams,
  WorkspaceMemberParams,
  WorkspaceSlugParams,
} from "./workspaces.schemas";

function toInviteResponse(invite: IWorkspaceInvite) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    invitedByUserId: invite.invitedByUserId,
    createdAt: invite.createdAt,
  };
}

export async function createWorkspaceHandler(
  request: FastifyRequest<{ Body: CreateWorkspaceBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const workspace = await workspacesService.createWorkspace(
    request.userId as string,
    request.body.name,
    request.body.slug,
  );

  return reply.status(201).send({ result: workspace });
}

export async function listWorkspacesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const workspaces = await workspacesService.listWorkspaces(
    request.userId as string,
  );

  return reply.send({ result: workspaces });
}

export async function getWorkspaceHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService, supportersService } = request.container;
  const { workspace, role } =
    await workspacesService.getWorkspaceForMemberBySlug(
      request.params.workspaceSlug,
      request.userId as string,
    );

  // The workspace's feed limit (hardcoded today; workspace Paddle subscription
  // later). Surfaced so the client can render the workspace's feed-limit bar.
  const { maxFeeds } = await supportersService.getWorkspaceBenefits(
    workspace.id,
  );

  return reply.send({
    result: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
      maxFeeds,
    },
  });
}

export async function updateWorkspaceHandler(
  request: FastifyRequest<{
    Params: WorkspaceSlugParams;
    Body: UpdateWorkspaceBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const { workspace, role } =
    await workspacesService.getWorkspaceForMemberBySlug(
      request.params.workspaceSlug,
      request.userId as string,
    );

  if (!workspacesService.can("changeSettings", role)) {
    throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
  }

  let updated = workspace;

  if (request.body.name && request.body.name !== workspace.name) {
    updated = await workspacesService.updateWorkspaceName(
      workspace.id,
      request.userId as string,
      request.body.name,
    );
  }

  if (request.body.slug && request.body.slug !== workspace.slug) {
    updated = await workspacesService.updateWorkspaceSlug(
      workspace.id,
      request.userId as string,
      request.body.slug,
    );
  }

  return reply.send({ result: updated });
}

export async function createWorkspaceInviteHandler(
  request: FastifyRequest<{
    Params: WorkspaceSlugParams;
    Body: CreateWorkspaceInviteBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const invite = await workspacesService.createInvite(
    request.params.workspaceSlug,
    request.userId as string,
    request.body.email,
  );

  return reply.status(201).send({ result: toInviteResponse(invite) });
}

export async function listWorkspaceInvitesHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const invites = await workspacesService.listInvites(
    request.params.workspaceSlug,
    request.userId as string,
  );

  return reply.send({ result: invites.map(toInviteResponse) });
}

export async function resendWorkspaceInviteHandler(
  request: FastifyRequest<{ Params: WorkspaceInviteParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  await workspacesService.resendInvite(
    request.params.workspaceSlug,
    request.userId as string,
    request.params.inviteId,
  );

  return reply.status(200).send({ result: { ok: true } });
}

export async function revokeWorkspaceInviteHandler(
  request: FastifyRequest<{ Params: WorkspaceInviteParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  await workspacesService.revokeInvite(
    request.params.workspaceSlug,
    request.userId as string,
    request.params.inviteId,
  );

  return reply.status(200).send({ result: { ok: true } });
}

export async function listWorkspaceMembersHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const members = await workspacesService.listMembers(
    request.params.workspaceSlug,
    request.userId as string,
  );

  return reply.send({ result: members });
}

export async function removeWorkspaceMemberHandler(
  request: FastifyRequest<{ Params: WorkspaceMemberParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;
  const actorUserId = request.userId as string;

  // "@me" is the leave path; otherwise the target is another member. The
  // service routes by identity (actor === target) keeping can() pure.
  const targetUserId =
    request.params.userId === "@me" ? actorUserId : request.params.userId;

  await workspacesService.removeMember(
    request.params.workspaceSlug,
    actorUserId,
    targetUserId,
  );

  return reply.status(200).send({ result: { ok: true } });
}
