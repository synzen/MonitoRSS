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
  // The compose-provided broker URL has no credentials; the previous
  // amqplib-based client defaulted those to guest:guest, so keep that
  // behavior for the frozen environment contract.
  const parsed = new URL(url);

  if (!parsed.username && !parsed.password) {
    parsed.username = 'guest';
    parsed.password = 'guest';
  }

  const connection = new Connection({
    url: encodeURI(parsed.toString()),
    // Establishment from ECS intermittently stalls ~10s on the broker hostname
    // lookup; the client's 10s connectionTimeout default killed those attempts
    // mid-lookup (amqplib, with no timeout, waited them out and always
    // connected). Match amqplib's tolerance and let consumers wait out a full
    // connection attempt instead of re-rolling the same timeout forever.
    connectionTimeout: 30000,
    acquireTimeout: 35000,
    noDelay: true,
  });

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
      // The queue already exists in existing environments, declared durable by
      // the legacy amqplib consumer (assertQueue defaults to durable). A
      // non-durable re-declare is rejected by the broker (inequivalent arg),
      // which closes the channel and leaves the consumer permanently unbound.
      queueOptions: { durable: true },
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

  // rabbitmq-client emits consumer setup failures only once and then retries
  // silently, so surface an ongoing unbound state that would otherwise go
  // unnoticed while the process appears healthy.
  const bindingWatchdog = setInterval(() => {
    if (!consumer.consumerTag) {
      logger.warn(`Consumer for ${queue} is not bound to the queue`);
    }
  }, 60000);
  bindingWatchdog.unref();

  return consumer;
}
