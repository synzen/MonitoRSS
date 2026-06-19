import type { FastifyRequest, FastifyReply } from "fastify";
import type { DeleteAccountBody } from "./account.schemas";

export async function sendAccountDeletionCodeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { accountService } = request.container;

  await accountService.sendDeletionCode(request.discordUserId);

  return reply.send({ result: { ok: true } });
}

export async function deleteAccountHandler(
  request: FastifyRequest<{ Body: DeleteAccountBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { accountService } = request.container;

  await accountService.deleteAccountWithVerification(
    request.discordUserId,
    request.body.code,
  );

  return reply.status(204).send();
}
