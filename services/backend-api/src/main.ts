import "./utils/dd-tracer";
import { Module, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import {
  NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import { useContainer } from "class-validator";
import fastifySession from "@fastify/secure-session";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

/**
 * Required  because Nest's app.select() does not work for dynamic modules
 */
@Module({
  imports: [AppModule.forRoot()],
})
class StaticAppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    StaticAppModule,
    new FastifyAdapter({
      logger: true,
    })
  );

  app.enableShutdownHooks();

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  useContainer(app.select(StaticAppModule), { fallbackOnErrors: true });
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  const config = app.get(ConfigService);
  const sessionSecret = config.get("BACKEND_API_SESSION_SECRET");
  const sessionSalt = config.get("BACKEND_API_SESSION_SALT");

  await app.register(fastifySession, {
    secret: sessionSecret,
    salt: sessionSalt,
    cookie: {
      path: "/",
      httpOnly: true,
    },
  });

  const port = config.getOrThrow("BACKEND_API_PORT");

  console.log(`NestJS is listening on port ${port}`);

  await app.listen(port, "0.0.0.0");
}

bootstrap();
