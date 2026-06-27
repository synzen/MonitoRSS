import type { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ApiErrorCode } from "../../infra/error-handler";
import type {
  SendEmailVerificationBody,
  ConfirmEmailVerificationBody,
  RevertEmailVerificationBody,
} from "./email-verification.schemas";

export async function sendEmailVerificationHandler(
  request: FastifyRequest<{ Body: SendEmailVerificationBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository, emailVerificationService } = request.container;
  const userId = await userRepository.findIdByDiscordId(request.discordUserId);

  if (!userId) {
    throw new NotFoundError(ApiErrorCode.USER_NOT_FOUND);
  }

  await emailVerificationService.sendCode(userId, request.body.email);

  return reply.send({ result: { ok: true } });
}

export async function confirmEmailVerificationHandler(
  request: FastifyRequest<{ Body: ConfirmEmailVerificationBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository, emailVerificationService } = request.container;
  const userId = await userRepository.findIdByDiscordId(request.discordUserId);

  if (!userId) {
    throw new NotFoundError(ApiErrorCode.USER_NOT_FOUND);
  }

  await emailVerificationService.confirm(
    userId,
    request.body.email,
    request.body.code,
  );

  return reply.send({ result: { ok: true } });
}

export async function revertEmailVerificationHandler(
  request: FastifyRequest<{ Body: RevertEmailVerificationBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { emailVerificationService } = request.container;

  // Authorized solely by the signed token carried in the body (clicked from an
  // email, so unauthenticated). The token identifies the user and the change.
  await emailVerificationService.revertVerifiedEmail(request.body.token);

  return reply.send({ result: { ok: true } });
}
