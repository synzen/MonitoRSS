import type { FastifyInstance } from "fastify";
import { getMeHandler, updateMeHandler } from "./users.handlers";
import { requireAuthHook } from "../../infra/auth";
import { UpdateMeBodySchema } from "./users.schemas";

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/@me", { preHandler: [requireAuthHook], handler: getMeHandler });

  app.patch("/@me", {
    preHandler: [requireAuthHook],
    schema: { body: UpdateMeBodySchema },
    handler: updateMeHandler,
  });
}
