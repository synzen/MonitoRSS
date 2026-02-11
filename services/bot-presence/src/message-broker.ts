import amqp from "amqp-connection-manager";
import { Channel } from "amqplib";
import logger from "./logger";

const QUEUE_SYNC_SUPPORTER_DISCORD_ROLES = "sync-supporter-discord-roles";

export interface MessageBroker {
  publishSupporterServerMemberJoined(data: { userId: string }): void;
  close(): Promise<void>;
}

export function createMessageBroker(rabbitMqUrl: string): MessageBroker {
  const connection = amqp.connect([rabbitMqUrl]);

  connection.on("connect", () => {
    logger.info("RabbitMQ connected");
  });

  connection.on("disconnect", (err: Error) => {
    logger.error("RabbitMQ disconnected", { error: err.message });
  });

  const channel = connection.createChannel({
    json: true,
    setup: (ch: Channel) => {
      return ch.assertQueue(QUEUE_SYNC_SUPPORTER_DISCORD_ROLES);
    },
  });

  return {
    publishSupporterServerMemberJoined(data) {
      channel.sendToQueue(QUEUE_SYNC_SUPPORTER_DISCORD_ROLES, { data });
    },
    async close() {
      try {
        await connection.close();
      } catch (err) {
        logger.error(`Failed to close RabbitMQ connection`, {
          error: (err as Error).message,
        });
      }
    },
  };
}
