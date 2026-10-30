import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { MessageBrokerQueue } from '@monitorss/contracts';
import { createQueueConsumer } from './rabbitmq';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

describe('createQueueConsumer', () => {
  it('declares the queue as durable, matching the legacy consumer declaration', () => {
    let capturedProps: { queueOptions: Record<string, unknown> } | undefined;

    const connection = {
      createConsumer: (props: never) => {
        capturedProps = props as { queueOptions: Record<string, unknown> };

        return {
          consumerTag: 'consumer-tag',
          on: mock.fn(),
        };
      },
    };

    createQueueConsumer(
      connection as never,
      {
        queue: MessageBrokerQueue.UrlFetchBatch,
        prefetchCount: 3,
      },
      async () => {},
    );

    assert.equal(capturedProps?.queueOptions.durable, true);
  });

  it('passes the prefetch count through as qos', () => {
    let capturedProps: { qos: Record<string, unknown> } | undefined;

    const connection = {
      createConsumer: (props: never) => {
        capturedProps = props as { qos: Record<string, unknown> };

        return {
          consumerTag: 'consumer-tag',
          on: mock.fn(),
        };
      },
    };

    createQueueConsumer(
      connection as never,
      {
        queue: MessageBrokerQueue.UrlFetchBatch,
        prefetchCount: 3,
      },
      async () => {},
    );

    assert.deepEqual(capturedProps?.qos, { prefetchCount: 3 });
  });
});
