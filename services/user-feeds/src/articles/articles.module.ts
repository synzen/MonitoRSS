/* eslint-disable max-len */
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ArticleParserModule } from "../article-parser/article-parser.module";
import { CacheStorageModule } from "../cache-storage/cache-storage.module";
import { FeedFetcherModule } from "../feed-fetcher/feed-fetcher.module";
import { ArticlesService } from "./articles.service";
import { FeedArticleCustomComparison } from "./entities";
import { PartitionedFeedArticleFieldStoreService } from "./partitioned-feed-article-field-store.service";

@Module({
  controllers: [],
  providers: [ArticlesService, PartitionedFeedArticleFieldStoreService],
  imports: [
    MikroOrmModule.forFeature([FeedArticleCustomComparison]),
    ArticleParserModule,
    FeedFetcherModule,
    CacheStorageModule,
  ],
  exports: [ArticlesService, PartitionedFeedArticleFieldStoreService],
})
export class ArticlesModule {}
