import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule } from "@nestjs/microservices";
import { Transport } from "@nestjs/microservices/enums";
import { join } from "path";
import { ArticlesModule } from "../articles/articles.module";
import { FeedFetcherService } from "./feed-fetcher.service";

@Module({
  controllers: [],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [
    ArticlesModule,
    ClientsModule.registerAsync({
      clients: [
        {
          name: "FEED_FETCHER_PACKAGE",
          useFactory: (configService: ConfigService) => {
            const url = configService.getOrThrow<string>(
              "USER_FEEDS_FEED_REQUESTS_GRPC_URL"
            );

            return {
              transport: Transport.GRPC,
              options: {
                url,
                package: "feedfetcher",
                protoPath: join(__dirname, "feed-fetcher.proto"),
              },
            };
          },

          inject: [ConfigService],
        },
      ],
    }),
  ],
})
export class FeedFetcherModule {}
