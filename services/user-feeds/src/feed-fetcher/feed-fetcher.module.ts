import { credentials } from "@grpc/grpc-js";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule } from "@nestjs/microservices";
import { Transport } from "@nestjs/microservices/enums";
import { join } from "path";
import { FeedFetcherService } from "./feed-fetcher.service";

@Module({
  controllers: [],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [
    ClientsModule.registerAsync({
      clients: [
        // {
        //   name: "FEED_FETCHER_PACKAGE",
        //   useFactory: (configService: ConfigService) => {
        //     const url = configService.getOrThrow<string>(
        //       "USER_FEEDS_FEED_REQUESTS_GRPC_URL"
        //     );
        //     const useTls =
        //       configService.getOrThrow<string>(
        //         "USER_FEEDS_FEED_REQUESTS_GRPC_USE_TLS"
        //       ) === "true";
        //     return {
        //       transport: Transport.GRPC,
        //       options: {
        //         url,
        //         package: "feedfetcher",
        //         protoPath: join(__dirname, "feed-fetcher.proto"),
        //         // https://github.com/grpc/grpc-node/issues/2093#issuecomment-1117969843
        //         credentials: useTls ? credentials.createSsl() : undefined,
        //         channelOptions: {
        //           "grpc.max_receive_message_length": 1024 * 1024 * 100,
        //           "grpc.use_local_subchannel_pool": 1,
        //         },
        //       },
        //     };
        //   },
        //   inject: [ConfigService],
        // },
      ],
    }),
  ],
})
export class FeedFetcherModule {}
