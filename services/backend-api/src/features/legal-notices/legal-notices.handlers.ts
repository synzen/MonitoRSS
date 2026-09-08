import type { FastifyReply, FastifyRequest } from "fastify";
import { Environment } from "../../config";
import type {
  CreateLegalNoticeAcknowledgementBody,
  LegalNotice,
} from "./legal-notices.schemas";

export const PRODUCTION_DASHBOARD_HOSTNAME = "my.monitorss.xyz";

function getActiveLegalNotice(request: FastifyRequest): LegalNotice | null {
  const { config } = request.container;
  const isProductionDashboard =
    config.NODE_ENV === Environment.Production &&
    request.hostname.toLowerCase() === PRODUCTION_DASHBOARD_HOSTNAME;

  if (
    (config.NODE_ENV === Environment.Local &&
      !config.BACKEND_API_ENABLE_LEGAL_NOTICE_PREVIEW) ||
    (config.NODE_ENV !== Environment.Local && !isProductionDashboard)
  ) {
    return null;
  }

  const notice = config.BACKEND_API_LEGAL_NOTICE;

  if (!notice || notice.displayAt > new Date()) {
    return null;
  }

  return notice;
}

export async function getApplicableLegalNoticeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository } = request.container;
  const notice = getActiveLegalNotice(request);

  if (!notice) {
    reply.send({ result: null });
    return;
  }

  const user = await userRepository.findByDiscordId(request.discordUserId);

  if (
    !user ||
    user.createdAt >= notice.effectiveAt ||
    user.preferences?.legalNoticeAcknowledgement?.version === notice.version
  ) {
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

export async function createLegalNoticeAcknowledgementHandler(
  request: FastifyRequest<{ Body: CreateLegalNoticeAcknowledgementBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository } = request.container;
  const notice = getActiveLegalNotice(request);

  if (!notice || notice.version !== request.body.version) {
    reply.code(204).send();
    return;
  }

  const user = await userRepository.findByDiscordId(request.discordUserId);

  if (
    !user ||
    user.createdAt >= notice.effectiveAt ||
    user.preferences?.legalNoticeAcknowledgement?.version === notice.version
  ) {
    reply.code(204).send();
    return;
  }

  await userRepository.updatePreferencesByDiscordId(request.discordUserId, {
    legalNoticeAcknowledgement: {
      version: notice.version,
      acknowledgedAt: new Date(),
    },
  });

  reply.code(204).send();
}
