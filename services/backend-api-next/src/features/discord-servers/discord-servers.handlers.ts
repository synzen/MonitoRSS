import type { FastifyRequest, FastifyReply } from "fastify";
import type { DiscordGuildChannelFormatted } from "../../services/discord-servers/types";
import { DiscordChannelType } from "../../shared/types/discord.types";

interface ServerParams {
  serverId: string;
}

interface ActiveThreadsQuerystring {
  parentChannelId?: string;
}

const mappedTypes: Partial<Record<DiscordChannelType, string>> = {
  [DiscordChannelType.GUILD_TEXT]: "text",
  [DiscordChannelType.GUILD_VOICE]: "voice",
  [DiscordChannelType.GUILD_CATEGORY]: "category",
  [DiscordChannelType.GUILD_ANNOUNCEMENT]: "announcement",
  [DiscordChannelType.GUILD_FORUM]: "forum",
  [DiscordChannelType.ANNOUNCEMENT_THREAD]: "announcement_thread",
  [DiscordChannelType.PUBLIC_THREAD]: "public_thread",
  [DiscordChannelType.PRIVATE_THREAD]: "private_thread",
};

function mapChannelsToOutput(channels: DiscordGuildChannelFormatted[]) {
  return {
    results: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      category: channel.category,
      type: mappedTypes[channel.type],
      availableTags: channel.availableTags,
    })),
    total: channels.length,
  };
}

export async function getServerHandler(
  request: FastifyRequest<{ Params: ServerParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { discordServersService } = request.container;
  const { serverId } = request.params;

  const [profile, { exists }] = await Promise.all([
    discordServersService.getServerProfile(serverId),
    discordServersService.getGuild(serverId),
  ]);

  return reply.send({
    result: {
      profile,
      includesBot: exists,
    },
  });
}

export async function getServerStatusHandler(
  request: FastifyRequest<{ Params: ServerParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { discordServersService } = request.container;
  const { serverId } = request.params;
  const result = await discordServersService.getServer(serverId);
  return reply.send({ result: { authorized: !!result } });
}

export async function getActiveThreadsHandler(
  request: FastifyRequest<{
    Params: ServerParams;
    Querystring: ActiveThreadsQuerystring;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { discordServersService } = request.container;
  const { serverId } = request.params;
  const { parentChannelId } = request.query;

  const threads = await discordServersService.getActiveThreads(serverId, {
    parentChannelId,
  });

  return reply.send(mapChannelsToOutput(threads));
}
