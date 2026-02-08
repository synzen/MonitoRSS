import type { FastifyRequest, FastifyReply } from "fastify";
import logger from "../../infra/logger";

export async function createErrorReportHandler(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
): Promise<void> {
  logger.error("Error report", {
    body: request.body,
  });

  return reply.send({ ok: 1 });
}
