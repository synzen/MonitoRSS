import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import { requireWorkspacesFeatureHook } from "./workspaces.hooks";
import {
  createWorkspaceHandler,
  listWorkspacesHandler,
  getWorkspaceHandler,
  deleteWorkspaceHandler,
  updateWorkspaceHandler,
  createWorkspaceInviteHandler,
  listWorkspaceInvitesHandler,
  resendWorkspaceInviteHandler,
  revokeWorkspaceInviteHandler,
  listWorkspaceMembersHandler,
  removeWorkspaceMemberHandler,
  disconnectWorkspaceRedditHandler,
} from "./workspaces.handlers";
import {
  CreateWorkspaceBodySchema,
  CreateWorkspaceInviteBodySchema,
  UpdateWorkspaceBodySchema,
  WorkspaceBillingConvertBodySchema,
  WorkspaceBillingUpdateBodySchema,
  WorkspaceInviteParamsSchema,
  WorkspaceMemberParamsSchema,
  WorkspaceSlugParamsSchema,
} from "./workspaces.schemas";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import {
  previewWorkspaceBillingChangeHandler,
  updateWorkspaceBillingHandler,
  updateWorkspacePaymentMethodHandler,
  cancelWorkspaceBillingHandler,
  resumeWorkspaceBillingHandler,
  convertWorkspaceBillingHandler,
} from "./workspace-billing.handlers";
import { WORKSPACE_BILLING_EXCEPTION_ERROR_CODES } from "./workspace-billing.exception-codes";

export async function workspacesRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { body: CreateWorkspaceBodySchema },
    handler: createWorkspaceHandler,
  });

  app.get("/", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    handler: listWorkspacesHandler,
  });

  app.get("/:workspaceSlug", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: getWorkspaceHandler,
  });

  app.patch("/:workspaceSlug", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema, body: UpdateWorkspaceBodySchema },
    handler: updateWorkspaceHandler,
  });

  // Owner-only. Cancels any active Paddle subscription as part of deletion.
  app.delete("/:workspaceSlug", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: deleteWorkspaceHandler,
  });

  app.post("/:workspaceSlug/invites", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: {
      params: WorkspaceSlugParamsSchema,
      body: CreateWorkspaceInviteBodySchema,
    },
    handler: createWorkspaceInviteHandler,
  });

  app.get("/:workspaceSlug/invites", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: listWorkspaceInvitesHandler,
  });

  app.post("/:workspaceSlug/invites/:inviteId/resend", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceInviteParamsSchema },
    handler: resendWorkspaceInviteHandler,
  });

  app.delete("/:workspaceSlug/invites/:inviteId", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceInviteParamsSchema },
    handler: revokeWorkspaceInviteHandler,
  });

  app.get("/:workspaceSlug/members", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: listWorkspaceMembersHandler,
  });

  // Disconnect the workspace's Reddit connection (any member). Connecting goes
  // through the reddit-auth OAuth flow with ?workspaceId=.
  app.delete("/:workspaceSlug/reddit-connection", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: disconnectWorkspaceRedditHandler,
  });

  // Workspace billing management (owner-only; mirrors the personal
  // supporter-subscription surface, scoped to the workspace's own
  // subscription). Checkout itself is client-side Paddle overlay with
  // custom data carrying the workspace id.
  app.post("/:workspaceSlug/billing/update-preview", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: {
      params: WorkspaceSlugParamsSchema,
      body: WorkspaceBillingUpdateBodySchema,
    },
    handler: withExceptionFilter(
      WORKSPACE_BILLING_EXCEPTION_ERROR_CODES,
      previewWorkspaceBillingChangeHandler,
    ),
  });

  app.post("/:workspaceSlug/billing/update", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: {
      params: WorkspaceSlugParamsSchema,
      body: WorkspaceBillingUpdateBodySchema,
    },
    handler: withExceptionFilter(
      WORKSPACE_BILLING_EXCEPTION_ERROR_CODES,
      updateWorkspaceBillingHandler,
    ),
  });

  // Fetches a Paddle update-payment-method transaction for the workspace's own
  // subscription; the client opens the Paddle overlay with it. POST despite
  // being read-like because it mints a transaction on Paddle's side and to
  // match the family convention.
  app.post("/:workspaceSlug/billing/update-payment-method", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: withExceptionFilter(
      WORKSPACE_BILLING_EXCEPTION_ERROR_CODES,
      updateWorkspacePaymentMethodHandler,
    ),
  });

  app.post("/:workspaceSlug/billing/cancel", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: withExceptionFilter(
      WORKSPACE_BILLING_EXCEPTION_ERROR_CODES,
      cancelWorkspaceBillingHandler,
    ),
  });

  app.post("/:workspaceSlug/billing/resume", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceSlugParamsSchema },
    handler: withExceptionFilter(
      WORKSPACE_BILLING_EXCEPTION_ERROR_CODES,
      resumeWorkspaceBillingHandler,
    ),
  });

  // Converts the owner's personal subscription into this workspace, bringing
  // the selected personal feeds along.
  app.post("/:workspaceSlug/billing/convert", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: {
      params: WorkspaceSlugParamsSchema,
      body: WorkspaceBillingConvertBodySchema,
    },
    handler: withExceptionFilter(
      WORKSPACE_BILLING_EXCEPTION_ERROR_CODES,
      convertWorkspaceBillingHandler,
    ),
  });

  // One route covers both remove-other (:userId) and leave (@me); the handler
  // routes by identity.
  app.delete("/:workspaceSlug/members/:userId", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceMemberParamsSchema },
    handler: removeWorkspaceMemberHandler,
  });
}
