import type { FastifyInstance } from "fastify";
import {
  getMyPendingInvitesHandler,
  getPendingInviteCountHandler,
  createInviteHandler,
  resendInviteHandler,
  updateInviteHandler,
  updateInviteStatusHandler,
  deleteInviteHandler,
} from "./user-feed-management-invites.handlers";
import { requireAuthHook } from "../../infra/auth";
import {
  CreateInviteBodySchema,
  UpdateInviteBodySchema,
  UpdateInviteStatusBodySchema,
  InviteIdParamsSchema,
} from "./user-feed-management-invites.schemas";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import {
  CREATE_INVITE_EXCEPTION_ERROR_CODES,
  UPDATE_INVITE_EXCEPTION_ERROR_CODES,
  UPDATE_INVITE_STATUS_EXCEPTION_ERROR_CODES,
  RESEND_INVITE_EXCEPTION_ERROR_CODES,
  DELETE_INVITE_EXCEPTION_ERROR_CODES,
} from "./user-feed-management-invites.exception-codes";

export async function userFeedManagementInvitesRoutes(
  app: FastifyInstance,
): Promise<void> {
  // GET / - Get pending invites for current user
  app.get("/", {
    preHandler: [requireAuthHook],
    handler: getMyPendingInvitesHandler,
  });

  // GET /pending - Get pending invite count (MUST come before /:id routes)
  app.get("/pending", {
    preHandler: [requireAuthHook],
    handler: getPendingInviteCountHandler,
  });

  // POST / - Create invite
  app.post("/", {
    preHandler: [requireAuthHook],
    schema: {
      body: CreateInviteBodySchema,
    },
    handler: withExceptionFilter(
      CREATE_INVITE_EXCEPTION_ERROR_CODES,
      createInviteHandler,
    ),
  });

  // POST /:id/resend - Resend invite (owner only)
  app.post("/:id/resend", {
    preHandler: [requireAuthHook],
    schema: {
      params: InviteIdParamsSchema,
    },
    handler: withExceptionFilter(
      RESEND_INVITE_EXCEPTION_ERROR_CODES,
      resendInviteHandler,
    ),
  });

  // PATCH /:id - Update invite connections (owner only)
  app.patch("/:id", {
    preHandler: [requireAuthHook],
    schema: {
      params: InviteIdParamsSchema,
      body: UpdateInviteBodySchema,
    },
    handler: withExceptionFilter(
      UPDATE_INVITE_EXCEPTION_ERROR_CODES,
      updateInviteHandler,
    ),
  });

  // PATCH /:id/status - Update invite status (invitee only)
  app.patch("/:id/status", {
    preHandler: [requireAuthHook],
    schema: {
      params: InviteIdParamsSchema,
      body: UpdateInviteStatusBodySchema,
    },
    handler: withExceptionFilter(
      UPDATE_INVITE_STATUS_EXCEPTION_ERROR_CODES,
      updateInviteStatusHandler,
    ),
  });

  // DELETE /:id - Delete invite (owner only)
  app.delete("/:id", {
    preHandler: [requireAuthHook],
    schema: {
      params: InviteIdParamsSchema,
    },
    handler: withExceptionFilter(
      DELETE_INVITE_EXCEPTION_ERROR_CODES,
      deleteInviteHandler,
    ),
  });
}
