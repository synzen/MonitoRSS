import { Controller, Get, Session } from '@nestjs/common';
import { Session as FastifySession } from 'fastify-secure-session';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(@Session() session: FastifySession): string {
    const accessToken = session.get('accessToken');

    if (!accessToken) {
      return this.appService.getHello();
    }

    return accessToken;
  }
}
