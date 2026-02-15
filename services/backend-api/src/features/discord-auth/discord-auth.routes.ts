import type { FastifyInstance } from "fastify";
import {
  callbackHandler,
  callbackV2Handler,
  loginHandler,
  loginV2Handler,
  logoutHandler,
} from "./discord-auth.handlers";

export async function discordAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/login", loginHandler);
  app.get("/login-v2", loginV2Handler);
  app.get("/callback", callbackHandler);
  app.get("/callback-v2", callbackV2Handler);
  app.get("/logout", logoutHandler);
}
