import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from '@discordjs/core';

@Injectable({})
export class DiscordClientService implements OnModuleInit {
  constructor(private readonly client: Client) {}

  async onModuleInit() {
    // this.client.on(GatewayDispatchEvents.WebhooksUpdate, ({ data }) => {
    //   this.onWebhooksUpdate(data.guild_id, data.channel_id);
    // });
  }
}
