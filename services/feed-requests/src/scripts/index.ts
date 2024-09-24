import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

export async function getApplicationContext() {
  const app = await NestFactory.createApplicationContext(AppModule.forApi());

  return {
    app,
  };
}
