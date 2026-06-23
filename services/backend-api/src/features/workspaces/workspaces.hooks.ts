import type { FastifyRequest, FastifyReply } from "fastify";
import { sendError, ApiErrorCode } from "../../infra/error-handler";

// Runs after requireAuthHook to resolve the internal user id onto request.userId
// (the provider-agnostic identity seam) for workspace routes. Workspaces are
// available to everyone, so this only 404s when the user record is missing.
export async function requireWorkspacesFeatureHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository } = request.container;
  const user = await userRepository.findByDiscordId(request.discordUserId);

  if (!user) {
    sendError(reply, 404, ApiErrorCode.ROUTE_NOT_FOUND, "Not Found");
    return;
  }

  request.userId = user.id;
}
