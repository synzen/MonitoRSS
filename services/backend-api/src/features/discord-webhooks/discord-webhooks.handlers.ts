import type { FastifyRequest, FastifyReply } from "fastify";
import {
  NotFoundError,
  ForbiddenError,
  ApiErrorCode,
} from "../../infra/error-handler";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";

interface WebhookParams {
  id: string;
}

export async function getWebhookHandler(
  request: FastifyRequest<{ Params: WebhookParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { discordWebhooksService, discordAuthService } = request.container;
  const { id } = request.params;

  try {
    const webhook = await discordWebhooksService.getWebhook(id);

    if (!webhook || !webhook.guild_id) {
      throw new NotFoundError(ApiErrorCode.WEBHOOK_MISSING);
    }

    const { isManager } = await discordAuthService.userManagesGuild(
      request.accessToken.access_token,
      webhook.guild_id,
    );

    if (!isManager) {
      throw new NotFoundError(ApiErrorCode.WEBHOOK_MISSING);
    }

    return reply.send({
      result: {
        id: webhook.id,
        name: webhook.name,
        channelId: webhook.channel_id,
        avatarUrl: webhook.avatar || undefined,
      },
    });
  } catch (err) {
    if (
      err instanceof DiscordAPIError &&
      (err.statusCode === 401 || err.statusCode === 403)
    ) {
      throw new ForbiddenError(
        ApiErrorCode.WEBHOOKS_MANAGE_MISSING_PERMISSIONS,
      );
    }

    throw err;
  }
}
