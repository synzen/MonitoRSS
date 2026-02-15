import type { FastifyInstance } from "fastify";
import {
  loginHandler,
  removeHandler,
  callbackHandler,
} from "./reddit-auth.handlers";
import { requireAuthHook } from "../../infra/auth";

export async function redditAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/login", loginHandler);
  app.get("/remove", { preHandler: [requireAuthHook], handler: removeHandler });
  app.get("/callback", {
    preHandler: [requireAuthHook],
    handler: callbackHandler,
  });
}
