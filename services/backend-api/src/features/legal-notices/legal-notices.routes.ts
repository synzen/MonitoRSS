import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import {
  createLegalNoticeAcknowledgementHandler,
  getApplicableLegalNoticeHandler,
} from "./legal-notices.handlers";
import { CreateLegalNoticeAcknowledgementBodySchema } from "./legal-notices.schemas";

export async function legalNoticesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/applicable", {
    preHandler: [requireAuthHook],
    handler: getApplicableLegalNoticeHandler,
  });

  app.post("/acknowledgements", {
    preHandler: [requireAuthHook],
    schema: { body: CreateLegalNoticeAcknowledgementBodySchema },
    handler: createLegalNoticeAcknowledgementHandler,
  });
}
