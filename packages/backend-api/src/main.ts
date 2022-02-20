import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import secureSession from 'fastify-secure-session';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

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
