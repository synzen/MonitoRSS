import { DynamicModule, Module } from "@nestjs/common";
import { AppConfigModule } from "../app-config/app-config.module";
import { Client, GatewayIntentBits, GatewayOpcodes } from "@discordjs/core";
import { AppConfigService } from "../app-config/app-config.service";

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import {
  WebSocketManager,
  CompressionMethod,
  WebSocketShardEvents,
} from "@discordjs/ws";
import { DiscordClientService } from "./discord-client.service";
import { DISCORD_PRESENCE_ACTIVITY_TYPE_IDS } from "../constants/discord-presence-activity-type.constants";
import {
  DISCORD_PRESENCE_STATUS_TO_API_VALUE,
  DiscordPresenceStatus,
} from "../constants/discord-presence-status.constants";
import { MessageBrokerModule } from "../message-broker/message-broker.module";

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
    console.log(
      `Session limit check passed: ${session_start_limit.remaining} sessions available, ${shardsNeeded} needed`,
    );
    return;
  }

  const resetAt = new Date(Date.now() + session_start_limit.reset_after);
  console.log(
    `Not enough sessions to spawn ${shardsNeeded} shards. ` +
      `Only ${session_start_limit.remaining} remaining. ` +
      `Waiting until reset at ${resetAt.toISOString()}...`,
  );

  await new Promise((resolve) =>
    setTimeout(resolve, session_start_limit.reset_after),
  );

  return waitForSufficientSessions(rest, requiredShards);
}

@Module({})
export class DiscordClientModule {
  static forRoot(): DynamicModule {
    return {
      module: DiscordClientModule,
      providers: [
        {
          provide: Client,
          useFactory: async (appConfigService: AppConfigService) => {
            const token = appConfigService.getBotToken();
            const presenceStatus = appConfigService.getPresenceStatus();

            const rest = new REST({ version: "10" }).setToken(token);

            let intents: GatewayIntentBits = undefined;

            if (appConfigService.getSupporterGuildId()) {
              intents = GatewayIntentBits.GuildMembers;
            }

            if (!intents) {
              // Force the bot to be online anyways
              intents = GatewayIntentBits.Guilds;
            }

            const gateway = new WebSocketManager({
              token,
              intents,
              rest,
              compression: CompressionMethod.ZlibNative,
            });

            gateway.on(WebSocketShardEvents.SocketError, (error, shardId) => {
              console.error(`WebSocket error on shard ${shardId}:`, error);
            });

            gateway.on(WebSocketShardEvents.Error, (error, shardId) => {
              console.error(`Gateway error on shard ${shardId}:`, error);
            });

            const client = new Client({ rest, gateway });

            await waitForSufficientSessions(rest);
            await gateway.connect();

            if (presenceStatus) {
              const shards = await gateway.getShardIds();

              await Promise.all(
                shards.map(async (id) => {
                  try {
                    await gateway.send(id, {
                      op: GatewayOpcodes.PresenceUpdate,
                      d: {
                        status:
                          DISCORD_PRESENCE_STATUS_TO_API_VALUE[
                            presenceStatus.status
                          ],
                        activities: presenceStatus.activity
                          ? [
                              {
                                name: presenceStatus.activity.name,
                                type: DISCORD_PRESENCE_ACTIVITY_TYPE_IDS[
                                  presenceStatus.activity.type
                                ],
                                url: presenceStatus.activity.url,
                              },
                            ]
                          : [],
                        afk: false,
                        since:
                          presenceStatus.status === DiscordPresenceStatus.Idle
                            ? new Date().getTime()
                            : null,
                      },
                    });
                  } catch (err) {
                    console.error(
                      `Failed to update presence for shard ${id}`,
                      err,
                    );
                  }
                }),
              );
            }

            return client;
          },
          inject: [AppConfigService],
        },
        DiscordClientService,
      ],
      imports: [AppConfigModule.forRoot(), MessageBrokerModule.forRoot()],
      exports: [DiscordClientService],
    };
  }
}
