import type { FastifyInstance } from "fastify";
import {
  getBotHandler,
  getMeHandler,
  getAuthStatusHandler,
  getUserByIdHandler,
} from "./discord-users.handlers";
import { requireAuthHook } from "../../infra/auth";

export async function discordUsersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/@me", { preHandler: [requireAuthHook], handler: getMeHandler });
  app.get("/@me/auth-status", getAuthStatusHandler);
  app.get("/bot", { preHandler: [requireAuthHook], handler: getBotHandler });
  app.get("/:id", {
    preHandler: [requireAuthHook],
    handler: getUserByIdHandler,
  });
}
