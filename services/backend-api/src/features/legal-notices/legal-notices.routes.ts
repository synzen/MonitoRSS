import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import {
  createLegalNoticeDismissalHandler,
  getApplicableLegalNoticeHandler,
} from "./legal-notices.handlers";
import { CreateLegalNoticeDismissalBodySchema } from "./legal-notices.schemas";

export async function legalNoticesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/applicable", {
    preHandler: [requireAuthHook],
    handler: getApplicableLegalNoticeHandler,
  });

  app.post("/dismissals", {
    preHandler: [requireAuthHook],
    schema: { body: CreateLegalNoticeDismissalBodySchema },
    handler: createLegalNoticeDismissalHandler,
  });
}
