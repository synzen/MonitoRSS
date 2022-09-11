import { Module } from "@nestjs/common";
import { ArticleFiltersService } from "./article-filters.service";

@Module({
  controllers: [],
  providers: [ArticleFiltersService],
  exports: [ArticleFiltersService],
})
export class ArticleFiltersModule {}
