import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { ObjectFileStorageService } from './object-file-storage.service';

@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: S3Client,
      useFactory: (configService: ConfigService) => {
        const s3Endpoint = configService.get('FEED_REQUESTS_S3_ENDPOINT');

        return new S3Client({
          endpoint: s3Endpoint,
          region: s3Endpoint ? 'us-east-1' : undefined,
          credentials: s3Endpoint
            ? {
                accessKeyId: 'random-key',
                secretAccessKey: 'random-access-key',
              }
            : undefined,
          forcePathStyle: true,
        });
      },
      inject: [ConfigService],
    },
    ObjectFileStorageService,
  ],
  exports: [ObjectFileStorageService],
})
export class ObjectFileStorageModule {}
