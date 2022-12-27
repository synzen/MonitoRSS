import { Module } from "@nestjs/common";
import { ArticleParserService } from "./article-parser.service";

@Module({
  controllers: [],
  providers: [ArticleParserService],
  imports: [],
  exports: [ArticleParserService],
})
export class ArticleParserModule {}
