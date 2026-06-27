import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { requireAuthHook } from "../../infra/auth";
import { requireWorkspacesFeatureHook } from "../workspaces/workspaces.hooks";
import {
  sendEmailVerificationHandler,
  confirmEmailVerificationHandler,
  revertEmailVerificationHandler,
} from "./email-verification.handlers";
import {
  SendEmailVerificationBodySchema,
  ConfirmEmailVerificationBodySchema,
  RevertEmailVerificationBodySchema,
} from "./email-verification.schemas";

export async function emailVerificationRoutes(
  app: FastifyInstance,
): Promise<void> {
  await app.register(rateLimit, { global: false });

  app.post("/@me/email-verification", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { body: SendEmailVerificationBodySchema },
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 hour",
      },
    },
    handler: sendEmailVerificationHandler,
  });

  app.post("/@me/email-verification/confirm", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { body: ConfirmEmailVerificationBodySchema },
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 hour",
      },
    },
    handler: confirmEmailVerificationHandler,
  });

  // Unauthenticated: clicked from the change-notice email, authorized solely by
  // the signed token in the body. Rate-limited per IP to bound token guessing.
  app.post("/@me/email-verification/revert", {
    schema: { body: RevertEmailVerificationBodySchema },
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 hour",
      },
    },
    handler: revertEmailVerificationHandler,
  });
}
