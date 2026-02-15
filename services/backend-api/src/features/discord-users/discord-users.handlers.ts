import type { FastifyRequest, FastifyReply } from "fastify";
import { getAccessTokenFromRequest } from "../../infra/auth";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";

export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { discordUsersService } = request.container;

  const user = await discordUsersService.getUser(
    request.accessToken.access_token,
  );

  return reply.send({
    id: user.id,
    username: user.username,
    iconUrl: user.avatarUrl,
    supporter: user.supporter,
    maxFeeds: user.maxFeeds,
    maxUserFeeds: user.maxUserFeeds,
    maxUserFeedsComposition: user.maxUserFeedsComposition,
    allowCustomPlaceholders: user.allowCustomPlaceholders,
  });
}

export async function getBotHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { discordUsersService, config } = request.container;

  const bot = await discordUsersService.getBot();

  const botClientId = config.BACKEND_API_DISCORD_CLIENT_ID;
  const inviteLink = `https://discord.com/oauth2/authorize?client_id=${botClientId}&scope=bot&permissions=19456`;

  return reply.send({
    result: {
      id: bot.id,
      username: bot.username,
      avatar: bot.avatar,
      inviteLink,
    },
  });
}

export async function getAuthStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { discordUsersService } = request.container;

  const token = getAccessTokenFromRequest(request);

  if (!token) {
    return reply.send({ authenticated: false });
  }

  try {
    await discordUsersService.getUser(token.access_token);
    return reply.send({ authenticated: true });
  } catch (err) {
    if (
      err instanceof DiscordAPIError &&
      (err.statusCode === 401 ||
        err.statusCode === 403 ||
        err.statusCode === 404)
    ) {
      await request.session.delete();
      return reply.send({ authenticated: false });
    }

    throw err;
  }
}

export async function getUserByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { discordUsersService } = request.container;

  const user = await discordUsersService.getUserById(request.params.id);

  return reply.send({
    result: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatar,
    },
  });
}

export async function getMeServersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { discordUsersService } = request.container;

  const guilds = await discordUsersService.getGuilds(
    request.accessToken.access_token,
  );

  const data = guilds.map((guild) => ({
    id: guild.id,
    name: guild.name,
    iconUrl: guild.iconUrl,
    benefits: {
      maxFeeds: guild.benefits.maxFeeds,
      webhooks: guild.benefits.webhooks,
    },
  }));

  return reply.send({
    results: data,
    total: data.length,
  });
}
