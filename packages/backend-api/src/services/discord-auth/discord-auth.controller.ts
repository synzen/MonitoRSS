import { Controller, Get, Query, Res } from '@nestjs/common';
import DiscordAuthService from './discord-auth.service';
import { FastifyReply } from 'fastify';

@Controller('discord')
export class DiscordAuthController {
  constructor(private readonly discordAuthService: DiscordAuthService) {}

  @Get('login')
  login(@Res() res: FastifyReply) {
    const authorizationUri = this.discordAuthService.getAuthorizationUrl();

    res.redirect(301, authorizationUri);
  }

  @Get('callback')
  discordCallback(@Query('code') code?: string) {
    if (!code) {
      return 'No code provided';
    }

    return this.discordAuthService.createAccessToken(code);
  }
}
