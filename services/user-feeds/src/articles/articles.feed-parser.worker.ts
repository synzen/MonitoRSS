import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import "source-map-support/register";
import { worker } from "workerpool";
import { ArticleParserModule } from "../article-parser/article-parser.module";
import { ArticleParserService } from "../article-parser/article-parser.service";
import { config } from "../config";
import logger from "../shared/utils/logger";

@Module({
  imports: [
    ArticleParserModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [config],
    }),
  ],
})
class WorkerModule {}

let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
const createAppPromise = NestFactory.createApplicationContext(WorkerModule);

async function getArticlesFromXml(
  ...args: Parameters<
    (typeof ArticleParserService)["prototype"]["getArticlesFromXml"]
  >
) {
  if (!app) {
    logger.info("Initializing articles feed parser worker");
    app = await createAppPromise;
  }

  const parser = app.get(ArticleParserService);

  return parser.getArticlesFromXml(...args);
}

worker({
  getArticlesFromXml,
});
