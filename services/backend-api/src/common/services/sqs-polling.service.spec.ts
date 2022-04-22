import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import logger from '../../utils/logger';
import { SqsPollingService } from './sqs-polling.service';

jest.mock('../../utils/logger');

const mockLogger = logger as jest.Mocked<typeof logger>;

const mockSqsMessage = {
  MessageId: 'message-id',
  ReceiptHandle: 'receipt-handle',
  Body: 'body',
  Attributes: {},
  MD5OfBody: 'md5-of-body',
  MD5OfMessageAttributes: 'md5-of-message-attributes',
  MessageAttributes: {},
  ReceiptTime: new Date(),
  SequenceNumber: 'sequence-number',
};

describe('SqsPollingService', () => {
  let service: SqsPollingService;
  const sqsClient = mockClient(SQSClient);
  const queueUrl = 'queue-url';

  const onMessageReceived = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    sqsClient.reset();
    service = new SqsPollingService();
  });

  describe('processQueueMessages', () => {
    it('rejects if receive message command fails', async () => {
      const error = new Error('test');
      sqsClient.on(ReceiveMessageCommand).rejects(error);

      await expect(
        service.processQueueMessages(
          sqsClient as never,
          queueUrl,
          onMessageReceived,
          {
            awaitProcessing: true,
          },
        ),
      ).rejects.toBe(error);
    });

    it('resolves if messages is undefined', async () => {
      sqsClient.on(ReceiveMessageCommand).resolves({});

      await expect(
        service.processQueueMessages(
          sqsClient as never,
          queueUrl,
          onMessageReceived,
          {
            awaitProcessing: true,
          },
        ),
      ).resolves.toBeUndefined();
    });

    it('resolves if there are no messages', async () => {
      sqsClient.on(ReceiveMessageCommand).resolves({
        Messages: [],
      });

      await expect(
        service.processQueueMessages(
          sqsClient as never,
          queueUrl,
          onMessageReceived,
          {
            awaitProcessing: true,
          },
        ),
      ).resolves.toBeUndefined();
    });

    it('calls the callback function for every message processed', async () => {
      sqsClient.on(ReceiveMessageCommand).resolves({
        Messages: [mockSqsMessage],
      });

      await service.processQueueMessages(
        sqsClient as never,
        queueUrl,
        onMessageReceived,
        {
          awaitProcessing: true,
        },
      );

      expect(onMessageReceived).toHaveBeenCalledTimes(1);
      expect(onMessageReceived).toHaveBeenCalledWith(mockSqsMessage);
    });

    it('calls delete message if message is processed successfully', async () => {
      sqsClient.on(ReceiveMessageCommand).resolves({
        Messages: [mockSqsMessage],
      });

      const deleteSpy = jest
        .spyOn(service, 'deleteMessage')
        .mockImplementation();

      await service.processQueueMessages(
        sqsClient as never,
        queueUrl,
        onMessageReceived,
        {
          awaitProcessing: true,
        },
      );

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(
        {
          client: sqsClient as never,
          url: queueUrl,
        },
        mockSqsMessage,
      );
    });

    it('logs the error if onMessageReceived failed', async () => {
      sqsClient.on(ReceiveMessageCommand).resolves({
        Messages: [mockSqsMessage],
      });

      const error = new Error('test');
      onMessageReceived.mockRejectedValue(error);

      await service.processQueueMessages(
        sqsClient as never,
        queueUrl,
        onMessageReceived,
        {
          awaitProcessing: true,
        },
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
      );
    });

    it('logs the error if delete message failed', async () => {
      sqsClient.on(ReceiveMessageCommand).resolves({
        Messages: [mockSqsMessage],
      });

      const error = new Error('test');
      jest.spyOn(service, 'deleteMessage').mockRejectedValue(error);

      await service.processQueueMessages(
        sqsClient as never,
        queueUrl,
        onMessageReceived,
        {
          awaitProcessing: true,
        },
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
      );
    });
  });

  describe('deleteMessage', () => {
    it('sends the delete message correctly', async () => {
      sqsClient.on(DeleteMessageCommand).resolves({});
      await service.deleteMessage(
        {
          client: sqsClient as never,
          url: queueUrl,
        },
        {
          ReceiptHandle: 'receipt-handle',
        },
      );
    });

    it('logs the error if delete fails', async () => {
      const error = new Error('Fake error');
      sqsClient.on(DeleteMessageCommand).rejects(error);
      await service.deleteMessage(
        {
          client: sqsClient as never,
          url: queueUrl,
        },
        {
          ReceiptHandle: 'receipt-handle',
        },
      );
      expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String), {
        stack: expect.any(String),
      });
    });
  });
});
