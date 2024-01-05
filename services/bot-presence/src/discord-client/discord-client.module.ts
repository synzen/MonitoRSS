import { DynamicModule, Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { Client, GatewayIntentBits, GatewayOpcodes } from '@discordjs/core';
import { AppConfigService } from '../app-config/app-config.service';

import { REST } from '@discordjs/rest';
import { WebSocketManager, CompressionMethod } from '@discordjs/ws';
import { DiscordClientService } from './discord-client.service';
import { DISCORD_PRESENCE_ACTIVITY_TYPE_IDS } from '../constants/discord-presence-activity-type.constants';
import {
  DISCORD_PRESENCE_STATUS_TO_API_VALUE,
  DiscordPresenceStatus,
} from '../constants/discord-presence-status.constants';
import { MessageBrokerModule } from '../message-broker/message-broker.module';

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

            const rest = new REST({ version: '10' }).setToken(token);

            let intents: GatewayIntentBits = GatewayIntentBits.Guilds;

            if (appConfigService.getSupporterGuildId()) {
              intents = intents | GatewayIntentBits.GuildMembers;
            }

            const gateway = new WebSocketManager({
              token,
              intents,
              rest,
              compression: CompressionMethod.ZlibStream,
            });

            const client = new Client({ rest, gateway });

            if (intents) {
              await gateway.connect();
            }

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
