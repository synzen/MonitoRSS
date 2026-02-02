import type { FastifyInstance } from "fastify";
import {
  getBotHandler,
  getMeHandler,
  getAuthStatusHandler,
  getUserByIdHandler,
} from "./discord-users.handlers";

export async function discordUsersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/@me", getMeHandler);
  app.get("/@me/auth-status", getAuthStatusHandler);
  app.get("/bot", getBotHandler);
  app.get("/:id", getUserByIdHandler);
}
