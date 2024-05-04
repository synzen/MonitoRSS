import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ArticleParserModule } from "../article-parser/article-parser.module";
import { CacheStorageModule } from "../cache-storage/cache-storage.module";
import { FeedFetcherModule } from "../feed-fetcher/feed-fetcher.module";
import { ArticlesService } from "./articles.service";
import { FeedArticleCustomComparison, FeedArticleField } from "./entities";

@Module({
  controllers: [],
  providers: [ArticlesService],
  imports: [
    MikroOrmModule.forFeature([FeedArticleField, FeedArticleCustomComparison]),
    ArticleParserModule,
    FeedFetcherModule,
    CacheStorageModule,
  ],
  exports: [ArticlesService],
})
export class ArticlesModule {}
