import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import { getApplicableLegalNoticeHandler } from "./legal-notices.handlers";

export async function legalNoticesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/applicable", {
    preHandler: [requireAuthHook],
    handler: getApplicableLegalNoticeHandler,
  });
}
