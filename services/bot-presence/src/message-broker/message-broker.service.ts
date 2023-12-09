import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';

export enum MessageBrokerQueue {
  SyncSupporterDiscordRoles = 'sync-supporter-discord-roles',
}

@Injectable()
export class MessageBrokerService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  publishSupporterServerMemberJoined(data: { userId: string }) {
    this.amqpConnection.publish(
      '',
      MessageBrokerQueue.SyncSupporterDiscordRoles,
      {
        data: data,
      },
    );
  }
}
