import { Controller, Get, Query, Res } from '@nestjs/common';
import { DiscordAuthService } from './discord-auth.service';
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
  discordCallback(
    @Res() res: FastifyReply,
    @Query('code') code?: string,
    @Query('error') error?: string,
  ) {
    if (error === 'access_denied') {
      return res.redirect(301, '/');
    }

    if (!code) {
      return 'No code provided';
    }

    return this.discordAuthService.createAccessToken(code);
  }
}
