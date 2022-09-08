import { Module } from "@nestjs/common";
import { ArticlesModule } from "../articles/articles.module";
import { FeedEventHandlerService } from "./feed-event-handler.service";

@Module({
  controllers: [],
  providers: [FeedEventHandlerService],
  imports: [ArticlesModule],
})
export class FeedEventHandlerModule {}
