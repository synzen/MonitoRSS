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

  // These two routes are authenticated, so the cap belongs per-account, not
  // per-IP: the default IP key collapses everyone behind one address (a shared
  // proxy, or the E2E fleet on one runner) into a single bucket, throttling
  // unrelated users. Key by the authenticated user instead. This requires the
  // limiter to run at preHandler, after requireAuthHook has set discordUserId
  // (the default onRequest hook runs before auth). Per-user flooding is still
  // bounded by the service's own resend cooldown and distinct-target cap.
  app.post("/@me/email-verification", {
    preHandler: [requireAuthHook, requireWorkspacesFeatureHook],
    schema: { body: SendEmailVerificationBodySchema },
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 hour",
        hook: "preHandler",
        keyGenerator: (request) => request.discordUserId ?? request.ip,
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
        hook: "preHandler",
        keyGenerator: (request) => request.discordUserId ?? request.ip,
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
