import type { FastifyRequest, FastifyReply } from "fastify";
import {
  ApiErrorCode,
  ConflictError,
  ForbiddenError,
} from "../../infra/error-handler";
import type { IWorkspaceInvite } from "../../repositories/mongoose/workspace.mongoose.repository";
import { isAdminUser } from "../../shared/utils/admin";
import type {
  CreateWorkspaceBody,
  CreateWorkspaceInviteBody,
  UpdateWorkspaceBody,
  WorkspaceInviteParams,
  WorkspaceMemberParams,
  WorkspaceSlugParams,
} from "./workspaces.schemas";

// Whether the request's user is a site admin (an id in
// BACKEND_API_ADMIN_USER_IDS, matched against either the internal user id or the
// Discord id; see isAdminUser). Site admins are read-only observers of any
// workspace.
function isSiteAdmin(request: FastifyRequest): boolean {
  return isAdminUser(request.container.config, {
    id: request.userId as string,
    discordUserId: request.discordUserId,
  });
}

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
  const { workspacesService, supportersService, userRepository } =
    request.container;

  const isAdmin = isSiteAdmin(request);
  const { workspace, role } = await workspacesService.getWorkspaceForViewer(
    request.params.workspaceSlug,
    request.userId as string,
    { asAdmin: isAdmin },
  );

  const viewer = await userRepository.findById(request.userId as string);
  const conversion = viewer?.discordUserId
    ? await workspacesService.getConversionEligibility(
        workspace,
        role,
        viewer.discordUserId,
      )
    : null;

  // The workspace's feed limit (hardcoded today; workspace Paddle subscription
  // later). Surfaced so the client can render the workspace's feed-limit bar.
  const { maxFeeds } = await supportersService.getWorkspaceBenefits(
    workspace.id,
  );

  // The workspace's Reddit connection state with named attribution ("Connected
  // by X"), so members always see whose personal grant backs the workspace.
  const redditCredential = await workspacesService.getRedditCredentials(
    workspace.id,
  );
  let redditConnection = null;

  if (redditCredential) {
    const connectedByUser = await userRepository.findById(
      redditCredential.connectedByUserId,
    );

    redditConnection = {
      status: redditCredential.status,
      connectedBy: {
        userId: redditCredential.connectedByUserId,
        discordUserId: connectedByUser?.discordUserId ?? null,
      },
    };
  }

  // The workspace's own Paddle subscription state, so members can observe
  // whether the workspace is subscribed and on which tier. Billing-cycle
  // fields feed the owner/admin Billing page.
  const paddleSubscription = workspace.paddleCustomer?.subscription;
  const subscription = paddleSubscription
    ? {
        productKey: paddleSubscription.productKey,
        status: paddleSubscription.status,
        cancellationDate: paddleSubscription.cancellationDate ?? null,
        nextBillDate: paddleSubscription.nextBillDate ?? null,
        billingInterval: paddleSubscription.billingInterval,
        billingPeriodEnd: paddleSubscription.billingPeriodEnd,
        currencyCode: paddleSubscription.currencyCode,
        addons: (paddleSubscription.addons ?? []).map((a) => ({
          key: a.key,
          quantity: a.quantity,
        })),
        // The billing email is the owner's personal verified address, so only
        // the owner sees it; a workspace admin manages the workspace but is not
        // the billing party. A site admin (read-only observer) sees it too, so
        // they can troubleshoot billing on any workspace.
        ...((role === "owner" || isAdmin) && workspace.paddleCustomer?.email
          ? { billingEmail: workspace.paddleCustomer.email }
          : {}),
      }
    : null;

  return reply.send({
    result: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
      maxFeeds,
      redditConnection,
      subscription,
      conversion,
    },
  });
}

export async function disconnectWorkspaceRedditHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;

  await workspacesService.disconnectReddit(
    request.params.workspaceSlug,
    request.userId as string,
  );

  return reply.status(200).send({ result: { ok: true } });
}

export async function deleteWorkspaceHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
  reply: FastifyReply,
): Promise<void> {
  const {
    workspacesService,
    workspaceBillingService,
    userFeedsService,
    userFeedRepository,
    workspaceRepository,
  } = request.container;

  const { workspace, role } =
    await workspacesService.getWorkspaceForMemberBySlug(
      request.params.workspaceSlug,
      request.userId as string,
    );

  if (!workspacesService.can("deleteWorkspace", role)) {
    throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
  }

  // A workspace with a live subscription cannot be deleted; the owner must
  // cancel billing first. Deleting it here would silently destroy the only
  // place that surfaces the subscription, leaving them paying for nothing.
  if (workspaceBillingService.hasBlockingSubscription(workspace)) {
    throw new ConflictError(ApiErrorCode.WORKSPACE_HAS_ACTIVE_SUBSCRIPTION);
  }

  // Feeds go through the service so connection cleanup and queue events run.
  const feedIds = await userFeedRepository.findIdsByWorkspace(workspace.id);

  if (feedIds.length > 0) {
    await userFeedsService.bulkDelete(feedIds);
  }

  await workspaceRepository.deleteWorkspaceCascade(workspace.id);

  // A feed creation that passed its membership check before the cascade can
  // insert between the snapshot above and the cascade. Now that the workspace
  // is gone no further creations can pass the member check, so one more sweep
  // ends the race (creations landing even later clean up after themselves).
  const stragglerIds = await userFeedRepository.findIdsByWorkspace(
    workspace.id,
  );

  if (stragglerIds.length > 0) {
    await userFeedsService.bulkDelete(stragglerIds);
  }

  return reply.status(204).send();
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
  const invites = await workspacesService.listInvitesForViewer(
    request.params.workspaceSlug,
    request.userId as string,
    { asAdmin: isSiteAdmin(request) },
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
  const members = await workspacesService.listMembersForViewer(
    request.params.workspaceSlug,
    request.userId as string,
    { asAdmin: isSiteAdmin(request) },
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

export async function transferWorkspaceOwnershipHandler(
  request: FastifyRequest<{ Params: WorkspaceMemberParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspacesService } = request.container;

  await workspacesService.transferOwnership(
    request.params.workspaceSlug,
    request.userId as string,
    request.params.userId,
  );

  return reply.status(200).send({ result: { ok: true } });
}
