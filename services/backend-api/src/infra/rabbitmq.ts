import { Connection } from "rabbitmq-client";
import logger from "./logger";

// Re-export the canonical MessageBrokerQueue enum so existing imports keep working.
// New code should import directly from "@monitorss/contracts".
export { MessageBrokerQueue } from "@monitorss/contracts";

export async function createRabbitConnection(url: string): Promise<Connection> {
  const connection = new Connection(encodeURI(url));

  connection.on("error", (err) => {
    logger.error("RabbitMQ connection error", { error: (err as Error).stack });
  });

  connection.on("connection", () => {
    logger.info("RabbitMQ connection established");
  });

  return connection;
}

export async function closeRabbitConnection(
  connection: Connection,
): Promise<void> {
  try {
    await connection.close();
    logger.info("RabbitMQ connection closed");
  } catch (err) {
    logger.error("Failed to close RabbitMQ connection", {
      error: (err as Error).stack,
    });
  }
}

export function createPublisher(connection: Connection) {
  return async (
    queue: string,
    message: unknown,
    options?: { expiration?: number },
  ): Promise<void> => {
    const pub = connection.createPublisher({
      confirm: true,
      maxAttempts: 3,
    });
    const envelope = {
      routingKey: queue,
      ...(options?.expiration !== undefined
        ? { expiration: String(options.expiration) }
        : {}),
    };
    await pub.send(envelope, message);
    await pub.close();
  };
}

function parseMessageBody(body: Buffer | string | unknown): unknown {
  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString());
  }
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  return body;
}

export function createConsumer(connection: Connection) {
  return (queue: string, handler: (msg: unknown) => Promise<void>) => {
    const consumer = connection.createConsumer(
      {
        queue,
        queueOptions: { durable: true },
        qos: { prefetchCount: 100 },
      },
      async (msg) => {
        try {
          await handler(parseMessageBody(msg.body));
        } catch (err) {
          logger.error(`Error handling message from ${queue}`, {
            error: (err as Error).stack,
          });
        }
      },
    );

    // The consumer retries setup on its own; without an error listener the
    // emitted 'error' (e.g. broker not yet reachable at boot) would crash the
    // process.
    consumer.on("error", (err) => {
      logger.error(`Consumer error for ${queue}`, {
        error: (err as Error).stack,
      });
    });

    return consumer;
  };
}
