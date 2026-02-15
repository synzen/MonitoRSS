import type { FastifyInstance } from "fastify";
import { createErrorReportHandler } from "./error-reports.handlers";
import { requireAuthHook } from "../../infra/auth";

export async function errorReportsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", {
    preHandler: [requireAuthHook],
    handler: createErrorReportHandler,
  });
}
