import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { FEED_RESPONSE_BUCKET } from './constants/feed-response-bucket.constants';

@Injectable()
export class ObjectFileStorageService {
  constructor(private readonly s3Client: S3Client) {}

  async uploadFeedHtmlContent({ key, body }: { body: string; key: string }) {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: FEED_RESPONSE_BUCKET,
        Key: key,
        Body: body,
      }),
    );
  }

  async getFeedHtmlContent({ key }: { key: string }) {
    try {
      const response = await this.s3Client.send(
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
  }
}
