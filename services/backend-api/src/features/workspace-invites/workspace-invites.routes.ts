import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { requireAuthHook } from "../../infra/auth";
import { requireWorkspacesFeatureHook } from "../workspaces/workspaces.hooks";
import {
  acceptWorkspaceInviteHandler,
  declineWorkspaceInviteHandler,
  getWorkspaceInviteHandler,
  listMyWorkspaceInvitesHandler,
  sendInviteVerificationHandler,
} from "./workspace-invites.handlers";
import {
  SendInviteVerificationBodySchema,
  WorkspaceInviteIdParamsSchema,
} from "./workspace-invites.schemas";

// Invitee-side routes: addressed by invitation id (or the caller's verified
// email for the @me list), independent of any workspace the caller belongs to.
// All require auth + the workspaces feature flag (the flag hook also resolves
// request.userId).
export async function workspaceInvitesRoutes(
  app: FastifyInstance,
): Promise<void> {
  await app.register(rateLimit, { global: false });

  app.get("/@me", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    handler: listMyWorkspaceInvitesHandler,
  });

  app.get("/:inviteId", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceInviteIdParamsSchema },
    handler: getWorkspaceInviteHandler,
  });

  app.post("/:inviteId/accept", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceInviteIdParamsSchema },
    handler: acceptWorkspaceInviteHandler,
  });

  app.post("/:inviteId/decline", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { params: WorkspaceInviteIdParamsSchema },
    handler: declineWorkspaceInviteHandler,
  });

  app.post("/:inviteId/verification", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: {
      params: WorkspaceInviteIdParamsSchema,
      body: SendInviteVerificationBodySchema,
    },
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 hour",
      },
    },
    handler: sendInviteVerificationHandler,
  });
}
