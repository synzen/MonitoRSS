import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, GatewayDispatchEvents } from '@discordjs/core';

@Injectable({})
export class DiscordClientService implements OnModuleInit {
  constructor(private readonly client: Client) {}

  async onModuleInit() {
    this.client.on(GatewayDispatchEvents.WebhooksUpdate, ({ data }) => {
      this.onWebhooksUpdate(data.guild_id, data.channel_id);
    });
  }

  async onWebhooksUpdate(guildId: string, channelId: string) {
    console.log('Webhooks updated in guild', guildId, 'channel', channelId);
  }
}
