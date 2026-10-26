import { Connection, type Consumer } from 'rabbitmq-client';
import logger from '../utils/logger';

function parseMessageBody(body: Buffer | string | unknown): unknown {
  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString());
  }

  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  return body;
}

export function createRabbitConnection(url: string): Connection {
  const connection = new Connection(encodeURI(url));

  connection.on('error', (err) => {
    logger.error('RabbitMQ connection error', { error: (err as Error).stack });
  });

  connection.on('connection', () => {
    logger.info('RabbitMQ connection established');
  });

  return connection;
}

export type Publish = (queue: string, message: unknown) => Promise<void>;

export function createPublisher(connection: Connection): Publish {
  return async (queue, message) => {
    const pub = connection.createPublisher({
      confirm: true,
      maxAttempts: 3,
    });

    try {
      await pub.send(queue, message);
    } finally {
      await pub.close();
    }
  };
}

/**
 * Consumes a queue with a handler that never rejects: failures are logged and
 * the message is acked (skipped), matching the pre-migration consumer's
 * ack-on-error behavior.
 */
export function createQueueConsumer(
  connection: Connection,
  {
    queue,
    prefetchCount,
  }: {
    queue: string;
    prefetchCount: number;
  },
  handler: (message: unknown) => Promise<void>,
): Consumer {
  const consumer = connection.createConsumer(
    {
      queue,
      // Assert the queue with default options, matching the assertion the
      // previous consumer performed.
      queueOptions: {},
      qos: { prefetchCount },
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

  consumer.on('error', (err) => {
    logger.error(`Consumer error for ${queue}`, {
      error: (err as Error).stack,
    });
  });

  return consumer;
}
