import type { FastifyRequest, FastifyReply } from "fastify";
import { ApiErrorCode, ForbiddenError } from "../../infra/error-handler";
import type { IWorkspace } from "../../repositories/mongoose/workspace.mongoose.repository";
import type { WorkspaceSlugParams } from "./workspaces.schemas";
import type {
  WorkspaceBillingConvertBody,
  WorkspaceBillingUpdateBody,
} from "./workspaces.schemas";

// Owner-only resolution shared by every mutating billing endpoint. Non-members
// fall out of the member lookup as 404 (no workspace-existence leak); admins
// can read subscription status off the workspace itself but never mutate
// billing the owner pays for.
async function resolveWorkspaceForBilling(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
): Promise<IWorkspace> {
  const { workspacesService } = request.container;

  const { workspace, role } =
    await workspacesService.getWorkspaceForMemberBySlug(
      request.params.workspaceSlug,
      request.userId as string,
    );

  if (!workspacesService.can("manageBilling", role)) {
    throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
  }

  return workspace;
}

export async function previewWorkspaceBillingChangeHandler(
  request: FastifyRequest<{
    Params: WorkspaceSlugParams;
    Body: WorkspaceBillingUpdateBody;
  }>,
): Promise<{ data: unknown }> {
  const workspace = await resolveWorkspaceForBilling(request);
  const { workspaceBillingService } = request.container;

  const preview = await workspaceBillingService.previewChange(
    workspace,
    request.body.prices,
  );

  return { data: preview };
}

export async function updateWorkspaceBillingHandler(
  request: FastifyRequest<{
    Params: WorkspaceSlugParams;
    Body: WorkspaceBillingUpdateBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const workspace = await resolveWorkspaceForBilling(request);
  const { workspaceBillingService } = request.container;

  await workspaceBillingService.changeSubscription(
    workspace,
    request.body.prices,
  );

  return reply.status(204).send();
}

export async function updateWorkspacePaymentMethodHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
): Promise<{ data: { paddleTransactionId: string } }> {
  const workspace = await resolveWorkspaceForBilling(request);
  const { workspaceBillingService } = request.container;

  const { id } =
    await workspaceBillingService.getUpdatePaymentMethodTransaction(workspace);

  return { data: { paddleTransactionId: id } };
}

export async function cancelWorkspaceBillingHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
  reply: FastifyReply,
): Promise<void> {
  const workspace = await resolveWorkspaceForBilling(request);
  const { workspaceBillingService } = request.container;

  await workspaceBillingService.cancelSubscription(workspace);

  return reply.status(204).send();
}

export async function resumeWorkspaceBillingHandler(
  request: FastifyRequest<{ Params: WorkspaceSlugParams }>,
  reply: FastifyReply,
): Promise<void> {
  const workspace = await resolveWorkspaceForBilling(request);
  const { workspaceBillingService } = request.container;

  await workspaceBillingService.resumeSubscription(workspace);

  return reply.status(204).send();
}

export async function convertWorkspaceBillingHandler(
  request: FastifyRequest<{
    Params: WorkspaceSlugParams;
    Body: WorkspaceBillingConvertBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const workspace = await resolveWorkspaceForBilling(request);
  const { workspaceBillingService, userRepository } = request.container;

  const caller = await userRepository.findById(request.userId as string);

  if (!caller?.discordUserId) {
    throw new ForbiddenError(ApiErrorCode.WORKSPACE_INSUFFICIENT_ROLE);
  }

  await workspaceBillingService.convertPersonalSubscriptionToWorkspace(
    workspace,
    caller.discordUserId,
    request.body.feedIds,
  );

  return reply.status(204).send();
}
