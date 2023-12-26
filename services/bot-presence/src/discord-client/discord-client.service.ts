import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, GatewayDispatchEvents } from '@discordjs/core';
import { MessageBrokerService } from '../message-broker/message-broker.service';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable({})
export class DiscordClientService implements OnModuleInit {
  constructor(
    private readonly client: Client | undefined,
    private readonly brokerService: MessageBrokerService,
    private readonly configService: AppConfigService,
  ) {}

  async onModuleInit() {
    await this.listenToSupporterGuildMemberJoined();
  }

  async listenToSupporterGuildMemberJoined() {
    const supporterGuildId = this.configService.getSupporterGuildId();

    if (!supporterGuildId) {
      return;
    }

    this.client?.on(GatewayDispatchEvents.GuildMemberAdd, ({ data }) => {
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
