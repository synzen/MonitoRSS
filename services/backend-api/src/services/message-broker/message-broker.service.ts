import { MessageBrokerQueue } from "../../infra/rabbitmq";
import { UrlFetchBatchSchema } from "@monitorss/contracts";

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
      recovery?: { startedAt: number };
    }>;
  }): Promise<void> {
    const message = { ...data, timestamp: Date.now() };

    // Producers validate against the shared contract before publishing
    // (ADR-007): fail loud on producer-side misshape.
    UrlFetchBatchSchema.parse(message);

    await this.publishMessage(
      MessageBrokerQueue.UrlFetchBatch,
      message,
      { expiration: data.rateSeconds * 1000 },
    );
  }
}
