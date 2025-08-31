import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ApplicationCommandType,
  Client,
  GatewayDispatchEvents,
  InteractionType,
} from '@discordjs/core';
import { MessageBrokerService } from '../message-broker/message-broker.service';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({})
export class DiscordClientService implements OnModuleInit {
  constructor(
    private readonly client: Client,
    private readonly brokerService: MessageBrokerService,
    private readonly configService: AppConfigService,
  ) {}

  async onModuleInit() {
    console.log('Registering commands...');
    await this.registerCommands();
    console.log('Listening to events...');
    await this.listenToEvents();
  }

  async registerCommands() {
    const botClientId = this.configService.getBotClientId();

    if (!botClientId) {
      console.log(
        'No BOT_PRESENCE_DISCORD_BOT_CLIENT_ID found. Skipping registration of commands.',
      );
      return;
    }

    try {
      const commands =
        await this.client.api.applicationCommands.getGlobalCommands(
          botClientId,
        );

      if (commands.some((c) => c.name === 'help')) {
        console.log('Help command already registered.');
        return;
      }

      await this.client.api.applicationCommands.createGlobalCommand(
        botClientId,
        {
          name: 'help',
          description: 'Show information on how to use MonitoRSS.',
          type: ApplicationCommandType.ChatInput,
        },
      );

      console.log('Help command registered successfully.');
    } catch (err) {
      console.error('Error registering commands:', err);
    }
  }

  async listenToEvents() {
    const supporterGuildId = this.configService.getSupporterGuildId();

    this.client.on(GatewayDispatchEvents.InteractionCreate, (interaction) => {
      if (interaction.data.type !== InteractionType.ApplicationCommand) {
        return;
      }

      if (interaction.data.data.name === 'help') {
        this.client.api.interactions
          .reply(interaction.data.id, interaction.data.token, {
            content:
              'To add and manage feeds, please visit the "Control Panel" at <https://monitorss.xyz> to add and control feeds.\n\nFor support, please either reach out to support@monitorss.xyz or join the support Discord server at https://discord.gg/pudv7Rx.',
          })
          .catch((err) => {
            console.error('Error replying to interaction:', err);
          });
      }
    });

    if (!supporterGuildId) {
      return;
    }

    this.client.on(GatewayDispatchEvents.GuildMemberAdd, ({ data }) => {
      if (!data.user) {
        return;
      }

      if (data.guild_id !== supporterGuildId) {
        return;
      }

      this.brokerService.publishSupporterServerMemberJoined({
        userId: data.user.id,
      });
    });
  }
}
