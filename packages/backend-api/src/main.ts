import { Module, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { useContainer } from 'class-validator';
import secureSession from 'fastify-secure-session';
import { AppModule } from './app.module';

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
    }),
  );

  useContainer(app.select(StaticAppModule), { fallbackOnErrors: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const config = app.get(ConfigService);
  const sessionSecret = config.get('sessionSecret');
  const sessionSalt = config.get('sessionSalt');

  await app.register(secureSession, {
    secret: Buffer.from(sessionSecret, 'hex'),
    salt: sessionSalt,
    cookie: {
      path: '/',
      httpOnly: true,
    },
  });

  await app.listen(config.get('port') || 8000, '0.0.0.0');
}

bootstrap();
