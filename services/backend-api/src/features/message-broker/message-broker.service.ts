import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { MessageBrokerQueue } from "../../common/constants/message-broker-queue.constants";

@Injectable()
export class MessageBrokerService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  publishSyncSupporterDiscordRoles(data: { userId: string }) {
    this.amqpConnection.publish(
      "",
      MessageBrokerQueue.SyncSupporterDiscordRoles,
      { data }
    );
  }
}
