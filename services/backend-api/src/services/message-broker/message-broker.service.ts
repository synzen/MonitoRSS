import { MessageBrokerQueue } from "../../infra/rabbitmq";

export class MessageBrokerService {
  constructor(
    private readonly publishMessage: (
      queue: string,
      message: unknown,
      options?: { expiration?: number },
    ) => Promise<void>,
  ) {}

  async publishSyncSupporterDiscordRoles(data: {
    userId: string;
  }): Promise<void> {
    await this.publishMessage(MessageBrokerQueue.SyncSupporterDiscordRoles, {
      data,
    });
  }

  async publishUrlFetchBatch(data: {
    rateSeconds: number;
    data: Array<{
      url: string;
      saveToObjectStorage?: boolean;
      lookupKey?: string;
      headers?: Record<string, string>;
    }>;
  }): Promise<void> {
    await this.publishMessage(
      MessageBrokerQueue.UrlFetchBatch,
      { ...data, timestamp: Date.now() },
      { expiration: data.rateSeconds * 1000 },
    );
  }
}
