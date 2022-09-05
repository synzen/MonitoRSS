import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ArticlesService } from "./articles.service";
import { FeedArticleField } from "./entities";

@Module({
  controllers: [],
  providers: [ArticlesService],
  imports: [MikroOrmModule.forFeature([FeedArticleField])],
})
export class ArticlesModule {}
