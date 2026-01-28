import { MessageBrokerQueue } from "../../infra/rabbitmq";

export class MessageBrokerService {
  constructor(
    private readonly publishMessage: (
      queue: string,
      message: unknown,
    ) => Promise<void>,
  ) {}

  async publishSyncSupporterDiscordRoles(data: {
    userId: string;
  }): Promise<void> {
    await this.publishMessage(MessageBrokerQueue.SyncSupporterDiscordRoles, {
      data,
    });
  }
}
