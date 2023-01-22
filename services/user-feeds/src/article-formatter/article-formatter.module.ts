import { Module } from "@nestjs/common";
import { ArticleFormatterService } from "./article-formatter.service";

@Module({
  controllers: [],
  providers: [ArticleFormatterService],
  imports: [],
  exports: [ArticleFormatterService],
})
export class ArticleFormatterModule {}
