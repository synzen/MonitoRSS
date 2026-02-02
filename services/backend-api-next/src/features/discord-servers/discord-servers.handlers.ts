import type { FastifyRequest, FastifyReply } from "fastify";
import type { DiscordGuildChannelFormatted } from "../../services/discord-servers/types";

interface ServerParams {
  serverId: string;
}

interface ActiveThreadsQuerystring {
  parentChannelId?: string;
}

const mappedTypes: Record<number, string> = {
  0: "text",
  2: "voice",
  4: "category",
  5: "announcement",
  15: "forum",
  10: "announcement_thread",
  11: "public_thread",
  12: "private_thread",
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
