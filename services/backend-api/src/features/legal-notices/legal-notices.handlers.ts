import type { FastifyReply, FastifyRequest } from "fastify";
import { Environment } from "../../config";
import type { IUser } from "../../repositories/interfaces/user.types";
import type {
  CreateLegalNoticeDismissalBody,
  LegalNotice,
  LegalNotices,
} from "./legal-notices.schemas";

export const PRODUCTION_DASHBOARD_HOSTNAME = "my.monitorss.xyz";

type LegalNoticePhase = "upcoming" | "updated";

interface ApplicableLegalNoticeResponse {
  result: {
    version: string;
    phase: LegalNoticePhase;
    summary: string;
    documents: LegalNotice["documents"];
  } | null;
  serverTime: string;
  nextTransitionAt: string | null;
}

function getApplicableConfiguredNotice(
  notices: LegalNotices | undefined,
  now: Date,
): LegalNotice | null {
  if (!notices) {
    return null;
  }

  return (
    notices
      .filter((notice) => notice.displayAt <= now)
      .sort((left, right) => right.displayAt.getTime() - left.displayAt.getTime())[0] ??
    null
  );
}

function getNextTransitionAt(
  notices: LegalNotices | undefined,
  notice: LegalNotice | null,
  now: Date,
): Date | null {
  const nextDisplayAt = notices
    ?.filter((candidate) => candidate.displayAt > now)
    .sort((left, right) => left.displayAt.getTime() - right.displayAt.getTime())[0]
    ?.displayAt;
  const effectiveAt = notice && notice.effectiveAt > now ? notice.effectiveAt : null;

  if (!nextDisplayAt) {
    return effectiveAt;
  }

  return !effectiveAt || nextDisplayAt < effectiveAt ? nextDisplayAt : effectiveAt;
}

function isNoticeHiddenForUser(
  user: Pick<IUser, "createdAt" | "preferences"> | null,
  notice: LegalNotice,
): boolean {
  return (
    !user ||
    user.createdAt >= notice.effectiveAt ||
    user.preferences?.legalNoticeDismissal?.version === notice.version
  );
}
function canExposeLegalNotices(request: FastifyRequest): boolean {
  const { config } = request.container;
  const isProductionDashboard =
    config.NODE_ENV === Environment.Production &&
    request.hostname.toLowerCase() === PRODUCTION_DASHBOARD_HOSTNAME;

  return config.NODE_ENV === Environment.Local || isProductionDashboard;
}

function getActiveLegalNotice(request: FastifyRequest, now: Date): LegalNotice | null {
  if (!canExposeLegalNotices(request)) {
    return null;
  }

  return getApplicableConfiguredNotice(request.container.config.BACKEND_API_LEGAL_NOTICE, now);
}

export async function getApplicableLegalNoticeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository } = request.container;
  const now = new Date();
  const notice = getActiveLegalNotice(request, now);
  const nextTransitionAt = canExposeLegalNotices(request)
    ? getNextTransitionAt(request.container.config.BACKEND_API_LEGAL_NOTICE, notice, now)
    : null;
  const response: ApplicableLegalNoticeResponse = {
    result: null,
    serverTime: now.toISOString(),
    nextTransitionAt: nextTransitionAt?.toISOString() ?? null,
  };

  if (!notice) {
    reply.send(response);
    return;
  }

  const user = await userRepository.findByDiscordId(request.discordUserId);

  if (isNoticeHiddenForUser(user, notice)) {
    reply.send(response);
    return;
  }

  response.result = {
    version: notice.version,
    phase: now < notice.effectiveAt ? "upcoming" : "updated",
    summary: notice.summary,
    documents: notice.documents,
  };
  reply.send(response);
}

export async function createLegalNoticeDismissalHandler(
  request: FastifyRequest<{ Body: CreateLegalNoticeDismissalBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository } = request.container;
  const notice = getActiveLegalNotice(request, new Date());

  if (!notice || notice.version !== request.body.version) {
    reply.code(204).send();
    return;
  }

  const user = await userRepository.findByDiscordId(request.discordUserId);

  if (isNoticeHiddenForUser(user, notice)) {
    reply.code(204).send();
    return;
  }

  await userRepository.updatePreferencesByDiscordId(request.discordUserId, {
    legalNoticeDismissal: {
      version: notice.version,
      dismissedAt: new Date(),
    },
  });

  reply.code(204).send();
}
