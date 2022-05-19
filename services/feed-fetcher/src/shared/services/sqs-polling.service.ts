import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import logger from '../../utils/logger';

interface PollQueueOptions {
  queueUrl: string;
  onMessageReceived: (message: Message) => Promise<void>;
}

@Injectable()
export class SqsPollingService {
  async pollQueue(client: SQSClient, options: PollQueueOptions) {
    while (true) {
      this.handleQueuePollRun(client, options);
    }
  }

  async handleQueuePollRun(
    client: SQSClient,
    { onMessageReceived, queueUrl }: PollQueueOptions,
  ) {
    const messages = await this.getQueueMessages(client, queueUrl);

    const promises = messages.map(async (message) => {
      try {
        await onMessageReceived(message);
        await this.deleteMessage(
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

    await Promise.all(promises);
  }

  async getQueueMessages(client: SQSClient, queueUrl: string) {
    const receiveResult = await client.send(
      new ReceiveMessageCommand({
        WaitTimeSeconds: 20,
        QueueUrl: queueUrl,
        MessageAttributeNames: ['All'],
      }),
    );

    if (!receiveResult.Messages) {
      logger.debug(`No messages found in queue ${queueUrl}`);

      return [];
    }

    logger.info(
      `Found ${receiveResult.Messages.length} messages in queue ${queueUrl}`,
    );

    return receiveResult.Messages || [];
  }

  async deleteMessage(
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
}
