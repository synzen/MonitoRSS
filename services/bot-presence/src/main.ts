import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule.forRoot());
  app.enableShutdownHooks();
  await app.init();
  console.log('Running');
}
bootstrap();
