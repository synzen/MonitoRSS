import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';

export enum MessageBrokerQueue {
  SupportServerMemberJoined = 'support-server-member-joined',
}

@Injectable()
export class MessageBrokerService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  publishSupporterServerMemberJoined(data: { userId: string }) {
    this.amqpConnection.publish(
      '',
      MessageBrokerQueue.SupportServerMemberJoined,
      {
        data: data,
      },
    );
  }
}
