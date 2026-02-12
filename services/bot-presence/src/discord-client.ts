import {
  ApplicationCommandType,
  Client,
  GatewayDispatchEvents,
  GatewayIntentBits,
  GatewayOpcodes,
  InteractionType,
} from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import {
  WebSocketManager,
  CompressionMethod,
  WebSocketShardEvents,
} from "@discordjs/ws";
import { AppConfig } from "./config";
import { MessageBroker } from "./message-broker";
import { DISCORD_PRESENCE_ACTIVITY_TYPE_IDS } from "./constants/discord-presence-activity-type.constants";
import {
  DISCORD_PRESENCE_STATUS_TO_API_VALUE,
  DiscordPresenceStatus,
} from "./constants/discord-presence-status.constants";
import logger from "./logger";

interface GatewayBotInfo {
  shards: number;
  session_start_limit: {
    total: number;
    remaining: number;
    reset_after: number;
    max_concurrency: number;
  };
}

async function waitForSufficientSessions(
  rest: REST,
  requiredShards?: number,
): Promise<void> {
  const gatewayInfo = (await rest.get(Routes.gatewayBot())) as GatewayBotInfo;
  const { shards: recommendedShards, session_start_limit } = gatewayInfo;
  const shardsNeeded = requiredShards ?? recommendedShards;

  if (session_start_limit.remaining >= shardsNeeded) {
    logger.info(
      `Session limit check passed: ${session_start_limit.remaining} sessions available, ${shardsNeeded} needed`,
    );
    return;
  }

  const resetAt = new Date(Date.now() + session_start_limit.reset_after);
  logger.warn(
    `Not enough sessions to spawn ${shardsNeeded} shards. ` +
      `Only ${session_start_limit.remaining} remaining. ` +
      `Waiting until reset at ${resetAt.toISOString()}...`,
  );

  await new Promise((resolve) =>
    setTimeout(resolve, session_start_limit.reset_after),
  );

  return waitForSufficientSessions(rest, requiredShards);
}

export interface DiscordClient {
  destroy(): void;
}

export async function createDiscordClient(
  config: AppConfig,
  broker: MessageBroker,
): Promise<DiscordClient> {
  const rest = new REST({ version: "10" }).setToken(config.botToken);

  let intents: GatewayIntentBits = undefined;

  if (config.supporterGuildId) {
    intents = GatewayIntentBits.GuildMembers;
  }

  if (!intents) {
    intents = GatewayIntentBits.Guilds;
  }

  const gateway = new WebSocketManager({
    token: config.botToken,
    intents,
    rest,
    compression: CompressionMethod.ZlibNative,
  });

  gateway.on(WebSocketShardEvents.SocketError, (error, shardId) => {
    logger.error(`WebSocket error on shard ${shardId}`, {
      error: error.message,
    });
  });

  gateway.on(WebSocketShardEvents.Error, (error, shardId) => {
    logger.error(`Gateway error on shard ${shardId}`, {
      error: error.message,
    });
  });

  const client = new Client({ rest, gateway });

  await waitForSufficientSessions(rest);
  await gateway.connect();

  if (config.presenceStatus) {
    const shards = await gateway.getShardIds();

    await Promise.all(
      shards.map(async (id) => {
        try {
          await gateway.send(id, {
            op: GatewayOpcodes.PresenceUpdate,
            d: {
              status:
                DISCORD_PRESENCE_STATUS_TO_API_VALUE[
                  config.presenceStatus.status
                ],
              activities: config.presenceStatus.activity
                ? [
                    {
                      name: config.presenceStatus.activity.name,
                      type: DISCORD_PRESENCE_ACTIVITY_TYPE_IDS[
                        config.presenceStatus.activity.type
                      ],
                      url: config.presenceStatus.activity.url,
                    },
                  ]
                : [],
              afk: false,
              since:
                config.presenceStatus.status === DiscordPresenceStatus.Idle
                  ? new Date().getTime()
                  : null,
            },
          });
        } catch (err) {
          logger.error(`Failed to update presence for shard ${id}`, {
            error: (err as Error).message,
          });
        }
      }),
    );
  }

  logger.info("Registering commands...");
  await registerCommands(client, config);
  logger.info("Listening to events...");
  listenToEvents(client, config, broker);

  return {
    destroy() {
      gateway.destroy();
    },
  };
}

async function registerCommands(client: Client, config: AppConfig) {
  const botClientId = config.botClientId;

  if (!botClientId) {
    logger.info(
      "No BOT_PRESENCE_DISCORD_BOT_CLIENT_ID found. Skipping registration of commands.",
    );
    return;
  }

  try {
    const commands =
      await client.api.applicationCommands.getGlobalCommands(botClientId);

    if (commands.some((c) => c.name === "help")) {
      logger.info("Help command already registered.");
      return;
    }

    await client.api.applicationCommands.createGlobalCommand(botClientId, {
      name: "help",
      description: "Show information on how to use MonitoRSS.",
      type: ApplicationCommandType.ChatInput,
    });

    logger.info("Help command registered successfully.");
  } catch (err) {
    logger.error("Error registering commands", {
      error: (err as Error).message,
    });
  }
}

function listenToEvents(
  client: Client,
  config: AppConfig,
  broker: MessageBroker,
) {
  client.on(GatewayDispatchEvents.InteractionCreate, (interaction) => {
    if (interaction.data.type !== InteractionType.ApplicationCommand) {
      return;
    }

    if (interaction.data.data.name === "help") {
      client.api.interactions
        .reply(interaction.data.id, interaction.data.token, {
          content:
            'To add and manage feeds, please visit the "Control Panel" at <https://monitorss.xyz> to add and control feeds.\n\nFor support, please either reach out to support@monitorss.xyz or join the support Discord server at https://discord.gg/pudv7Rx.',
        })
        .catch((err) => {
          logger.error("Error replying to interaction", {
            error: (err as Error).message,
          });
        });
    }
  });

  if (!config.supporterGuildId) {
    return;
  }

  client.on(GatewayDispatchEvents.GuildMemberAdd, ({ data }) => {
    if (!data.user) {
      return;
    }

    if (data.guild_id !== config.supporterGuildId) {
      return;
    }

    broker.publishSupporterServerMemberJoined({
      userId: data.user.id,
    });
  });
}
