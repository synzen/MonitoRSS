import { DynamicModule, Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { Client, GatewayIntentBits } from '@discordjs/core';
import { AppConfigService } from '../app-config/app-config.service';

import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';
import { DiscordClientService } from './discord-client.service';

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

            const rest = new REST({ version: '10' }).setToken(token);

            const gateway = new WebSocketManager({
              token,
              intents:
                GatewayIntentBits.Guilds | GatewayIntentBits.GuildWebhooks,
              rest,
            });

            const client = new Client({ rest, gateway });

            await gateway.connect();

            return client;
          },
          inject: [AppConfigService],
        },
        DiscordClientService,
      ],
      imports: [AppConfigModule.forRoot()],
      exports: [DiscordClientService],
    };
  }
}
