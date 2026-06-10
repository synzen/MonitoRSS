import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import { requireWorkspacesFeatureHook } from "./workspaces.hooks";
import {
  createWorkspaceHandler,
  listWorkspacesHandler,
  getWorkspaceHandler,
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
  WorkspaceInviteParamsSchema,
  WorkspaceMemberParamsSchema,
  WorkspaceSlugParamsSchema,
} from "./workspaces.schemas";

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

  // One route covers both remove-other (:userId) and leave (@me); the handler
  // routes by identity.
  app.delete("/:workspaceSlug/members/:userId", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceMemberParamsSchema },
    handler: removeWorkspaceMemberHandler,
  });
}
