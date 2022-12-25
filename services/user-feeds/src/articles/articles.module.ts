import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ArticlesService } from "./articles.service";
import { FeedArticleCustomComparison, FeedArticleField } from "./entities";

@Module({
  controllers: [],
  providers: [ArticlesService],
  imports: [
    MikroOrmModule.forFeature([FeedArticleField, FeedArticleCustomComparison]),
  ],
  exports: [ArticlesService],
})
export class ArticlesModule {}
