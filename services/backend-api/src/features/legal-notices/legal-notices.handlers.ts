import type { FastifyReply, FastifyRequest } from "fastify";
import { Environment } from "../../config";

export const PRODUCTION_DASHBOARD_HOSTNAME = "my.monitorss.xyz";

export async function getApplicableLegalNoticeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { config, userRepository } = request.container;
  const isProductionDashboard =
    config.NODE_ENV === Environment.Production &&
    request.hostname.toLowerCase() === PRODUCTION_DASHBOARD_HOSTNAME;
  const isLocalPreview =
    config.NODE_ENV === Environment.Local &&
    config.BACKEND_API_ENABLE_LEGAL_NOTICE_PREVIEW &&
    request.headers["x-monitorss-legal-notice-preview"] === "true";

  if (!isProductionDashboard && !isLocalPreview) {
    reply.code(404).send({ result: null });
    return;
  }

  const notice = config.BACKEND_API_LEGAL_NOTICE;
  if (!notice || notice.displayAt > new Date()) {
    reply.send({ result: null });
    return;
  }

  const user = await userRepository.findByDiscordId(request.discordUserId);

  if (!user || user.createdAt >= notice.effectiveAt) {
    reply.send({ result: null });
    return;
  }

  reply.send({
    result: {
      version: notice.version,
      summary: notice.summary,
      documents: notice.documents,
    },
  });
}
