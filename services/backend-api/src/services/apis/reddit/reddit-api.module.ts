import { Module } from "@nestjs/common";
import { RedditApiService } from "./reddit-api.service";

@Module({
  providers: [RedditApiService],
  exports: [RedditApiService],
})
export class RedditApiModule {}
