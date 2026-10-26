import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';

const FEED_RESPONSE_BUCKET = 'monitorss-feed-responses';

export interface ObjectFileStorageService {
  uploadFeedHtmlContent(params: { key: string; body: string }): Promise<void>;
  getFeedHtmlContent(params: { key: string }): Promise<string | undefined>;
}

export function createObjectFileStorageService({
  endpoint,
  keyId,
  key,
}: {
  endpoint?: string;
  keyId?: string;
  key?: string;
}): ObjectFileStorageService {
  const s3Client = endpoint
    ? new S3Client({
        endpoint,
        region: 'us-east-1',
        credentials: {
          accessKeyId: keyId!,
          secretAccessKey: key!,
        },
        forcePathStyle: true,
      })
    : new S3Client({ forcePathStyle: true });

  return {
    async uploadFeedHtmlContent({ key, body }) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: FEED_RESPONSE_BUCKET,
          Key: key,
          Body: body,
        }),
      );
    },

    async getFeedHtmlContent({ key }) {
      try {
        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: FEED_RESPONSE_BUCKET,
            Key: key,
          }),
        );

        return await response.Body?.transformToString();
      } catch (err) {
        if (err instanceof NoSuchKey) {
          return '';
        }

        throw err;
      }
    },
  };
}
