import type { FastifyRequest, FastifyReply } from "fastify";
import { sendError, ApiErrorCode } from "../../infra/error-handler";

// Per-user gate for the workspaces feature; runs after requireAuthHook. Resolves
// the internal user id onto request.userId (the provider-agnostic identity seam)
// and returns 404 when the user lacks the workspaces rollout flag, hiding the
// feature.
export async function requireWorkspacesFeatureHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { userRepository } = request.container;
  const user = await userRepository.findByDiscordId(request.discordUserId);

  if (!user || !user.featureFlags?.workspaces) {
    sendError(reply, 404, ApiErrorCode.ROUTE_NOT_FOUND, "Not Found");
    return;
  }

  request.userId = user.id;
}
