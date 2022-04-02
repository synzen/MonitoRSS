import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import logger from './utils/logger';

interface PollQueueOptions {
  awsQueueUrl: string;
  awsRegion: string;
  awsEndpoint?: string;
  onMessageReceived: (message: Message) => Promise<void>;
}

export async function pollQueue({
  awsQueueUrl,
  awsRegion,
  awsEndpoint,
  onMessageReceived,
}: PollQueueOptions) {
  const client = new SQSClient({
    endpoint: awsEndpoint,
    region: awsRegion,
  });

  while (true) {
    await processQueueMessages(client, awsQueueUrl, onMessageReceived);
  }
}

export async function processQueueMessages(
  client: SQSClient,
  queueUrl: string,
  onMessageReceived: (message: Message) => Promise<void>,
  options?: {
    awaitProcessing: boolean;
  },
) {
  const receiveResult = await client.send(
    new ReceiveMessageCommand({
      WaitTimeSeconds: 20,
      QueueUrl: queueUrl,
      MessageAttributeNames: ['All'],
    }),
  );

  if (!receiveResult.Messages) {
    logger.debug(`No messages found in queue ${queueUrl}`);

    return;
  }

  logger.debug(
    `Found ${receiveResult.Messages.length} messages in queue ${queueUrl}`,
  );

  const promises = receiveResult.Messages.map(async (message) => {
    try {
      await onMessageReceived(message);
      await deleteMessage(
        {
          client,
          url: queueUrl,
        },
        message,
      );
    } catch (err) {
      logger.error(`Error processing message ${message.MessageId}`, {
        stack: (err as Error).stack,
      });
    }
  });

  /**
   * Used for testing - should never be true by default since polling would be blocked by messages
   * being processed.
   */
  if (options?.awaitProcessing) {
    await Promise.all(promises);
  }
}

export async function deleteMessage(
  {
    client,
    url,
  }: {
    client: SQSClient;
    url: string;
  },
  message: Message,
) {
  try {
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: url,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  } catch (err) {
    logger.error(`Error deleting message ${message.MessageId}`, {
      stack: (err as Error).stack,
    });
  }
}
