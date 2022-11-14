import { Module } from "@nestjs/common";
import { FeedHandlerService } from "./feed-handler.service";

@Module({
  providers: [FeedHandlerService],
  exports: [FeedHandlerService],
  imports: [],
})
export class FeedHandlerModule {}
