import { Module } from "@nestjs/common";
import { FeedFetcherModule } from "../feed-fetcher/feed-fetcher.module";
import { ArticleParserService } from "./article-parser.service";

@Module({
  controllers: [],
  providers: [ArticleParserService],
  imports: [FeedFetcherModule],
  exports: [ArticleParserService],
})
export class ArticleParserModule {}
