import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { requireAuthHook } from "../../infra/auth";
import {
  sendAccountDeletionCodeHandler,
  deleteAccountHandler,
} from "./account.handlers";
import { DeleteAccountBodySchema } from "./account.schemas";

// Account lifecycle routes. Deletion is a right for every authenticated user,
// so these are gated by auth alone (no feature flag). requireAuthHook resolves
// request.discordUserId; the handlers resolve the internal user id from it.
export async function accountRoutes(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, { global: false });

  app.post("/@me/deletion-verification", {
    preHandler: [requireAuthHook],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 hour",
      },
    },
    handler: sendAccountDeletionCodeHandler,
  });

  app.delete("/@me", {
    preHandler: [requireAuthHook],
    schema: { body: DeleteAccountBodySchema },
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 hour",
      },
    },
    handler: deleteAccountHandler,
  });
}
