import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { requireAuthHook } from "../../infra/auth";
import { requireWorkspacesFeatureHook } from "../workspaces/workspaces.hooks";
import {
  sendEmailVerificationHandler,
  confirmEmailVerificationHandler,
} from "./email-verification.handlers";
import {
  SendEmailVerificationBodySchema,
  ConfirmEmailVerificationBodySchema,
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
}
