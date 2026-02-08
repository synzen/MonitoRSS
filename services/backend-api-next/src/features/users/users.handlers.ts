import type { FastifyRequest, FastifyReply } from "fastify";
import { sendError, ApiErrorCode } from "../../infra/error-handler";
import type { UpdateMeBody } from "./users.schemas";

export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { usersService } = request.container;
  const discordUserId = request.discordUserId;

  const result = await usersService.getByDiscordId(discordUserId);

  if (!result) {
    sendError(reply, 404, ApiErrorCode.USER_NOT_FOUND);
    return;
  }

  const {
    user,
    subscription,
    creditBalance,
    isOnPatreon,
    supporterFeatures,
    externalAccounts,
  } = result;

  return reply.send({
    result: {
      id: user.id,
      discordUserId: user.discordUserId,
      email: user.email,
      preferences: user.preferences || {},
      subscription,
      creditBalance,
      isOnPatreon,
      enableBilling: user.enableBilling,
      featureFlags: user.featureFlags || {},
      supporterFeatures,
      externalAccounts,
    },
  });
}

export async function updateMeHandler(
  request: FastifyRequest<{ Body: UpdateMeBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { usersService } = request.container;
  const discordUserId = request.discordUserId;

  const result = await usersService.updateUserByDiscordId(discordUserId, {
    preferences: request.body.preferences,
  });

  if (!result) {
    sendError(reply, 404, ApiErrorCode.USER_NOT_FOUND);
    return;
  }

  const {
    user,
    subscription,
    creditBalance,
    isOnPatreon,
    supporterFeatures,
    externalAccounts,
  } = result;

  return reply.send({
    result: {
      id: user.id,
      discordUserId: user.discordUserId,
      email: user.email,
      preferences: user.preferences || {},
      subscription,
      creditBalance,
      isOnPatreon,
      enableBilling: user.enableBilling,
      featureFlags: user.featureFlags || {},
      supporterFeatures,
      externalAccounts,
    },
  });
}
